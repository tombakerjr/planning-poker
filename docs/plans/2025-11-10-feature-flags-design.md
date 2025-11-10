# Feature Flags System Design

**Date:** 2025-11-10
**Status:** Approved
**Author:** Claude Code (with tombakerjr)

## Overview

Implement a feature flag system using Flargd (self-hosted on Cloudflare Workers) to replace hardcoded constants and enable runtime configuration control without redeployment.

## Goals

- Replace hardcoded constants (timeouts, limits, log levels) with configurable flags
- Add feature toggles for potentially expensive Cloudflare operations
- Implement master kill switch for emergency app shutdown
- Support multiple projects (planning-poker, blog, future apps) from single Flargd instance
- Provide near-realtime updates (within 10 seconds via client polling)
- Maintain high availability with graceful fallback to defaults

## Non-Goals

- Real-time WebSocket/SSE flag updates (documented as future enhancement)
- A/B testing or experimentation features
- Per-user flag targeting (Flargd doesn't support this)
- Flag change audit logging (may add later)

## Architecture

### Component Overview

```
┌─────────────────────────────────────────────────────────────┐
│                     Flargd (Separate Repo)                  │
│  ┌──────────────────┐         ┌─────────────────────────┐  │
│  │  Admin UI Worker │────────▶│   Flargd API Worker     │  │
│  │ (Cloudflare      │         │ (serves flags via HTTP) │  │
│  │  Access protected)│         └───────────┬─────────────┘  │
│  └──────────────────┘                     │                │
│           │                               │                │
│           ▼                               ▼                │
│    ┌──────────────────────────────────────────┐            │
│    │     FLARGD_FLAGS (KV Namespace)          │            │
│    │  Multi-project: planning-poker:*, blog:* │            │
│    └──────────────────────────────────────────┘            │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼ HTTP GET /api/flags/getMany
┌─────────────────────────────────────────────────────────────┐
│              Planning Poker Worker (Main App)               │
│  ┌──────────────────────────────────────────────────────┐   │
│  │  worker.ts: Check APP_ENABLED kill switch first     │   │
│  └──────────────────────────────────────────────────────┘   │
│  ┌──────────────────────────────────────────────────────┐   │
│  │  server/utils/config.ts: Config Service              │   │
│  │  - Fetches flags from Flargd API                     │   │
│  │  - Caches in FLAGS_CACHE KV (5min fresh, 60min stale)│  │
│  │  - Falls back to hardcoded defaults                  │   │
│  └──────────────────────────────────────────────────────┘   │
│  ┌──────────────────────────────────────────────────────┐   │
│  │  server/api/flags.get.ts: Flags API endpoint         │   │
│  │  - Returns all flags as JSON for client polling      │   │
│  └──────────────────────────────────────────────────────┘   │
│                              │                              │
│                              ▼                              │
│  ┌──────────────────────────────────────────────────────┐   │
│  │     FLAGS_CACHE (KV Namespace)                       │   │
│  │  Cache key: planning-poker:version + flags           │   │
│  └──────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼ Poll every 10s
┌─────────────────────────────────────────────────────────────┐
│                    Client (Nuxt/Vue)                        │
│  ┌──────────────────────────────────────────────────────┐   │
│  │  composables/useFeatureFlags.ts                      │   │
│  │  - Polls GET /api/flags every 10 seconds             │   │
│  │  - Provides reactive flags to components             │   │
│  └──────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────┘
```

### Repository Structure

**New Flargd Repo** (`/home/tbaker/workspace/flargd/`)
```
/flargd/
  /api/
    wrangler.jsonc       # Flargd API worker config
    index.ts             # Flargd API implementation
  /admin/
    wrangler.jsonc       # Flargd Admin UI worker config
    index.ts             # Admin UI implementation
  README.md              # Deployment & usage instructions
  package.json           # Dependencies
```

**Planning Poker Updates** (existing repo)
```
/planning-poker/
  server/
    utils/
      config.ts          # NEW: Config service
    api/
      flags.get.ts       # NEW: Flags API endpoint
    poker-room.ts        # MODIFIED: Use config instead of constants
  composables/
    useFeatureFlags.ts   # NEW: Client-side flag polling
  worker.ts              # MODIFIED: Add kill switch check
  wrangler.jsonc         # MODIFIED: Add FLARGD_API_URL, FLAGS_CACHE binding
  docs/
    plans/
      2025-11-10-feature-flags-design.md  # This document
```

## Data Flow & Caching

### Server-Side Flag Resolution

```
1. Request needs flag value (e.g., HEARTBEAT_INTERVAL_MS)
   ↓
2. Check FLAGS_CACHE KV (key: "planning-poker:cache")
   ├─ Cache fresh (<5 min) → Return cached value
   ├─ Cache stale (5-60 min) → Continue to step 3, fallback if needed
   └─ Cache miss → Continue to step 3
   ↓
3. Fetch from Flargd API: GET /api/flags/getMany?app=planning-poker
   ├─ Success → Update cache, return value
   └─ Error/timeout → Continue to step 4
   ↓
4. Check stale cache (<60 min old)
   ├─ Exists → Log warning, return stale value
   └─ Missing → Continue to step 5
   ↓
5. Use hardcoded default value
   └─ Log error (indicates total system failure)
```

### Client-Side Flag Polling

```
1. Page load → Immediate fetch from GET /api/flags
   ↓
2. Every 10 seconds → Poll GET /api/flags
   ├─ Success → Update reactive ref
   └─ Error → Keep last known state, log warning
   ↓
3. Components access flags reactively: flags.value.ENABLE_ANALYTICS
```

### Cache Invalidation (Future Enhancement)

Currently: Flags update within 10 seconds via client polling + 5-minute server cache.

Future: Add webhook endpoint for instant invalidation when flags change in Admin UI.

## Flag Definitions

### Initial Flags (planning-poker project)

| Flag Name | Type | Default | Description |
|-----------|------|---------|-------------|
| `APP_ENABLED` | boolean | `true` | Master kill switch - disables entire app |
| `HEARTBEAT_INTERVAL_MS` | number | `30000` | WebSocket heartbeat interval (30s) |
| `AUTO_REVEAL_DELAY_MS` | number | `150` | Delay before auto-revealing votes |
| `MAX_MESSAGE_SIZE` | number | `10240` | Max WebSocket message size (10KB) |
| `MAX_CONNECTIONS_PER_DO` | number | `100` | Max connections per Durable Object |
| `MAX_MESSAGES_PER_SECOND` | number | `10` | Rate limit: messages per second |
| `RATE_LIMIT_WINDOW_MS` | number | `1000` | Rate limit window (1 second) |
| `LOG_LEVEL` | string | `"WARN"` | Logging level: DEBUG, INFO, WARN, ERROR |

### Future Flags (examples)

- `ENABLE_ANALYTICS`: Toggle analytics tracking
- `ENABLE_ROOM_HISTORY`: Toggle room history persistence
- `ENABLE_ADVANCED_VOTING`: Toggle new voting UI features

## Implementation Details

### Config Service (`server/utils/config.ts`)

```typescript
interface FlagDefaults {
  APP_ENABLED: boolean
  HEARTBEAT_INTERVAL_MS: number
  AUTO_REVEAL_DELAY_MS: number
  MAX_MESSAGE_SIZE: number
  MAX_CONNECTIONS_PER_DO: number
  MAX_MESSAGES_PER_SECOND: number
  RATE_LIMIT_WINDOW_MS: number
  LOG_LEVEL: 'DEBUG' | 'INFO' | 'WARN' | 'ERROR'
}

class Config {
  constructor(
    private env: Env,
    private projectId: string,
    private defaults: FlagDefaults
  ) {}

  async get<K extends keyof FlagDefaults>(
    key: K
  ): Promise<FlagDefaults[K]> {
    // 1. Check FLAGS_CACHE KV
    // 2. Fetch from FLARGD_API_URL if needed
    // 3. Fall back to stale cache or defaults
    // 4. Return typed value
  }
}

export async function getConfig(env: Env, projectId: string): Promise<Config> {
  return new Config(env, projectId, HARDCODED_DEFAULTS)
}
```

### Master Kill Switch (`worker.ts`)

```typescript
export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    // Check kill switch BEFORE routing
    const config = await getConfig(env, 'planning-poker')
    if (!config.get('APP_ENABLED')) {
      return new Response(
        `<!DOCTYPE html>
        <html>
          <head>
            <title>Under Maintenance</title>
            <style>
              body {
                font-family: system-ui;
                display: flex;
                align-items: center;
                justify-content: center;
                height: 100vh;
                margin: 0;
                background: #f3f4f6;
              }
              .container { text-align: center; }
              h1 { color: #1f2937; }
              p { color: #6b7280; }
            </style>
          </head>
          <body>
            <div class="container">
              <h1>We'll be back soon!</h1>
              <p>Planning Poker is currently under maintenance.</p>
            </div>
          </body>
        </html>`,
        {
          status: 503,
          headers: { 'Content-Type': 'text/html' }
        }
      )
    }

    // Normal routing continues...
  }
}
```

### Client Composable (`composables/useFeatureFlags.ts`)

```typescript
// TODO: Future enhancement - WebSocket/SSE for real-time updates
// Current approach: HTTP polling every 10 seconds
//
// WebSocket approach would require:
//   - New FlagsConnection Durable Object
//   - Client WebSocket connection management
//   - Server-side broadcast mechanism when flags change in Flargd Admin UI
//   - Additional complexity but <1 second update latency
//
// Current polling is simpler and adequate for config values.
// WebSocket makes more sense for user-facing feature toggles.

export function useFeatureFlags() {
  const { data, refresh } = useFetch('/api/flags', {
    // Poll every 10 seconds
    server: false,
    lazy: true,
  })

  // Auto-refresh interval
  const intervalId = setInterval(refresh, 10000)

  onUnmounted(() => clearInterval(intervalId))

  return computed(() => data.value || {})
}
```

## Error Handling & Fallback

### Failure Scenarios

| Scenario | Behavior | User Impact |
|----------|----------|-------------|
| Flargd API timeout | Use stale cache (up to 60 min) | None if cache exists, minimal if defaults used |
| Flargd returns 404 for flag | Use hardcoded default for that flag | Expected behavior for new flags |
| FLAGS_CACHE KV unavailable | Fetch from Flargd, skip caching | Slightly slower responses |
| Both cache + Flargd down | Use all hardcoded defaults | App continues normally with default config |
| Client poll fails | Keep last known state, retry in 10s | Stale flags until next successful poll |
| Invalid flag type/value | Reject and use default | Protects against bad data |

### Logging & Observability

- **WARN**: Using stale cache (indicates Flargd issues needing investigation)
- **ERROR**: Using hardcoded defaults (indicates total flag system failure)
- **INFO**: Cache hit/miss rates (debugging/optimization)
- **DEBUG**: Individual flag resolutions (verbose troubleshooting)

Leverage existing Cloudflare observability (enabled in `wrangler.jsonc`) to track:
- Flargd API call success rates
- Cache hit ratios
- Flag fetch latencies
- Fallback usage frequency

## Security

### Flargd Admin UI Protection

Use Cloudflare Access (Zero Trust) to protect `flargd-admin.tombaker.workers.dev`:

1. Create Access Application in Cloudflare Dashboard
2. Set application domain: `flargd-admin.tombaker.workers.dev`
3. Add policy: Allow if email is `your-email@example.com`
4. Require authentication before accessing Admin UI

No code changes needed - handled entirely by Cloudflare Access.

### Flargd API Security

The API endpoint (`flargd-api.tombaker.workers.dev`) is intentionally public:
- Read-only access to flag values
- No sensitive data in flags (just config values)
- Writing flags requires Admin UI (protected by Access)

Future: Add API key authentication if needed for rate limiting.

## Testing Strategy

### Unit Tests

**Config Service** (`server/utils/config.test.ts`):
- Returns flag value from fresh cache
- Fetches from Flargd API on cache miss
- Uses stale cache when Flargd is down
- Falls back to defaults when cache and Flargd unavailable
- Validates flag types and rejects invalid values
- Handles Flargd timeout gracefully

**Client Composable** (`composables/useFeatureFlags.test.ts`):
- Polls `/api/flags` every 10 seconds
- Provides reactive flag access
- Handles API errors gracefully (keeps last state)

### Integration Tests

**Poker Room** (`server/poker-room.test.ts`):
- Uses configurable heartbeat interval from flags
- Respects MAX_CONNECTIONS from flags
- Applies LOG_LEVEL from flags

**Worker** (`worker.test.ts`):
- Returns maintenance page when APP_ENABLED is false
- Routes normally when APP_ENABLED is true

### Manual Testing Checklist

1. ✅ Deploy Flargd with default flag values
2. ✅ Verify planning-poker loads and works normally
3. ✅ Toggle `APP_ENABLED` to `false` in Admin UI → see maintenance page within 10s
4. ✅ Change `HEARTBEAT_INTERVAL_MS` to `15000` → verify faster heartbeats
5. ✅ Change `LOG_LEVEL` to `DEBUG` → verify increased logging
6. ✅ Stop Flargd API Worker → verify app continues with cached/default values
7. ✅ Clear FLAGS_CACHE KV + stop Flargd → verify hardcoded defaults work

## Deployment Plan

### Phase 1: Set up Flargd (separate repo)

1. Clone upstream Flargd repository to `/home/tbaker/workspace/flargd/`
2. Configure `wrangler.jsonc` files for API and Admin workers
3. Create `FLARGD_FLAGS` KV namespace: `wrangler kv:namespace create "FLARGD_FLAGS"`
4. Deploy API worker: `cd api && wrangler deploy`
5. Deploy Admin UI worker: `cd admin && wrangler deploy`
6. Note deployed URLs (e.g., `flargd-api.tombaker.workers.dev`)

### Phase 2: Configure Cloudflare Access

1. Go to Cloudflare Dashboard → Zero Trust → Access → Applications
2. Create new application for `flargd-admin.tombaker.workers.dev`
3. Add policy: Allow if email matches your email
4. Test authentication flow

### Phase 3: Initialize flags in Flargd

1. Log into Flargd Admin UI (authenticate via Cloudflare Access)
2. Create project: `planning-poker`
3. Add all initial flags with default values (see Flag Definitions table)
4. Test flag retrieval: `curl https://flargd-api.tombaker.workers.dev/api/flags/getMany?app=planning-poker`

### Phase 4: Update planning-poker

1. Create `FLAGS_CACHE` KV namespace: `wrangler kv:namespace create "FLAGS_CACHE"`
2. Update `wrangler.jsonc`:
   - Add environment variable: `FLARGD_API_URL = "https://flargd-api.tombaker.workers.dev"`
   - Add KV binding: `FLAGS_CACHE`
3. Implement config service (`server/utils/config.ts`)
4. Implement flags API endpoint (`server/api/flags.get.ts`)
5. Implement client composable (`composables/useFeatureFlags.ts`)
6. Update `worker.ts`: Add kill switch check
7. Update `server/poker-room.ts`: Replace constants with `config.get()` calls
8. Write tests
9. Deploy: `pnpm deploy`
10. Manual testing checklist

### Phase 5: Documentation

1. Create `flargd/README.md` with deployment instructions
2. Update `planning-poker/CLAUDE.md` with feature flags section
3. Commit this design document

## Future Enhancements

### Real-time Flag Updates (WebSocket/SSE)

Replace client polling with push-based updates:

**Approach:**
- New `FlagsConnection` Durable Object
- Clients connect via `wss://.../api/flags/ws`
- Flargd Admin UI triggers webhook on flag change
- Webhook endpoint invalidates cache + broadcasts to all connected clients
- Updates within 1-2 seconds instead of 10 seconds

**Trade-offs:**
- More complex (additional DO, WebSocket lifecycle management)
- Better UX for user-facing feature toggles
- Minimal cost increase (WebSocket connections are cheap)

### Flag Change Audit Log

Track who changed which flags when:
- Store in D1 database
- Display in Admin UI
- Useful for debugging "who changed this?"

### Per-User Flag Overrides

Target flags to specific users:
- Requires custom logic (Flargd doesn't support this natively)
- Use case: Beta features for specific users
- Implementation: Check user ID against override list before returning flag value

### A/B Testing Support

Multi-variant flags for experimentation:
- Flargd doesn't support this
- Would require switching to GrowthBook or building custom logic
- Defer until needed

## Risks & Mitigations

| Risk | Impact | Mitigation |
|------|--------|-----------|
| Flargd outage breaks app | High | Multi-layer fallback (stale cache → defaults) |
| Flargd beta status causes breaking changes | Medium | Pin to specific version, test upgrades |
| Flag misconfiguration breaks app | High | Type validation, sane defaults, easy rollback |
| Cache invalidation delay causes confusion | Low | Document 5-minute cache TTL, manual testing |
| Client polling increases costs | Low | 10s interval is conservative, monitor usage |

## Success Metrics

- ✅ All hardcoded constants replaced with flags
- ✅ Master kill switch works (maintenance page within 10s)
- ✅ Config changes apply without redeployment
- ✅ App remains available during Flargd outages (fallback to defaults)
- ✅ Client sees flag updates within 10 seconds
- ✅ No noticeable performance degradation

## References

- Flargd GitHub: https://github.com/pmbanugo/flargd
- Cloudflare Access Docs: https://developers.cloudflare.com/cloudflare-one/applications/
- Cloudflare KV Docs: https://developers.cloudflare.com/kv/
