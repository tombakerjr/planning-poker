// Custom worker entrypoint that exports both the default export and Durable Objects
import * as nitroApp from './.output/server/index.mjs';
import { createConfig } from './server/utils/config';
export { PokerRoom } from './server/poker-room';

interface Env {
  POKER_ROOM: DurableObjectNamespace
  ASSETS: Fetcher
  FLAGS_CACHE: KVNamespace
}

// Module-level cache for kill switch to avoid KV reads on every request
let killSwitchCache: { enabled: boolean; expiry: number } | null = null;
const KILL_SWITCH_CACHE_TTL = 60000; // 60 seconds

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    // MASTER KILL SWITCH: Check APP_ENABLED flag before routing
    // Returns maintenance page when APP_ENABLED is false
    const now = Date.now();

    // Check cache first to avoid KV reads on every request
    if (!killSwitchCache || now > killSwitchCache.expiry) {
      const config = createConfig(env);
      const appEnabled = await config.get('APP_ENABLED');
      config.destroy();

      killSwitchCache = {
        enabled: appEnabled,
        expiry: now + KILL_SWITCH_CACHE_TTL,
      };
    }

    if (!killSwitchCache.enabled) {
      return new Response(
        `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Under Maintenance</title>
  <style>
    body {
      font-family: system-ui, -apple-system, sans-serif;
      display: flex;
      justify-content: center;
      align-items: center;
      min-height: 100vh;
      margin: 0;
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      color: white;
    }
    .container {
      text-align: center;
      padding: 2rem;
      max-width: 600px;
    }
    h1 { font-size: 2.5rem; margin-bottom: 1rem; }
    p { font-size: 1.25rem; opacity: 0.9; }
  </style>
</head>
<body>
  <div class="container">
    <h1>🔧 Under Maintenance 🔧</h1>
    <p>Planning Poker is temporarily unavailable for scheduled maintenance.</p>
    <p>We'll be back shortly. Thank you for your patience!</p>
  </div>
</body>
</html>`,
        {
          status: 503,
          headers: {
            'Content-Type': 'text/html; charset=utf-8',
            'Retry-After': '300', // Suggest retry in 5 minutes
          },
        },
      );
    }

    // Check if this is a WebSocket upgrade request for a room
    const url = new URL(request.url);
    const wsMatch = url.pathname.match(/^\/api\/room\/([^\/]+)\/ws$/);

    if (wsMatch && request.headers.get('Upgrade') === 'websocket') {
      const roomId = wsMatch[1];

      // Get the Durable Object instance for this room
      const id = env.POKER_ROOM.idFromName(roomId);
      const stub = env.POKER_ROOM.get(id);

      // Forward the WebSocket upgrade request to the Durable Object
      return stub.fetch(request);
    }

    // For all other requests, pass to the Nuxt handler
    return nitroApp.default.fetch(request, env, ctx);
  },
};
