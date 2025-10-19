import { DurableObject } from "cloudflare:workers";

const MAX_MESSAGE_SIZE = 1024 * 10; // 10KB

interface Participant {
  name: string;
  vote: string | number | null;
}

interface RoomStorage {
  participants: Record<string, Participant>;
  votesRevealed: boolean;
  storyTitle: string;
}

interface AuthMessage {
  type: "auth";
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

type WebSocketMessage =
  | AuthMessage
  | JoinMessage
  | VoteMessage
  | RevealMessage
  | ResetMessage
  | PingMessage
  | PongMessage;

interface WebSocketMeta {
  userId: string;
}

export class PokerRoom extends DurableObject {
  private sessions = new Map<WebSocket, WebSocketMeta>();

  override async fetch(request: Request): Promise<Response> {
    // Handle WebSocket upgrade requests
    if (request.headers.get("upgrade") === "websocket") {
      return this.handleWebSocketUpgrade(request);
    }

    return new Response("Expected WebSocket upgrade", { status: 426 });
  }

  private async handleWebSocketUpgrade(_request: Request): Promise<Response> {
    // Create WebSocket pair
    const webSocketPair = new WebSocketPair();
    const [client, server] = Object.values(webSocketPair);

    if (!client || !server) {
      return new Response("Failed to create WebSocket pair", { status: 500 });
    }

    // Accept the WebSocket using Hibernation API
    // This allows the Durable Object to hibernate when idle, saving costs
    this.ctx.acceptWebSocket(server);

    // Start heartbeat for this socket
    this.startHeartbeat(server);

    return new Response(null, {
      status: 101,
      webSocket: client,
    });
  }

  override async webSocketMessage(ws: WebSocket, message: ArrayBuffer | string) {
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

      // Handle authentication message
      if (parsed.type === "auth") {
        const meta: WebSocketMeta = {
          userId: parsed.userId,
        };

        // Store metadata with the WebSocket for recovery after hibernation
        ws.serializeAttachment(meta);
        this.sessions.set(ws, meta);

        // Send initial room state
        await this.sendRoomState(ws);
        return;
      }

      // For other messages, get userId from metadata
      const meta = this.sessions.get(ws);
      if (!meta) {
        console.error("WebSocket not authenticated");
        ws.close(1003, "Not authenticated");
        return;
      }

      // Handle ping/pong for heartbeat
      if (parsed.type === "ping") {
        ws.send(JSON.stringify({ type: "pong" }));
        return;
      }

      // Handle room messages
      await this.handleMessage(meta.userId, parsed);
    } catch (err) {
      console.error("Message processing error:", err);
      ws.close(1003, "Invalid message format");
    }
  }

  override async webSocketClose(
    ws: WebSocket,
    _code: number,
    _reason: string,
    _wasClean: boolean
  ) {
    const meta = this.sessions.get(ws);
    if (meta) {
      await this.handleDisconnect(meta.userId);
      this.sessions.delete(ws);
    }
  }

  override async webSocketError(ws: WebSocket, error: unknown) {
    console.error("WebSocket error:", error);
    const meta = this.sessions.get(ws);
    if (meta) {
      this.sessions.delete(ws);
    }
  }

  private async handleMessage(userId: string, message: WebSocketMessage) {
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
          const participant = roomState.participants[id];
          if (participant) {
            participant.vote = null;
          }
        }
        break;
      }
    }

    await this.setRoomState(roomState);
    await this.broadcastState();
  }

  private async handleDisconnect(userId: string) {
    const roomState = await this.getRoomState();
    delete roomState.participants[userId];
    await this.setRoomState(roomState);
    await this.broadcastState();
  }

  private async sendRoomState(ws: WebSocket) {
    const roomState = await this.getRoomState();
    const participantsList = Object.entries(roomState.participants).map(
      ([id, p]) => ({ id, ...p })
    );

    const message = {
      type: "update",
      payload: {
        ...roomState,
        participants: participantsList,
      },
    };

    try {
      ws.send(JSON.stringify(message));
    } catch (error) {
      console.error("Failed to send room state:", error);
    }
  }

  private async broadcastState() {
    const roomState = await this.getRoomState();
    const participantsList = Object.entries(roomState.participants).map(
      ([id, p]) => ({ id, ...p })
    );

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
        ws.send(serializedMessage);
      } catch (error) {
        console.error("Failed to send message to WebSocket:", error);
      }
    }
  }

  private async getRoomState(): Promise<RoomStorage> {
    const state: RoomStorage | undefined = await this.ctx.storage.get("state");
    return state || {
      participants: {},
      votesRevealed: false,
      storyTitle: "As a user, I want to see my vote reflected in the UI.",
    };
  }

  private async setRoomState(state: RoomStorage) {
    await this.ctx.storage.put("state", state);
  }

  private startHeartbeat(ws: WebSocket) {
    // Send ping every 30 seconds to keep connection alive
    const intervalId = setInterval(() => {
      try {
        ws.send(JSON.stringify({ type: "ping" }));
      } catch (error) {
        console.error("Failed to send ping:", error);
        clearInterval(intervalId);
      }
    }, 30000) as unknown as number;

    // Note: In WebSocket Hibernation, the interval will be cleared
    // when the Durable Object hibernates
  }
}
