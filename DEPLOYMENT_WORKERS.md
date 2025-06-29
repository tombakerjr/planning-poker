# Planning Poker - Cloudflare Workers Deployment Guide

This planning poker application is designed for deployment on Cloudflare Workers with Durable Objects, combining both the Nuxt.js frontend and WebSocket backend in a single unified deployment.

## Architecture

- **Single Worker Deployment**: Both the Nuxt app and WebSocket functionality are deployed as one Workers application
- **Durable Objects**: Handle room state persistence and real-time WebSocket connections
- **Static Assets**: Served from Workers Static Assets

## Prerequisites

1. **Cloudflare Account**: Sign up at [cloudflare.com](https://cloudflare.com)
2. **Workers Paid Plan**: Required for Durable Objects ($5/month minimum)
3. **Wrangler CLI**: Install with `npm install -g wrangler`
4. **Authentication**: Run `wrangler login`

## Local Development

1. **Install dependencies:**
   ```bash
   pnpm install
   ```

2. **Start Nuxt development server:**
   ```bash
   pnpm dev
   ```

3. **Test the unified worker locally:**
   ```bash
   pnpm dev:worker
   ```

   This will:
   - Build the Nuxt app
   - Start the worker with Durable Objects
   - Handle both HTTP requests (Nuxt) and WebSocket connections

## Production Deployment

### One-Command Deployment

```bash
pnpm deploy
```

This command will:
1. Build the Nuxt application
2. Deploy the unified worker with Durable Objects
3. Apply necessary migrations
4. Serve both the app and WebSocket endpoints

### Manual Steps

If you prefer manual deployment:

1. **Build the Nuxt app:**
   ```bash
   pnpm build
   ```

2. **Deploy to Cloudflare Workers:**
   ```bash
   wrangler deploy
   ```

## Configuration

The deployment is configured via `wrangler.jsonc`:

```jsonc
{
  "name": "planning-poker",
  "main": "./server/index.ts",
  "compatibility_date": "2025-06-28",
  "compatibility_flags": ["nodejs_compat"],
  "assets": {
    "binding": "ASSETS",
    "directory": "./.output/public/"
  },
  "durable_objects": {
    "bindings": [
      {
        "name": "POKER_ROOM",
        "class_name": "PokerRoom"
      }
    ]
  },
  "migrations": [
    {
      "tag": "v1",
      "new_sqlite_classes": ["PokerRoom"]
    }
  ]
}
```

## Environment Variables

### Production Runtime Config

The app automatically detects the deployment URL and configures WebSocket connections accordingly. No additional environment variables are required for basic deployment.

### Custom Domain (Optional)

If you want to use a custom domain:

1. **Add domain in Cloudflare Dashboard:**
   - Go to Workers & Pages > your worker > Triggers
   - Add Custom Domain

2. **Or via Wrangler:**
   ```bash
   wrangler deploy --route "your-domain.com/*"
   ```

## Architecture Details

### Unified Worker Structure

The deployment uses a single worker that:

- **Handles HTTP requests**: Routes them to the Nuxt.js application
- **Handles WebSocket upgrades**: Routes them to the appropriate Durable Object
- **Manages Durable Objects**: Persistent room state and real-time communication

### Request Routing

```typescript
export default {
  async fetch(request: Request, env: any): Promise<Response> {
    // WebSocket requests go to Durable Objects
    if (request.headers.get("upgrade") === "websocket") {
      const { room } = extractRoomAndUser(request);
      const stub = env.POKER_ROOM.get(env.POKER_ROOM.idFromName(room));
      return stub.fetch(request);
    }

    // All other requests go to Nuxt
    const handler = await import('../.output/server/index.mjs');
    return handler.default.fetch(request, env);
  },
};
```

## Monitoring and Debugging

### Logs

View real-time logs:
```bash
wrangler tail
```

### Durable Objects

Monitor Durable Objects in the Cloudflare Dashboard:
- Workers & Pages > your worker > Durable Objects

### Performance

- WebSocket connections are handled at the edge
- Room state is persisted automatically
- Global distribution via Cloudflare's network

## Troubleshooting

### Common Issues

1. **Migration Errors**: If you get migration errors, check that the migration tag is unique
2. **WebSocket Connection Failed**: Ensure the WebSocket URL matches your deployed worker URL
3. **Build Errors**: Run `pnpm build` locally first to verify the Nuxt build succeeds

### Debug Commands

```bash
# Check worker status
wrangler status

# View live logs
wrangler tail

# Test locally with remote Durable Objects
wrangler dev --remote
```

## Costs

- **Workers**: $5/month minimum for Durable Objects
- **Requests**: First 100k requests/month free
- **Duration**: First 400k GB-s/month free
- **Durable Objects**: First 1M requests/month free

For a typical planning poker usage, costs should remain within the free tier limits.

## WebSocket Protocol

### Authentication

WebSocket connections use protocol-based authentication:
```typescript
const auth = `${roomId}:${userId}`;
const protocol = btoa(auth).replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
```

### Message Format

```typescript
// Join room
{ type: 'join', name: 'User Name' }

// Vote
{ type: 'vote', vote: 5 }

// Reveal votes
{ type: 'reveal' }

// Reset round
{ type: 'reset' }

// State update (server -> client)
{ 
  type: 'update', 
  payload: { 
    participants: [...], 
    votesRevealed: boolean, 
    storyTitle: string 
  } 
}
```

### Durable Objects Storage
Room state is persisted in Durable Objects storage with the following structure:

```typescript
{
  participants: Record<string, { name: string, vote: string | number | null }>,
  votesRevealed: boolean,
  storyTitle: string
}
```

## Monitoring

- WebSocket connections: Monitor via Cloudflare Workers dashboard
- Room state: Persisted in Durable Objects storage  
- Error logging: Available in Cloudflare Workers logs
