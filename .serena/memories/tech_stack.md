# Technology Stack

## Core Technologies
- **Framework**: Nuxt 3 (v3.17.5+)
- **Frontend**: Vue 3 (v3.5.17+) with Composition API
- **Deployment**: Cloudflare Workers (single-worker architecture)
- **Real-time**: Cloudflare Durable Objects with WebSocket Hibernation API
- **Database**: Cloudflare D1 (configured for future persistence)
- **Styling**: Tailwind CSS (v4.1.11+)

## Development Tools
- **Package Manager**: pnpm (v10.19.0)
- **Node Version**: v22 (LTS) - enforced via .nvmrc
- **Language**: TypeScript
- **Testing**: Vitest (v3.2.4+) with @cloudflare/vitest-pool-workers
- **E2E Testing**: Playwright (v1.56.1+)
- **Build Tool**: Nitro with cloudflare_module preset

## Key Dependencies
- **@vueuse/core**: Vue composables utilities
- **nanoid**: Unique ID generation for rooms
- **h3**: HTTP framework (used by Nitro)
- **wrangler**: Cloudflare Workers CLI (v4.22.0+)

## Configuration Files
- `wrangler.jsonc`: Defines Durable Object bindings, compatibility date, observability
- `nuxt.config.ts`: Nitro preset (cloudflare_module), compatibility version 4
- `vitest.config.ts`: Uses vitest-pool-workers for Durable Object testing
- `playwright.config.ts`: E2E test configuration
- `tsconfig.json`: Extends .nuxt/tsconfig.json with worker types
