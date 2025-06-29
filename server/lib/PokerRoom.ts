
/**
 * Defines the structure for a participant in the poker room.
 */
interface Participant {
  id: string;
  name: string;
  vote: string | number | null;
}

/**
 * Defines the structure for the data that is persisted in Durable Object storage.
 * Note: We don't store WebSockets here as they are not serializable.
 */
interface RoomStorage {
  participants: Record<string, Omit<Participant, 'id'>>;
  votesRevealed: boolean;
  storyTitle: string; // This can be expanded upon later
}

/**
 * Defines the types of messages that can be sent from the client to the server.
 */
type IncomingMessage =
  | { type: 'join'; payload: { name: string } }
  | { type: 'vote'; payload: { vote: string | number | null } }
  | { type: 'reveal' }
  | { type: 'reset' };

/**
 * PokerRoom Durable Object
 *
 * This class manages the state and communication for a single planning poker room.
 * It handles WebSocket connections, user votes, and broadcasting state changes to all participants.
 */
export class PokerRoom implements DurableObject {
  state: DurableObjectState;
  sessions: Map<string, WebSocket>;
  // env is not used in this version but is required by the constructor signature
  // and is good practice to have for future integrations (e.g., D1).
  env: unknown;

  constructor(state: DurableObjectState, env: unknown) {
    this.state = state;
    this.env = env;
    this.sessions = new Map();
  }

  /**
   * The main entry point for the Durable Object. It handles HTTP requests.
   * It's primarily used here to upgrade HTTP connections to WebSockets.
   */
  async fetch(request: Request): Promise<Response> {
    const upgradeHeader = request.headers.get('Upgrade');
    if (upgradeHeader !== 'websocket') {
      return new Response('Expected Upgrade: websocket', { status: 426 });
    }

    // Create a WebSocket pair: one for the client, one for the server (Durable Object).
    const [client, server] = Object.values(new WebSocketPair());

    // Hand over the server-side WebSocket to our session handler.
    this.handleSession(server);

    // Return the client-side WebSocket to the client.
    return new Response(null, {
      status: 101,
      webSocket: client,
    });
  }

  /**
   * Manages a single WebSocket session/connection.
   * @param socket The server-side WebSocket connection.
   */
  async handleSession(socket: WebSocket) {
    const sessionId = crypto.randomUUID();
    this.sessions.set(sessionId, socket);

    // Send the session ID to the client immediately
    socket.send(JSON.stringify({
      type: 'connected',
      payload: { sessionId }
    }));

    // Set up event listeners for the WebSocket connection.
    socket.addEventListener('message', async (event) => {
      try {
        const message: IncomingMessage = JSON.parse(event.data as string);
        await this.handleMessage(sessionId, message);
      }
      catch (error) {
        console.error('Failed to parse or handle message:', error);
        socket.send(JSON.stringify({ type: 'error', payload: { message: 'Invalid message format' } }));
      }
    });

    socket.addEventListener('close', async () => {
      await this.handleDisconnect(sessionId);
    });

    socket.addEventListener('error', (error) => {
      console.error(`WebSocket error for session ${sessionId}:`, error);
    });
  }

  /**
   * Processes incoming messages from a client.
   * @param sessionId The unique ID of the client's session.
   * @param message The parsed message from the client.
   */
  async handleMessage(sessionId: string, message: IncomingMessage) {
    const roomState = await this.getRoomState();

    switch (message.type) {
      case 'join': {
        // Add a new participant to the room.
        roomState.participants[sessionId] = {
          name: message.payload.name || `Guest-${sessionId.substring(0, 4)}`,
          vote: null,
        };
        break;
      }
      case 'vote': {
        // Record a participant's vote.
        if (roomState.participants[sessionId]) {
          roomState.participants[sessionId].vote = message.payload.vote;
        }
        break;
      }
      case 'reveal': {
        // Mark votes as revealed for all participants.
        roomState.votesRevealed = true;
        break;
      }
      case 'reset': {
        // Reset the room for a new round of voting.
        roomState.votesRevealed = false;
        for (const id in roomState.participants) {
          roomState.participants[id].vote = null;
        }
        break;
      }
    }

    await this.setRoomState(roomState);
    await this.broadcastState();
  }

  /**
   * Handles a client disconnecting from the room.
   * @param sessionId The ID of the session that disconnected.
   */
  async handleDisconnect(sessionId: string) {
    this.sessions.delete(sessionId);
    const roomState = await this.getRoomState();
    delete roomState.participants[sessionId];
    await this.setRoomState(roomState);
    await this.broadcastState();
  }

  /**
   * Sends the current room state to all connected clients.
   */
  async broadcastState() {
    const roomState = await this.getRoomState();
    // Transform the participants object into an array for easier use on the client.
    const participantsList = Object.entries(roomState.participants).map(([id, p]) => ({ id, ...p }));

    const message = {
      type: 'update',
      payload: {
        ...roomState,
        participants: participantsList,
      },
    };
    const serializedMessage = JSON.stringify(message);

    // Clean up any dead connections while we're at it.
    const deadSessions: string[] = [];
    this.sessions.forEach((socket, id) => {
      if (socket.readyState === WebSocket.OPEN) {
        socket.send(serializedMessage);
      }
      else {
        // This connection is closed or closing, mark for removal.
        deadSessions.push(id);
      }
    });
    deadSessions.forEach(id => this.sessions.delete(id));
  }

  /**
   * Retrieves the current state of the room from persistent storage.
   * Provides a default state if none exists.
   */
  async getRoomState(): Promise<RoomStorage> {
    const state: RoomStorage | undefined = await this.state.storage.get('state');
    return state || {
      participants: {},
      votesRevealed: false,
      storyTitle: 'As a user, I want to see my vote reflected in the UI.',
    };
  }

  /**
   * Writes the current room state to persistent storage.
   * @param state The state to save.
   */
  async setRoomState(state: RoomStorage) {
    await this.state.storage.put('state', state);
  }
}
