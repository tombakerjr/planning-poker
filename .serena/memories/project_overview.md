# Project Overview: Planning Poker Application

## Purpose
A real-time planning poker application for agile teams, enabling geographically distributed team members to vote on story points with instant updates.

## Production URL
https://planning-poker.tombaker.workers.dev

## Core Architecture

### Single-Worker Architecture
The app uses a custom worker entrypoint (`worker.ts`) that routes requests:
1. **WebSocket requests** (`/api/room/[id]/ws`) → Durable Object (PokerRoom)
2. **All other requests** → Nuxt/Nitro handler

### Key Components
- **Durable Objects**: Each poker room is a Durable Object instance managing WebSocket connections using the Hibernation API
- **State Management**: In-memory state with session persistence via `ws.serializeAttachment()`
- **Real-time**: WebSocket communication with heartbeat pings every 30 seconds
- **Client-side**: Auto-reconnection with exponential backoff (max 10 attempts)

### Message Protocol
All WebSocket messages follow:
```typescript
{
  type: 'join' | 'vote' | 'reveal' | 'reset' | 'update' | 'error' | 'ping' | 'pong',
  payload?: any
}
```

## Deployment
- **Host**: Cloudflare Workers
- **CI/CD**: Automatic deployments via Cloudflare Dashboard GitHub integration on pushes to `main` branch
- **Monitoring**: Observability enabled in wrangler.jsonc
