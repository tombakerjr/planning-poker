# Technology Stack

## Core Technologies
- **Framework**: Nuxt 3 (v3.17.5+)
- **Frontend**: Vue 3 (v3.5.17+) with Composition API
- **Deployment**: Cloudflare Workers (single-worker architecture)
- **Real-time**: Cloudflare Durable Objects with WebSocket Hibernation API
- **Database**: Cloudflare D1 (configured for future persistence)
- **Feature Flags**: GrowthBook SDK Webhooks with FLAGS_CACHE KV namespace
- **Styling**: Tailwind CSS (v4.1.11+)

## Development Tools
- **Package Manager**: pnpm (v10.19.0)
- **Node Version**: v22 (LTS) - enforced via .nvmrc
- **Language**: TypeScript
- **Testing**: Vitest (v3.2.4+) with @cloudflare/vitest-pool-workers
- **E2E Testing**: Playwright (v1.56.1+)
- **Build Tool**: Nitro with cloudflare_module preset

## Key Dependencies
- **@vueuse/core**: Vue composables utilities (v13.4.0+)
- **nanoid**: Unique ID generation for rooms (v5.1.5+)
- **h3**: HTTP framework (v1.15.3+) - used by Nitro
- **wrangler**: Cloudflare Workers CLI (v4.22.0+)
- **vue-router**: Vue routing (v4.5.1+)

## Testing Dependencies
- **@cloudflare/vitest-pool-workers**: Durable Object testing (v0.9.13+)
- **@vitest/coverage-v8**: Code coverage (v3.2.4+)
- **@vitest/ui**: Test UI (v3.2.4+)
- **@vue/test-utils**: Vue component testing (v2.4.6+)
- **happy-dom**: DOM simulation (v20.0.5+)
- **@playwright/test**: E2E testing (v1.56.1+)

## Configuration Files
- `wrangler.jsonc`: Defines Durable Object bindings, KV namespaces (FLAGS_CACHE), compatibility date (2025-06-28), observability
- `nuxt.config.ts`: Nitro preset (cloudflare_module), compatibility version 4
- `vitest.config.ts`: Uses vitest-pool-workers for Durable Object testing
- `playwright.config.ts`: E2E test configuration
- `tsconfig.json`: Extends .nuxt/tsconfig.json with worker types
- `tailwind.config.ts`: Tailwind CSS v4 configuration

## Feature Flags (via GrowthBook)
Available flags configured in `server/utils/config.ts`:
- `APP_ENABLED`: Master kill switch
- `HEARTBEAT_INTERVAL_MS`: WebSocket heartbeat interval (default 30000)
- `AUTO_REVEAL_DELAY_MS`: Delay before auto-reveal (default 150)
- `MAX_MESSAGE_SIZE`: Max WebSocket message size (default 10240)
- `MAX_CONNECTIONS_PER_DO`: Max connections per Durable Object (default 100)
- `MAX_MESSAGES_PER_SECOND`: Rate limit (default 10)
- `RATE_LIMIT_WINDOW_MS`: Rate limit window (default 1000)
- `LOG_LEVEL`: DEBUG | INFO | WARN | ERROR (default WARN)
