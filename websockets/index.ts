import { DurableObject, WorkerEntrypoint } from "cloudflare:workers";

const MAX_MESSAGE_SIZE = 1024 * 10; // 10KB

interface AuthMessage {
  type: "auth";
  roomId: string;
  userId: string;
}

interface JoinMessage {
  type: "join";
  name: string;
}

interface VoteMessage {
  type: "vote";
  vote: string | number | null;
}

interface RevealMessage {
  type: "reveal";
}

interface ResetMessage {
  type: "reset";
}

interface PingMessage {
  type: "ping";
}

interface PongMessage {
  type: "pong";
}

type WebSocketMessage = AuthMessage | JoinMessage | VoteMessage | RevealMessage | ResetMessage | PingMessage | PongMessage;

// Extract room and user info from WebSocket protocol header or URL
// Temporary: fallback to dummy values for testing
function extractRoomAndUser(request: Request): {
  room: string;
  userId: string;
} {
  try {
    const protocolHeader = request.headers.get("sec-websocket-protocol");
    if (!protocolHeader) {
      // Fallback for testing - extract from URL or use default
      const url = new URL(request.url);
      const room = url.searchParams.get('room') || 'test-room';
      const userId = url.searchParams.get('userId') || `user-${Math.random().toString(36).substring(2, 9)}`;
      return { room, userId };
    }
    const [encoded] = protocolHeader.split(",").map((x) => x.trim());
    if (!encoded) {
      throw new Error("Invalid sec-websocket-protocol format");
    }
    const decoded = Buffer.from(encoded, "base64").toString("utf-8");
    const [room, userId] = decoded.split(":");
    if (!room || !userId) {
      throw new Error("Room and User ID must be separated by a colon");
    }
    return { room, userId };
  } catch (error) {
    console.log('Protocol extraction failed, using fallback:', error);
    // Fallback for testing
    return { 
      room: 'test-room', 
      userId: `user-${Math.random().toString(36).substring(2, 9)}` 
    };
  }
}

export default class Worker extends WorkerEntrypoint {
  async publish(room: string, data: any) {
    const binding = (this.env as any)
      .POKER_ROOM as DurableObjectNamespace<PokerRoom>;
    const stub = binding.get(binding.idFromName(room));
    await stub.publish(room, data);
    return new Response(null);
  }

  override async fetch(request: Request) {
    console.log("Worker fetch called, URL:", request.url, "Upgrade:", request.headers.get("upgrade"));
    
    // Add a test endpoint
    const url = new URL(request.url);
    if (url.pathname === '/test') {
      console.log("Test endpoint called");
      return new Response("WebSocket worker is working!", { status: 200 });
    }
    
    const binding = (this.env as any)
      .POKER_ROOM as DurableObjectNamespace<PokerRoom>;
    try {
      const { room } = extractRoomAndUser(request);
      console.log("Routing to room:", room);
      const stub = binding.get(binding.idFromName(room));
      return stub.fetch(request);
    } catch (err) {
      console.error("Error in worker fetch:", err);
      return new Response(null, { status: 400 });
    }
  }
}

export class PokerRoom extends DurableObject {
  private authenticatedSockets = new Map<WebSocket, {room: string, userId: string}>();
  private heartbeatIntervals = new Map<WebSocket, number>();

  async publish(room: string, data: any) {
    try {
      const websockets = this.ctx.getWebSockets();
      if (websockets.length < 1) {
        return;
      }
      for (const ws of websockets) {
        const state = this.authenticatedSockets.get(ws);
        if (state && state.room === room) {
          ws.send(JSON.stringify(data));
        }
      }
      return null;
    } catch (err) {
      console.error("publish err", err);
    }
  }

  override async fetch(request: Request): Promise<Response> {
    console.log("PokerRoom fetch called, upgrade header:", request.headers.get("upgrade"));
    if (request.headers.get("upgrade") === "websocket") {
      try {
        console.log("Creating WebSocket pair...");
        // Create WebSocket pair
        const webSocketPair = new WebSocketPair();
        const [client, server] = Object.values(webSocketPair);
        
        console.log("Accepting WebSocket...");
        // Accept the WebSocket immediately - we'll handle auth via messages
        this.ctx.acceptWebSocket(server);
        console.log("WebSocket accepted successfully");

        // Start heartbeat for this socket
        this.startHeartbeat(server);

        return new Response(null, { status: 101, webSocket: client });
      } catch (err) {
        console.error("Error in websocket fetch:", err);
        return new Response(null, { status: 400 });
      }
    }
    return new Response(null);
  }

  override async webSocketMessage(
    ws: WebSocket,
    message: ArrayBuffer | string,
  ) {
    console.log("WebSocket message received:", typeof message, message);
    
    // Validate message type and size
    if (typeof message !== "string") {
      console.error(`Invalid message type: ${typeof message}`);
      ws.close(1003, "Invalid message type");
      return;
    }
    if (message.length > MAX_MESSAGE_SIZE) {
      console.error(`Message too large: ${message.length} bytes`);
      ws.close(1009, "Message too large");
      return;
    }

    try {
      const parsed = JSON.parse(message) as WebSocketMessage;
      console.log("Parsed message:", parsed);
      
      // Handle authentication message
      if (parsed.type === 'auth') {
        console.log("Processing auth message...");
        this.authenticatedSockets.set(ws, {
          room: parsed.roomId,
          userId: parsed.userId,
        });
        console.log(`WebSocket authenticated for room: ${parsed.roomId}, user: ${parsed.userId}`);
        return;
      }

      // For other messages, get room and userId from our map
      const socketState = this.authenticatedSockets.get(ws);
      console.log("WebSocket state:", socketState);
      if (!socketState) {
        console.error("WebSocket not authenticated");
        ws.close(1003, "Not authenticated");
        return;
      }

      const { room, userId } = socketState;
      console.log(`Processing message for room: ${room}, user: ${userId}`);
      
      // Handle ping/pong messages for heartbeat
      if (parsed.type === 'ping') {
        ws.send(JSON.stringify({ type: 'pong' }));
        return;
      }
      
      await this.handleMessage(room, userId, parsed);
    } catch (err) {
      console.error("Message processing error:", err);
      ws.close(1003, "Invalid message format");
    }
  }

  override async webSocketClose(
    ws: WebSocket,
    code: number,
    reason: string,
    _wasClean: boolean,
  ) {
    const socketState = this.authenticatedSockets.get(ws);
    if (socketState) {
      const { room, userId } = socketState;
      await this.handleDisconnect(room, userId);
      this.authenticatedSockets.delete(ws);
    }
    
    // Clean up heartbeat
    const intervalId = this.heartbeatIntervals.get(ws);
    if (intervalId) {
      clearInterval(intervalId);
      this.heartbeatIntervals.delete(ws);
    }
  }

  private async handleMessage(room: string, userId: string, message: WebSocketMessage) {
    const roomState = await this.getRoomState();

    switch (message.type) {
      case "join": {
        // Add a new participant to the room
        roomState.participants[userId] = {
          name: message.name || `Guest-${userId.substring(0, 4)}`,
          vote: null,
        };
        break;
      }
      case "vote": {
        // Record a participant's vote
        if (roomState.participants[userId]) {
          roomState.participants[userId].vote = message.vote;
        }
        break;
      }
      case "reveal": {
        // Mark votes as revealed for all participants
        roomState.votesRevealed = true;
        break;
      }
      case "reset": {
        // Reset the room for a new round of voting
        roomState.votesRevealed = false;
        for (const id in roomState.participants) {
          roomState.participants[id].vote = null;
        }
        break;
      }
    }

    await this.setRoomState(roomState);
    await this.broadcastState(room);
  }

  private async handleDisconnect(room: string, userId: string) {
    const roomState = await this.getRoomState();
    delete roomState.participants[userId];
    await this.setRoomState(roomState);
    await this.broadcastState(room);
  }

  private async broadcastState(room: string) {
    const roomState = await this.getRoomState();
    // Transform the participants object into an array for easier use on the client
    const participantsList = Object.entries(roomState.participants).map(([id, p]) => ({ id, ...p }));

    const message = {
      type: "update",
      payload: {
        ...roomState,
        participants: participantsList,
      },
    };

    const websockets = this.ctx.getWebSockets();
    if (websockets.length === 0) return;

    const serializedMessage = JSON.stringify(message);
    for (const ws of websockets) {
      try {
        const state = this.authenticatedSockets.get(ws);
        if (state && state.room === room) {
          ws.send(serializedMessage);
        }
      } catch (error) {
        console.error("Failed to send message to WebSocket:", error);
      }
    }
  }

  private async getRoomState(): Promise<RoomStorage> {
    const state: RoomStorage | undefined = await this.ctx.storage.get('state');
    return state || {
      participants: {},
      votesRevealed: false,
      storyTitle: 'As a user, I want to see my vote reflected in the UI.',
    };
  }

  private async setRoomState(state: RoomStorage) {
    await this.ctx.storage.put('state', state);
  }

  private startHeartbeat(ws: WebSocket) {
    // Send ping every 30 seconds to keep connection alive
    const intervalId = setInterval(() => {
      try {
        ws.send(JSON.stringify({ type: 'ping' }));
      } catch (error) {
        console.error("Failed to send ping:", error);
        const intervalId = this.heartbeatIntervals.get(ws);
        if (intervalId) {
          clearInterval(intervalId);
          this.heartbeatIntervals.delete(ws);
        }
      }
    }, 30000);
    
    this.heartbeatIntervals.set(ws, intervalId);
  }
}

// Interface definitions for TypeScript
interface Participant {
  name: string;
  vote: string | number | null;
}

interface RoomStorage {
  participants: Record<string, Participant>;
  votesRevealed: boolean;
  storyTitle: string;
}
