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
- **Linting**: ESLint v9 flat config with TypeScript, Vue, and stylistic rules
- **Testing**: Vitest with @cloudflare/vitest-pool-workers
- **Package Manager**: pnpm (v10.19.0)
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

### End-to-End Testing
```bash
# Run all E2E tests (requires dev server running)
pnpm test:e2e

# Run E2E tests with UI
pnpm test:e2e:ui

# Run E2E tests in debug mode
pnpm test:e2e:debug

# Run specific E2E test file
pnpm test:e2e e2e/room-creation.spec.ts
```

### Linting
```bash
# Check all files for linting errors
pnpm lint

# Auto-fix linting and formatting issues
pnpm lint:fix
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

**Key file**: `worker.ts:80-93` - WebSocket routing logic intercepts upgrade requests before they reach Nuxt.

**Kill Switch**: The worker includes a master kill switch (`APP_ENABLED` flag) that returns a maintenance page (503) when disabled. Flag values are cached for 60 seconds to minimize KV reads.

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
- Feature flags: Configurable via GrowthBook SDK Webhooks (stored in FLAGS_CACHE KV)

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

### ⚠️ IMPORTANT: Branch Protection Rules

**Branch protection is enabled on `main`:**
- ✅ Pull requests are REQUIRED for all changes
- ❌ Direct pushes to `main` are BLOCKED
- ✅ All automated checks must pass before merging
- ✅ Human review required before merge

**This applies to ALL Claude Code sessions:**
- Local development
- Web interface
- GitHub Actions
- Any automated workflows

**Never attempt to:**
- Commit directly to `main`
- Push to `main` without a PR
- Merge without passing checks

### Standard GitHub Issue Workflow

When working on a GitHub issue, follow this standardized process:

1. **Start from main branch**
   ```bash
   git checkout main
   git pull origin main
   ```

2. **Create feature branch** from the issue number
   ```bash
   git checkout -b phase{X}-{brief-description}
   # Example: phase4b-performance-optimizations
   ```

3. **Implement the feature**
   - Make code changes
   - Add/update tests
   - Update documentation as needed
   - Run tests to verify: `pnpm test --run`

4. **Commit and push**
   ```bash
   git add .
   git commit -m "Phase X: Brief description"
   git push origin {branch-name}
   ```

5. **Open Pull Request**
   ```bash
   gh pr create --title "Phase X: Description" --body "..."
   ```

6. **Wait for automated checks** (2-3 minutes)
   - **Claude Code Review**: Comprehensive senior-level review (security, bugs, quality, performance, tests). Comments posted to PR are concise and prioritized.
   - **Cloudflare deployment check**: Verifies build succeeds

7. **Review and address feedback**
   - Check Claude Code review comments
   - Verify Cloudflare deployment succeeded
   - Address any critical issues found
   - Push additional commits if needed

8. **Wait for human review and merge**
   - PR is ready for final review
   - Wait for approval from human reviewer
   - Human reviewer or automated workflow will merge PR
   - Never attempt to merge directly (branch protection enforced)

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
  type: 'join' | 'vote' | 'reveal' | 'reset' | 'setStory' | 'setScale' | 'setAutoReveal' | 'update' | 'error' | 'ping' | 'pong',
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

### Feature Flags (GrowthBook)
Feature flags are managed via GrowthBook SDK Webhooks:
- **Location**: `server/utils/config.ts`
- **Storage**: FLAGS_CACHE KV namespace
- **Updates**: GrowthBook pushes payload to KV via webhook (instant updates)
- **Fallback**: Hardcoded defaults if KV read fails

Available flags:
```typescript
APP_ENABLED: boolean           // Master kill switch
HEARTBEAT_INTERVAL_MS: number  // WebSocket heartbeat interval
AUTO_REVEAL_DELAY_MS: number   // Delay before auto-reveal
MAX_MESSAGE_SIZE: number       // Max WebSocket message size
MAX_CONNECTIONS_PER_DO: number // Max connections per Durable Object
MAX_MESSAGES_PER_SECOND: number // Rate limit
RATE_LIMIT_WINDOW_MS: number   // Rate limit window
LOG_LEVEL: 'DEBUG' | 'INFO' | 'WARN' | 'ERROR'
```

#### Production KV Setup
The `FLAGS_CACHE` KV namespace ID is **not committed** to version control for security.

**To configure production:**
1. Go to Cloudflare Dashboard → Workers & Pages → planning-poker
2. Click **Settings** → **Bindings**
3. Add a KV Namespace binding:
   - Variable name: `FLAGS_CACHE`
   - KV Namespace: Select your production namespace (or create one)
4. Save and deploy

**Local development** uses the preview namespace configured in `wrangler.jsonc` automatically.

## File References

When discussing code, use the pattern `file_path:line_number` for clarity:
- `worker.ts:80-93` - WebSocket routing logic
- `server/poker-room.ts:688-711` - Heartbeat implementation
- `composables/usePokerRoom.ts:426-477` - Reconnection logic
- `server/utils/config.ts` - Feature flag configuration

## Additional Context

See `CONTEXT.md` for project overview and `IMPLEMENTATION_PLAN.md` for completed implementation phases and known issues.

## Serena Memories

When using Serena MCP tools, the following memories are available for quick reference:
- **project_overview**: Core architecture, message protocol, key features
- **tech_stack**: Dependencies, versions, feature flags configuration
- **codebase_structure**: Directory layout, key file locations
- **suggested_commands**: All CLI commands for dev, test, build, deploy
- **code_style_conventions**: TypeScript, Vue, Tailwind patterns
- **testing_guide**: Vitest, Playwright, debugging tips
- **task_completion_checklist**: Step-by-step checklist for completing tasks

Use `mcp__serena__read_memory` to access these when working on specific areas.
