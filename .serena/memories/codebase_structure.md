# Codebase Structure

## Root Level
```
planning-poker/
├── worker.ts                    # Custom worker entrypoint (WebSocket routing)
├── app.vue                      # Root Vue component
├── wrangler.jsonc              # Cloudflare Workers configuration
├── nuxt.config.ts              # Nuxt configuration
├── vitest.config.ts            # Test configuration
├── playwright.config.ts        # E2E test configuration
├── tsconfig.json               # TypeScript configuration
├── package.json                # Dependencies and scripts
├── CLAUDE.md                   # Claude Code guidance (this file)
├── CONTEXT.md                  # Project context
└── IMPLEMENTATION_PLAN.md      # Implementation phases
```

## Server Directory (`server/`)
```
server/
├── poker-room.ts               # Durable Object implementation (core logic)
├── poker-room.test.ts          # Durable Object unit tests
├── index.ts                    # Server entry point
├── api/                        # API routes
│   ├── room/
│   │   ├── create.post.ts      # Room creation endpoint
│   │   ├── create.post.test.ts # Room creation tests
│   │   └── [id]/
│   │       └── ws.get.ts       # WebSocket route (NOT USED - see worker.ts)
├── utils/                      # Server utilities
└── plugins/                    # Server plugins
```

## Pages Directory (`pages/`)
```
pages/
├── index.vue                   # Landing page with room creation
└── room/
    └── [id].vue               # Room page (uses usePokerRoom composable)
```

## Components Directory (`components/`)
```
components/
├── Card.vue                    # Reusable card component
├── VotingArea.vue             # Voting cards (0, 1, 2, 3, 5, 8, 13, etc.)
├── ParticipantList.vue        # Shows all participants and their votes
├── UserNameModal.vue          # Name input modal for new users
└── ToastContainer.vue         # Toast notifications
```

## Composables Directory (`composables/`)
```
composables/
├── usePokerRoom.ts            # WebSocket connection, auto-reconnection, state management
└── useToast.ts                # Toast notification management
```

## Test Directories
```
e2e/                           # Playwright E2E tests
coverage/                      # Test coverage reports
```

## Build Output
```
.output/
├── server/
│   └── index.mjs             # Built Nitro server
└── public/                   # Static assets
```

## Key File References
- `worker.ts:14-25` - WebSocket routing logic
- `server/poker-room.ts:278-291` - Heartbeat implementation
- `composables/usePokerRoom.ts:150-164` - Reconnection logic
- `server/poker-room.ts` - Durable Object message handling, state management
- `server/api/room/create.post.ts` - Room creation endpoint
