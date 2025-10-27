# Testing Guide

## Unit Testing with Vitest

### Test Framework
- **Vitest** with `@cloudflare/vitest-pool-workers` for Durable Object testing
- **Miniflare** embedded in vitest-pool-workers simulates Durable Objects locally
- **Test Utils**: `@vue/test-utils` for component testing
- **Environment**: `happy-dom` for DOM simulation

### Running Tests
```bash
# Run all tests in watch mode (default)
pnpm test

# Run tests without watch mode
pnpm test --run

# Run with UI
pnpm test:ui

# Run with coverage
pnpm test:coverage

# Run single test file
vitest server/poker-room.test.ts
```

### Test Patterns

#### Durable Object Testing
```typescript
// Example from server/poker-room.test.ts
const id = env.POKER_ROOM.idFromName('test-room')
const stub = env.POKER_ROOM.get(id)
const response = await stub.fetch(request)
```

#### Test Locations
- `server/poker-room.test.ts` - Durable Object message handling, state management
- `server/api/room/create.post.test.ts` - Room creation endpoint
- Component tests (to be added as needed)

## E2E Testing with Playwright

### Running E2E Tests
```bash
# Run all E2E tests
pnpm test:e2e

# Run with UI
pnpm test:e2e:ui

# Run in debug mode
pnpm test:e2e:debug

# Run in headed mode (see browser)
pnpm test:e2e:headed

# Run specific test file
pnpm test:e2e e2e/room-creation.spec.ts --reporter=list
```

### E2E Test Locations
- `e2e/` directory contains Playwright tests
- `e2e/room-creation.spec.ts` - Room creation flow

## Debugging Tips

### WebSocket Issues
1. Check browser DevTools → Network → WS tab for WebSocket frames
2. Look for `type: "error"` messages from server
3. Check heartbeat interval cleanup (common memory leak source)
4. Verify session attachment serialization for hibernation issues

### Local Development Testing
```bash
# Start dev server (includes Durable Objects)
pnpm dev

# In another terminal, run tests
pnpm test
```

## Test Configuration Files
- `vitest.config.ts` - Vitest configuration with vitest-pool-workers
- `playwright.config.ts` - Playwright E2E configuration
- Both reference `wrangler.jsonc` for Cloudflare Workers configuration
