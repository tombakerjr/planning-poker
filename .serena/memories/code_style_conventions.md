# Code Style & Conventions

## Linting & Formatting
- **ESLint**: v9 flat config (eslint.config.mjs)
- **Semicolons**: Required (always)
- **Quotes**: Single quotes preferred
- **Trailing commas**: Required in multiline
- **Import sorting**: Enforced via perfectionist plugin
- **Auto-fix on commit**: Husky + lint-staged runs `eslint --fix` on staged files
- **CI**: GitHub Actions runs lint + tests on PRs and pushes to main

## TypeScript
- All code is written in TypeScript
- Type definitions for Cloudflare Workers are generated via `pnpm cf-typegen`
- Worker types are defined in `worker-configuration.d.ts`

## Vue Components
- Use **Composition API** exclusively
- Use **`<script setup>` syntax** for all components
- Component files use PascalCase: `UserNameModal.vue`, `VotingArea.vue`

## Styling
- **Tailwind CSS utilities only** - no custom CSS classes
- Tailwind v4+ configuration

## File Naming
- Components: PascalCase (e.g., `Card.vue`, `ParticipantList.vue`)
- Composables: camelCase with `use` prefix (e.g., `usePokerRoom.ts`, `useToast.ts`)
- Pages: kebab-case with dynamic segments (e.g., `[id].vue`)
- Server files: kebab-case (e.g., `poker-room.ts`)

## Code Patterns

### WebSocket Message Handling
Server-side error responses:
```typescript
ws.send(JSON.stringify({
  type: 'error',
  payload: { message: 'Error description' }
}))
```

### Input Validation
All user inputs are validated server-side:
- Names: Max 50 characters, trimmed
- Messages: Max 10KB size
- Rate limiting: Max 10 messages/second per connection

### Session Management
Sessions stored in two places:
1. **Client**: localStorage (`poker-session-{roomId}`)
2. **Server**: `ws.serializeAttachment()` (survives hibernation)

### Error Handling
- Client handles `type: 'error'` in message handler
- Always clean up heartbeat intervals in `webSocketClose()` to prevent memory leaks

## File References
When discussing code, use the pattern `file_path:line_number` for clarity.
