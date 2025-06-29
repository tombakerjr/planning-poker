# Planning Poker - Deployment Guide

## Architecture Overview

This Planning Poker application uses the modern Cloudflare stack:

- **Frontend**: Nuxt.js 4 (SSG/SSR) deployed to Cloudflare Pages
- **Backend**: Cloudflare Durable Objects + WebSocket worker
- **Real-time**: WebSocket connections with protocol-based authentication

## Development

### Prerequisites
- Node.js 18+ 
- pnpm package manager
- Cloudflare account

### Running Locally

1. Install dependencies:
   ```bash
   pnpm install
   ```

2. Start the WebSocket worker (in one terminal):
   ```bash
   pnpm dev:websockets
   ```

3. Start the Nuxt dev server (in another terminal):
   ```bash
   pnpm dev
   ```

4. Open http://localhost:3000

The WebSocket worker runs on `localhost:8787` and the Nuxt app on `localhost:3000`.

## Deployment

### 1. Deploy WebSocket Worker

```bash
pnpm deploy:websockets
```

This deploys the Durable Objects worker to Cloudflare Workers.

### 2. Deploy Frontend

```bash
pnpm build
pnpm deploy
```

This builds the Nuxt app and deploys it to Cloudflare Pages.

### 3. Environment Configuration

Update the WebSocket URL in production by setting the `NUXT_PUBLIC_WEBSOCKET_URL` environment variable in Cloudflare Pages settings:

```
NUXT_PUBLIC_WEBSOCKET_URL=wss://your-websocket-worker.your-subdomain.workers.dev
```

## Project Structure

```
/
├── components/           # Vue components
│   ├── Card.vue
│   ├── ParticipantList.vue
│   ├── UserNameModal.vue
│   └── VotingArea.vue
├── composables/          # Vue composables
│   └── usePokerRoom.ts   # Main WebSocket logic
├── pages/                # Nuxt pages
│   ├── index.vue         # Home page
│   └── room/[id].vue     # Room page
├── websockets/           # WebSocket worker
│   ├── index.ts          # Durable Objects implementation
│   └── wrangler.jsonc    # Worker configuration
├── wrangler.jsonc        # Main app configuration
└── nuxt.config.ts        # Nuxt configuration
```

## Key Features

- ✅ Real-time collaboration via WebSocket
- ✅ Persistent room state via Durable Objects
- ✅ Automatic reconnection handling
- ✅ Mobile-responsive UI
- ✅ URL-based room sharing
- ✅ Vote hiding/revealing
- ✅ Round reset functionality

## Technical Details

### WebSocket Authentication
- Room ID and User ID encoded as base64url in WebSocket subprotocol
- Format: `base64url(roomId:userId)`
- Compatible with Cloudflare Workers WebSocket API

### Message Format
All WebSocket messages use flat JSON objects:

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
