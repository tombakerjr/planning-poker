import { DurableObject } from "cloudflare:workers";

// Simple logging utility for Durable Objects
enum LogLevel {
  DEBUG = 0,
  INFO = 1,
  WARN = 2,
  ERROR = 3,
}

const LOG_LEVEL = LogLevel.WARN; // Only log warnings and errors in production

function log(level: LogLevel, message: string, ...args: any[]) {
  if (level < LOG_LEVEL) return;

  const timestamp = new Date().toISOString();
  const levelName = LogLevel[level];
  const logEntry = { timestamp, level: levelName, message, ...(args.length > 0 && { data: args }) };

  switch (level) {
    case LogLevel.DEBUG:
      console.debug(JSON.stringify(logEntry));
      break;
    case LogLevel.INFO:
      console.log(JSON.stringify(logEntry));
      break;
    case LogLevel.WARN:
      console.warn(JSON.stringify(logEntry));
      break;
    case LogLevel.ERROR:
      console.error(JSON.stringify(logEntry));
      break;
  }
}

const logger = {
  debug: (msg: string, ...args: any[]) => log(LogLevel.DEBUG, msg, ...args),
  info: (msg: string, ...args: any[]) => log(LogLevel.INFO, msg, ...args),
  warn: (msg: string, ...args: any[]) => log(LogLevel.WARN, msg, ...args),
  error: (msg: string, ...args: any[]) => log(LogLevel.ERROR, msg, ...args),
};

const MAX_MESSAGE_SIZE = 1024 * 10; // 10KB
const MAX_NAME_LENGTH = 50;
const HEARTBEAT_INTERVAL_MS = 30000; // 30 seconds

// Rate limiting constants
const MAX_MESSAGES_PER_SECOND = 10;
const RATE_LIMIT_WINDOW_MS = 1000; // 1 second
const MAX_CONNECTIONS_PER_DO = 100;

// Voting scale definitions (must match client-side definitions)
const VALID_SCALES = ['fibonacci', 'modified-fibonacci', 't-shirt', 'powers-of-2', 'linear'] as const;
type ValidScale = typeof VALID_SCALES[number];

const SCALE_VALUES: Record<ValidScale, (string | number)[]> = {
  'fibonacci': [0, 1, 2, 3, 5, 8, 13, 21, 34, 55, 89, '?', '☕'],
  'modified-fibonacci': [0, '½', 1, 2, 3, 5, 8, 13, 20, 40, 100, '?', '☕'],
  't-shirt': ['XS', 'S', 'M', 'L', 'XL', 'XXL', '?'],
  'powers-of-2': [1, 2, 4, 8, 16, 32, 64, '?'],
  'linear': [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, '?'],
};

interface Participant {
  name: string;
  vote: string | number | null;
}

interface RoomStorage {
  participants: Record<string, Participant>;
  votesRevealed: boolean;
  storyTitle: string;
  votingScale?: string; // fibonacci, modified-fibonacci, t-shirt, etc.
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

interface SetStoryMessage {
  type: "setStory";
  title: string;
}

interface SetScaleMessage {
  type: "setScale";
  scale: string;
}

type WebSocketMessage =
  | AuthMessage
  | JoinMessage
  | VoteMessage
  | RevealMessage
  | ResetMessage
  | PingMessage
  | PongMessage
  | SetStoryMessage
  | SetScaleMessage;

interface WebSocketMeta {
  userId: string;
}

interface RateLimitInfo {
  messageCount: number;
  windowStart: number;
}

export class PokerRoom extends DurableObject {
  private sessions = new Map<WebSocket, WebSocketMeta>();
  private heartbeatIntervals = new Map<WebSocket, number>();
  private rateLimits = new Map<WebSocket, RateLimitInfo>();
  private broadcastDebounceTimeout?: number;

  override async fetch(request: Request): Promise<Response> {
    // Handle WebSocket upgrade requests
    if (request.headers.get("upgrade") === "websocket") {
      return this.handleWebSocketUpgrade(request);
    }

    return new Response("Expected WebSocket upgrade", { status: 426 });
  }

  private async handleWebSocketUpgrade(_request: Request): Promise<Response> {
    // Check connection limit
    const currentConnections = this.ctx.getWebSockets().length;
    if (currentConnections >= MAX_CONNECTIONS_PER_DO) {
      return new Response("Too many connections", { status: 429 });
    }

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
    // Check rate limit
    if (!this.checkRateLimit(ws)) {
      ws.send(JSON.stringify({
        type: "error",
        payload: { message: "Rate limit exceeded. Please slow down." }
      }));
      return;
    }

    // Restore session from attachment if not in memory (after hibernation)
    if (!this.sessions.has(ws)) {
      const meta = ws.deserializeAttachment() as WebSocketMeta | null;
      if (meta) {
        logger.info(`Restored session for user ${meta.userId} after hibernation`);
        this.sessions.set(ws, meta);
      }
    }

    // Validate message type and size
    if (typeof message !== "string") {
      logger.warn(`Invalid message type: ${typeof message}`);
      ws.close(1003, "Invalid message type");
      return;
    }

    if (message.length > MAX_MESSAGE_SIZE) {
      logger.warn(`Message too large: ${message.length} bytes`);
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
        logger.warn("WebSocket not authenticated");
        ws.close(1003, "Not authenticated");
        return;
      }

      // Handle ping/pong for heartbeat
      if (parsed.type === "ping") {
        ws.send(JSON.stringify({ type: "pong" }));
        return;
      }

      // Handle room messages
      await this.handleMessage(ws, meta.userId, parsed);
    } catch (err) {
      logger.error("Message processing error:", err);
      ws.close(1003, "Invalid message format");
    }
  }

  override async webSocketClose(
    ws: WebSocket,
    _code: number,
    _reason: string,
    _wasClean: boolean
  ) {
    // Stop heartbeat to prevent memory leak
    this.stopHeartbeat(ws);

    const meta = this.sessions.get(ws);
    if (meta) {
      await this.handleDisconnect(meta.userId);
      this.sessions.delete(ws);
    }

    // Clean up rate limit info
    this.rateLimits.delete(ws);

    // Clean up debounce timeout if no more connections
    // This prevents memory leaks when the last client disconnects
    const remainingConnections = this.ctx.getWebSockets().length;
    if (remainingConnections === 0 && this.broadcastDebounceTimeout) {
      clearTimeout(this.broadcastDebounceTimeout);
      this.broadcastDebounceTimeout = undefined;
    }
  }

  override async webSocketError(ws: WebSocket, error: unknown) {
    logger.error("WebSocket error:", error);
    const meta = this.sessions.get(ws);
    if (meta) {
      this.sessions.delete(ws);
    }
  }

  private async handleMessage(ws: WebSocket, userId: string, message: WebSocketMessage) {
    const roomState = await this.getRoomState();

    switch (message.type) {
      case "join": {
        // Add a new participant to the room
        const sanitizedName = message.name?.trim().substring(0, MAX_NAME_LENGTH);
        roomState.participants[userId] = {
          name: sanitizedName || `Guest-${userId.substring(0, 4)}`,
          vote: null,
        };
        break;
      }
      case "vote": {
        // Validate user has joined before voting
        if (!roomState.participants[userId]) {
          ws.send(JSON.stringify({
            type: "error",
            payload: { message: "Must join room before voting" }
          }));
          return;
        }

        // Validate vote against current scale
        if (message.vote !== null) {
          const currentScale = (roomState.votingScale || 'fibonacci') as ValidScale;
          const validValues = SCALE_VALUES[currentScale] || SCALE_VALUES['fibonacci'];

          // Convert to strings for comparison to handle mixed types (number vs string)
          // Example: '½' (string) should match even if vote arrives as different type
          const voteStr = String(message.vote);
          const validValuesStr = validValues.map(v => String(v));

          if (!validValuesStr.includes(voteStr)) {
            ws.send(JSON.stringify({
              type: "error",
              payload: { message: "Invalid vote value for current scale. The scale may have changed - please vote again." }
            }));
            return;
          }
        }

        roomState.participants[userId].vote = message.vote;
        break;
      }
      case "reveal": {
        // Validate user has joined before revealing
        if (!roomState.participants[userId]) {
          ws.send(JSON.stringify({
            type: "error",
            payload: { message: "Must join room before revealing votes" }
          }));
          return;
        }
        roomState.votesRevealed = true;
        break;
      }
      case "reset": {
        // Validate user has joined before resetting
        if (!roomState.participants[userId]) {
          ws.send(JSON.stringify({
            type: "error",
            payload: { message: "Must join room before resetting" }
          }));
          return;
        }
        roomState.votesRevealed = false;
        for (const id in roomState.participants) {
          const participant = roomState.participants[id];
          if (participant) {
            participant.vote = null;
          }
        }
        break;
      }
      case "setStory": {
        // Validate user has joined before setting story
        if (!roomState.participants[userId]) {
          ws.send(JSON.stringify({
            type: "error",
            payload: { message: "Must join room before setting story" }
          }));
          return;
        }
        // Sanitize and limit story title length
        const sanitizedTitle = message.title?.trim().substring(0, 200);
        roomState.storyTitle = sanitizedTitle || "";
        break;
      }
      case "setScale": {
        // Validate user has joined before setting scale
        if (!roomState.participants[userId]) {
          ws.send(JSON.stringify({
            type: "error",
            payload: { message: "Must join room before setting voting scale" }
          }));
          return;
        }

        // Validate scale type against whitelist
        if (!VALID_SCALES.includes(message.scale as ValidScale)) {
          ws.send(JSON.stringify({
            type: "error",
            payload: { message: "Invalid voting scale type" }
          }));
          return;
        }

        // Update voting scale and clear all votes
        // Existing votes may be invalid on the new scale (e.g., "21" on Fibonacci → T-shirt sizes)
        roomState.votingScale = message.scale;

        // Clear all participant votes to prevent data corruption
        Object.keys(roomState.participants).forEach(participantId => {
          roomState.participants[participantId].vote = null;
        });

        // Reset reveal state since votes have been cleared
        roomState.votesRevealed = false;
        break;
      }
    }

    await this.setRoomState(roomState);
    this.scheduleBroadcast();
  }

  private async handleDisconnect(userId: string) {
    const roomState = await this.getRoomState();
    delete roomState.participants[userId];
    await this.setRoomState(roomState);

    // If no participants remain, clean up the debounce timeout immediately
    // to free resources faster
    if (Object.keys(roomState.participants).length === 0 && this.broadcastDebounceTimeout) {
      clearTimeout(this.broadcastDebounceTimeout);
      this.broadcastDebounceTimeout = undefined;
      // Still broadcast the final state showing empty room
      await this.broadcastState();
    } else {
      this.scheduleBroadcast();
    }
  }

  private serializeRoomState(roomState: RoomStorage) {
    return {
      type: "update",
      payload: {
        ...roomState,
        participants: Object.entries(roomState.participants).map(
          ([id, p]) => ({ id, ...p })
        ),
      },
    };
  }

  private async sendRoomState(ws: WebSocket) {
    const roomState = await this.getRoomState();
    const message = this.serializeRoomState(roomState);

    try {
      ws.send(JSON.stringify(message));
    } catch (error) {
      logger.error("Failed to send room state:", error);
    }
  }

  private async broadcastState() {
    const roomState = await this.getRoomState();
    const message = this.serializeRoomState(roomState);

    const websockets = this.ctx.getWebSockets();
    if (websockets.length === 0) return;

    const serializedMessage = JSON.stringify(message);
    for (const ws of websockets) {
      try {
        ws.send(serializedMessage);
      } catch (error) {
        logger.error("Failed to send message to WebSocket:", error);
      }
    }
  }

  private scheduleBroadcast() {
    if (this.broadcastDebounceTimeout) {
      clearTimeout(this.broadcastDebounceTimeout);
    }
    this.broadcastDebounceTimeout = setTimeout(() => {
      this.broadcastState();
      this.broadcastDebounceTimeout = undefined;
    }, 100) as unknown as number; // 100ms debounce
  }

  private async getRoomState(): Promise<RoomStorage> {
    const state: RoomStorage | undefined = await this.ctx.storage.get("state");
    return state || {
      participants: {},
      votesRevealed: false,
      storyTitle: "",
    };
  }

  private async setRoomState(state: RoomStorage) {
    await this.ctx.storage.put("state", state);
  }

  private startHeartbeat(ws: WebSocket) {
    // Clear any existing heartbeat for this WebSocket
    this.stopHeartbeat(ws);

    // Send ping to keep connection alive
    const intervalId = setInterval(() => {
      try {
        ws.send(JSON.stringify({ type: "ping" }));
      } catch (error) {
        logger.error("Failed to send ping:", error);
        this.stopHeartbeat(ws);
      }
    }, HEARTBEAT_INTERVAL_MS) as unknown as number;

    this.heartbeatIntervals.set(ws, intervalId);
  }

  private stopHeartbeat(ws: WebSocket) {
    const intervalId = this.heartbeatIntervals.get(ws);
    if (intervalId) {
      clearInterval(intervalId);
      this.heartbeatIntervals.delete(ws);
    }
  }

  private checkRateLimit(ws: WebSocket): boolean {
    const now = Date.now();
    const rateLimit = this.rateLimits.get(ws);

    if (!rateLimit) {
      // First message, initialize rate limit tracking
      this.rateLimits.set(ws, {
        messageCount: 1,
        windowStart: now
      });
      return true;
    }

    // Check if we're in a new window
    if (now - rateLimit.windowStart >= RATE_LIMIT_WINDOW_MS) {
      // Reset to new window
      rateLimit.messageCount = 1;
      rateLimit.windowStart = now;
      return true;
    }

    // Increment message count
    rateLimit.messageCount++;

    // Check if limit exceeded
    if (rateLimit.messageCount > MAX_MESSAGES_PER_SECOND) {
      return false;
    }

    return true;
  }
}
