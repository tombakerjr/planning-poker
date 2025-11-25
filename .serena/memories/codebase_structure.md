# Codebase Structure

## Root Level
```
planning-poker/
├── worker.ts                    # Custom worker entrypoint (WebSocket routing + kill switch)
├── app.vue                      # Root Vue component
├── wrangler.jsonc              # Cloudflare Workers configuration
├── nuxt.config.ts              # Nuxt configuration
├── vitest.config.ts            # Test configuration
├── playwright.config.ts        # E2E test configuration
├── tsconfig.json               # TypeScript configuration
├── tailwind.config.ts          # Tailwind CSS configuration
├── package.json                # Dependencies and scripts
├── CLAUDE.md                   # Claude Code guidance (primary reference)
├── CONTEXT.md                  # Project context
├── IMPLEMENTATION_PLAN.md      # Implementation phases
└── README.md                   # Project readme
```

## Server Directory (`server/`)
```
server/
├── poker-room.ts               # Durable Object implementation (core logic)
├── poker-room.test.ts          # Durable Object unit tests
├── index.ts                    # Server entry point
├── utils/
│   ├── config.ts              # Feature flags (GrowthBook integration)
│   └── logger.ts              # Logging utility
├── plugins/
│   └── durable-objects.ts     # Durable Objects plugin setup
└── api/                        # API routes
    └── room/
        ├── create.post.ts      # Room creation endpoint
        └── create.post.test.ts # Room creation tests
```

**Important Note**: WebSocket routing is handled entirely by `worker.ts`, not by Nuxt API routes.

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
├── ToastContainer.vue         # Toast notifications
├── ThemeToggle.vue            # Dark/light mode toggle
├── AutoRevealToggle.vue       # Auto-reveal votes toggle
└── VotingScaleSelector.vue    # Voting scale selector
```

## Composables Directory (`composables/`)
```
composables/
├── usePokerRoom.ts            # WebSocket connection, auto-reconnection, state management
├── useToast.ts                # Toast notification management
├── useColorMode.ts            # Theme/color mode management
└── useVotingScale.ts          # Voting scale management
```

## Test Directories
```
e2e/                           # Playwright E2E tests
├── room-creation.spec.ts
├── voting-flow.spec.ts
├── connection.spec.ts
└── multi-user.spec.ts
```

## Build Output
```
.output/
├── server/
│   └── index.mjs             # Built Nitro server
└── public/                   # Static assets
```

## Key File References
- `worker.ts:80-93` - WebSocket routing logic
- `server/poker-room.ts:688-711` - Heartbeat implementation
- `composables/usePokerRoom.ts:426-477` - Reconnection logic
- `server/utils/config.ts` - Feature flag configuration (GrowthBook)
