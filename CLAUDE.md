# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

A real-time planning poker application for agile teams built with Nuxt 3 and deployed to Cloudflare Workers. Users can create poker rooms, vote on story points, and see live updates via WebSockets managed by Durable Objects.

Production URL: https://planning-poker.tombaker.workers.dev

## Technology Stack

- **Framework**: Nuxt 3 with Vue 3 Composition API (`<script setup>` syntax)
- **Deployment**: Cloudflare Workers (single-worker architecture)
- **Real-time**: Durable Objects with WebSocket Hibernation API
- **Database**: Cloudflare D1 (configured for future persistence)
- **Styling**: Tailwind CSS
- **Testing**: Vitest with @cloudflare/vitest-pool-workers
- **Package Manager**: pnpm (v10.15.0)
- **Node Version**: v22 (LTS)

## Essential Commands

### Development
```bash
# Install dependencies
pnpm install

# Start local dev server (Nuxt dev mode)
pnpm dev

# Preview production build locally with Wrangler
pnpm preview

# Deploy to Cloudflare Workers
pnpm deploy
```

### Testing
```bash
# Run all tests
pnpm test

# Run tests with UI
pnpm test:ui

# Run tests with coverage
pnpm test:coverage

# Run tests in watch mode (default)
vitest

# Run single test file
vitest server/poker-room.test.ts

# Run tests without watch mode
pnpm test --run
```

### Type Generation
```bash
# Generate Cloudflare Workers types from wrangler.jsonc
pnpm cf-typegen
```

### Build
```bash
# Build for production
pnpm build
# Output: .output/server/index.mjs (Nitro server) + .output/public/ (static assets)
```

## Architecture

### Single-Worker Architecture

The app uses a **custom worker entrypoint** (`worker.ts`) that routes requests:

1. **WebSocket requests** (`/api/room/[id]/ws`) → Durable Object (PokerRoom)
2. **All other requests** → Nuxt/Nitro handler

```
Request → worker.ts
          ├─ /api/room/*/ws + Upgrade: websocket → Durable Object
          └─ /* → .output/server/index.mjs (Nuxt)
```

**Key file**: `worker.ts:14-25` - WebSocket routing logic intercepts upgrade requests before they reach Nuxt.

### Durable Object (PokerRoom)

**Location**: `server/poker-room.ts`

Each room is a Durable Object instance that:
- Manages WebSocket connections using the Hibernation API
- Stores room state (participants, votes, story title) in-memory
- Broadcasts state changes to all connected clients
- Handles heartbeat pings every 30 seconds
- Persists session metadata via `ws.serializeAttachment()`

**State structure**:
```typescript
{
  participants: Record<userId, { name, vote }>,
  votesRevealed: boolean,
  storyTitle: string
}
```

**Critical implementation details**:
- Uses `webSocketMessage()`, `webSocketClose()`, `webSocketError()` handlers (Hibernation API)
- Session recovery: `ws.deserializeAttachment()` restores user state after hibernation
- Rate limiting: 10 messages/second per connection, max 100 connections per DO
- Heartbeat cleanup: `heartbeatIntervals` Map tracks intervals to prevent memory leaks

### Client State Management

**Location**: `composables/usePokerRoom.ts`

The `usePokerRoom` composable handles:
- WebSocket connection lifecycle
- Auto-reconnection with exponential backoff (max 10 attempts)
- Session persistence via localStorage
- Client-side heartbeat responses (pong)

**Connection flow**:
1. Check localStorage for existing session (`poker-session-{roomId}`)
2. Connect to WebSocket endpoint
3. Send `join` message with name
4. Receive `update` messages with room state
5. On disconnect: exponential backoff (1s → 30s max delay)

### Component Structure

- **pages/index.vue**: Landing page with room creation
- **pages/room/[id].vue**: Room page that uses `usePokerRoom` composable
- **components/VotingArea.vue**: Voting cards (0, 1, 2, 3, 5, 8, 13, etc.)
- **components/ParticipantList.vue**: Shows all participants and their votes
- **components/UserNameModal.vue**: Name input modal for new users
- **components/Card.vue**: Reusable card component

## Important Configuration Files

### wrangler.jsonc
- Defines Durable Object binding: `POKER_ROOM` → `PokerRoom` class
- Sets compatibility date: `2025-06-28`
- Enables observability for production monitoring
- Assets binding points to `.output/public/`

### nuxt.config.ts
- Nitro preset: `cloudflare_module`
- Inlines `server/poker-room.ts` to ensure it's bundled correctly
- Compatibility version: 4 (future mode)

### vitest.config.ts
- Uses `@cloudflare/vitest-pool-workers` for testing Durable Objects
- References `wrangler.jsonc` for configuration
- Enables `nodejs_compat` flag for testing

## Development Workflow

### Creating a New Room Feature

1. **Modify Durable Object**: Update `server/poker-room.ts` to handle new message type
2. **Update Client Composable**: Add new method to `composables/usePokerRoom.ts`
3. **Update UI**: Use the new method in Vue components
4. **Add Tests**: Write tests in `server/poker-room.test.ts` and component tests
5. **Type Safety**: Ensure message types are defined in both client and server

### Testing Durable Objects Locally

```bash
# Start dev server (includes Durable Objects)
pnpm dev

# In another terminal, run tests
pnpm test
```

The test suite uses Miniflare (embedded in vitest-pool-workers) to simulate Durable Objects locally.

### Debugging WebSocket Issues

1. Check browser DevTools → Network → WS tab for WebSocket frames
2. Look for `type: "error"` messages from server
3. Check heartbeat interval cleanup (common memory leak source)
4. Verify session attachment serialization for hibernation issues

## Known Issues & Gotchas

### Session Persistence
Sessions are stored in two places:
1. **Client**: localStorage (`poker-session-{roomId}`)
2. **Server**: `ws.serializeAttachment()` (survives hibernation)

If sessions don't persist across page refreshes, check both mechanisms.

### WebSocket Routing
The Nuxt API route at `server/api/room/[id]/ws.get.ts` is **NOT USED**. WebSocket requests are intercepted by `worker.ts` before reaching Nuxt. Do not modify the API route file.

### Heartbeat Management
Always clean up heartbeat intervals in `webSocketClose()` to prevent memory leaks. The `heartbeatIntervals` Map tracks all active intervals.

### Reconnection Logic
The client attempts reconnection with exponential backoff (max 10 attempts). After max attempts, the user must manually refresh. Consider showing a UI notification when max retries are reached.

## Code Patterns

### Message Protocol
All WebSocket messages follow this structure:
```typescript
{
  type: 'join' | 'vote' | 'reveal' | 'reset' | 'update' | 'error' | 'ping' | 'pong',
  payload?: any
}
```

### Error Handling
Server errors are sent as:
```typescript
ws.send(JSON.stringify({
  type: 'error',
  payload: { message: 'Error description' }
}))
```

Client should handle `type: 'error'` in message handler.

### Input Validation
All user inputs (names, votes) are validated server-side:
- Names: Max 50 characters, trimmed
- Messages: Max 10KB size
- Rate limiting: Max 10 messages/second

## Testing Strategy

### Unit Tests
- `server/poker-room.test.ts`: Durable Object message handling, state management
- `server/api/room/create.post.test.ts`: Room creation endpoint

### Test Patterns
```typescript
// Durable Object test
const id = env.POKER_ROOM.idFromName('test-room')
const stub = env.POKER_ROOM.get(id)
const response = await stub.fetch(request)
```

## Deployment

### Automatic Deployment
- Pushes to `main` branch trigger automatic deployment via Cloudflare Dashboard GitHub integration
- Build artifacts are generated by `pnpm build`
- Deployment uses `wrangler.jsonc` configuration

### Manual Deployment
```bash
pnpm deploy
```

### Monitoring
- Observability enabled in `wrangler.jsonc`
- View logs in Cloudflare Dashboard → Workers & Pages → planning-poker → Logs

## File References

When discussing code, use the pattern `file_path:line_number` for clarity:
- `worker.ts:14-25` - WebSocket routing logic
- `server/poker-room.ts:278-291` - Heartbeat implementation
- `composables/usePokerRoom.ts:150-164` - Reconnection logic

## Additional Context

See `CONTEXT.md` for project overview and `IMPLEMENTATION_PLAN.md` for completed implementation phases and known issues.
