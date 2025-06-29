import { DurableObject } from "cloudflare:workers";

const MAX_MESSAGE_SIZE = 1024 * 10; // 10KB

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

type WebSocketMessage = JoinMessage | VoteMessage | RevealMessage | ResetMessage;

// Extract room and user info from WebSocket protocol header
function extractRoomAndUser(request: Request): {
  room: string;
  userId: string;
} {
  const protocolHeader = request.headers.get("sec-websocket-protocol");
  if (!protocolHeader) {
    throw new Error("Missing sec-websocket-protocol header");
  }
  const [encoded] = protocolHeader.split(",").map((x) => x.trim());
  if (!encoded) {
    throw new Error("Invalid sec-websocket-protocol format");
  }
  
  // Convert base64url back to base64 and decode
  const base64 = encoded.replace(/-/g, '+').replace(/_/g, '/');
  // Add padding if needed
  const padded = base64 + '='.repeat((4 - base64.length % 4) % 4);
  const decoded = atob(padded);
  const [room, userId] = decoded.split(":");
  if (!room || !userId) {
    throw new Error("Room and User ID must be separated by a colon");
  }
  return { room, userId };
}

export class PokerRoom extends DurableObject {
  async publish(room: string, data: any) {
    try {
      const websockets = this.ctx.getWebSockets();
      if (websockets.length < 1) {
        return;
      }
      for (const ws of websockets) {
        const state = ws.deserializeAttachment() || {};
        if (state.room === room) {
          ws.send(JSON.stringify(data));
        }
      }
      return null;
    } catch (err) {
      console.error("publish err", err);
    }
  }

  override async fetch(request: Request): Promise<Response> {
    if (request.headers.get("upgrade") === "websocket") {
      try {
        const { room, userId } = extractRoomAndUser(request);
        const protocols =
          request.headers
            .get("sec-websocket-protocol")
            ?.split(",")
            .map((x) => x.trim()) || [];
        protocols.shift(); // remove the room:userId from protocols

        const webSocketPair = new WebSocketPair();
        const [client, server] = Object.values(webSocketPair);
        if (server) {
          server.serializeAttachment({
            room,
            userId,
          });
          this.ctx.acceptWebSocket(server, [room, userId]);
        }

        const res = new Response(null, { status: 101, webSocket: client });
        if (protocols.length > 0) {
          res.headers.set("sec-websocket-protocol", protocols[0] as string);
        }
        return res;
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
    const { room, userId } = ws.deserializeAttachment();

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
    const { room, userId } = ws.deserializeAttachment();
    await this.handleDisconnect(room, userId);
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
          if (roomState.participants[id]) {
            roomState.participants[id].vote = null;
          }
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
        const state = ws.deserializeAttachment() || {};
        if (state.room === room) {
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

// Default export for the Worker
export default {
  async fetch(request: Request, env: any): Promise<Response> {
    // Handle WebSocket upgrade requests for poker rooms
    if (request.headers.get("upgrade") === "websocket") {
      try {
        const { room } = extractRoomAndUser(request);
        const stub = env.POKER_ROOM.get(env.POKER_ROOM.idFromName(room));
        return stub.fetch(request);
      } catch (err) {
        console.error("Error in worker fetch:", err);
        return new Response(null, { status: 400 });
      }
    }

    // For all other requests, try to import and use the Nuxt handler
    try {
      // @ts-ignore - This will be available after Nuxt build
      const handler = await import('../.output/server/index.mjs');
      return handler.default.fetch(request, env);
    } catch (error) {
      console.error("Error loading Nuxt handler:", error);
      return new Response("Internal Server Error", { status: 500 });
    }
  },
};
