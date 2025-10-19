# Planning Poker - Incremental Improvement Plan

## Status: Active Development
**Last Updated:** 2025-10-19

This plan outlines incremental improvements to enhance security, reliability, performance, and user experience while maintaining high quality throughout development.

---

## Current State

**Completed:**
- ✅ Single-worker architecture with WebSocket Hibernation API
- ✅ Durable Objects with proper state management
- ✅ Real-time voting functionality
- ✅ Basic rate limiting (room creation)
- ✅ Input validation and sanitization
- ✅ Session persistence and recovery
- ✅ Reconnection with exponential backoff
- ✅ Error handling and user feedback
- ✅ Toast notification system
- ✅ Connection status indicators
- ✅ Loading states for actions
- ✅ Basic test coverage (11 tests passing)
- ✅ Production deployment at https://planning-poker.tombaker.workers.dev

**Current Gaps:**
- ❌ Console.log statements in production code (29 occurrences)
- ❌ Type safety issues (2 `as any` usages)
- ❌ Limited test coverage (no coverage reporting)
- ❌ No E2E tests
- ❌ No performance monitoring
- ❌ Basic feature set (missing advanced features)

---

## Phase 1: Code Quality & Testing Foundation

**Priority:** HIGH
**Timeline:** 2-3 days
**Status:** In Progress

### 1.1 Clean Up Console Logging ✅

**Goal:** Replace all console.log statements with proper logging utility

**Status:** COMPLETED (2025-10-19)

**Implementation Summary:**
- Replaced all console.log/debug/info/warn/error statements in source files
- Updated 4 files:
  - `composables/usePokerRoom.ts` - 17 occurrences
  - `components/VotingArea.vue` - 1 occurrence
  - `pages/index.vue` - 1 occurrence
  - `server/poker-room.ts` - Already using inline logger (correct)
- All logging now uses centralized logger utility
- Environment-based log levels (DEBUG in dev, WARN in prod)

**Files Modified:**
- `composables/usePokerRoom.ts:4` - Added logger import
- `components/VotingArea.vue:2` - Added logger import
- `pages/index.vue:2` - Added logger import

**Success Criteria:**
- [x] Zero console.log statements in production code
- [x] All logging uses centralized logger utility
- [x] Log levels properly configured by environment
- [x] Structured logs for Cloudflare Analytics

**Actual Time:** 30 minutes

---

### 1.2 Fix Type Safety Issues ✅

**Goal:** Eliminate `as any` type assertions and improve type safety

**Status:** COMPLETED (2025-10-19)

**Implementation Summary:**
- Implemented Option A (Injection Key) for type-safe provide/inject
- Created `PokerRoomKey` injection key in `composables/usePokerRoom.ts`
- Updated parent component to provide with type safety
- Updated child components to inject with type safety
- Added runtime validation (throw if not provided)

**Files Modified:**
- `composables/usePokerRoom.ts:1` - Added InjectionKey import
- `composables/usePokerRoom.ts:461-462` - Exported PokerRoomComposable type and PokerRoomKey
- `pages/room/[id].vue:2` - Imported PokerRoomKey
- `pages/room/[id].vue:11` - Added provide(PokerRoomKey, pokerRoom)
- `components/VotingArea.vue:3` - Imported PokerRoomKey
- `components/VotingArea.vue:8-9` - Type-safe inject with validation
- `components/ParticipantList.vue:2` - Imported PokerRoomKey
- `components/ParticipantList.vue:5-6` - Type-safe inject with validation

**Success Criteria:**
- [x] No `as any` type assertions
- [x] Proper TypeScript inference throughout
- [x] Type-safe injection/provide pattern
- [x] No type-related warnings in build

**Actual Time:** 20 minutes

---

### 1.3 Test Coverage Configuration 📝

**Goal:** Configure test coverage reporting for future expansion

**Status:** DOCUMENTED (2025-10-19)

**Current State:**
- 11 tests passing (2 test files)
- @vitest/coverage-v8 installed
- **KNOWN ISSUE**: V8 coverage not supported in Workers Vitest pool

**Coverage Limitation:**
Cloudflare Workers Vitest pool does not support V8 coverage due to missing `node:inspector` module in workerd runtime. The recommended approach is Istanbul instrumented coverage, which requires additional setup.

**Documentation:**
- Added note in `vitest.config.ts` explaining the limitation
- Reference: https://developers.cloudflare.com/workers/testing/vitest-integration/known-issues/#coverage
- Added `coverage/` to `.gitignore`

**Future Work:**
- Implement Istanbul coverage (Phase 1.3b)
- Or rely on comprehensive manual testing and E2E tests
- Current approach: Maintain 11 passing tests and expand with E2E

**Implementation Summary:**
```bash
pnpm add -D @vitest/coverage-v8  # Installed but not configured
```

**Step 2: Create Test Files**

**`composables/useToast.test.ts`**
```typescript
describe('useToast', () => {
  it('should add toast notification', () => {})
  it('should auto-dismiss after duration', () => {})
  it('should manually dismiss toast', () => {})
  it('should clear timer on manual dismiss', () => {})
  it('should handle multiple toasts', () => {})
})
```

**`composables/usePokerRoom.test.ts`**
```typescript
describe('usePokerRoom', () => {
  describe('Connection Management', () => {
    it('should connect to WebSocket', () => {})
    it('should handle reconnection with backoff', () => {})
    it('should stop reconnection after max attempts', () => {})
    it('should clean up on unmount', () => {})
  })

  describe('Room Actions', () => {
    it('should join room with valid name', () => {})
    it('should validate name before joining', () => {})
    it('should submit vote', () => {})
    it('should reveal votes', () => {})
    it('should reset round', () => {})
  })

  describe('Error Handling', () => {
    it('should show toast on connection error', () => {})
    it('should show toast on action failure', () => {})
  })
})
```

**`components/ToastContainer.test.ts`**
```typescript
describe('ToastContainer', () => {
  it('should render toasts', () => {})
  it('should apply correct color classes', () => {})
  it('should handle toast removal', () => {})
  it('should animate transitions', () => {})
})
```

**Step 3: Expand Durable Object Tests**

Add to `server/poker-room.test.ts`:
- WebSocket message handling tests
- Session persistence across hibernation
- Rate limiting enforcement
- Heartbeat cleanup
- Broadcast debouncing

**Success Criteria:**
- [ ] @vitest/coverage-v8 installed
- [ ] Coverage reporting working: `pnpm test:coverage`
- [ ] >80% code coverage achieved
- [ ] All critical paths tested
- [ ] Component tests for all Vue components
- [ ] Composable tests for all composables

**Estimated Time:** 1 day

---

### 1.4 Add E2E Testing ⏳

**Goal:** Set up end-to-end testing for critical user flows

**Technology:** Playwright (recommended for Cloudflare Workers)

**Implementation:**

**Step 1: Install Playwright**
```bash
pnpm add -D @playwright/test
npx playwright install
```

**Step 2: Configure Playwright**

**`playwright.config.ts`**
```typescript
import { defineConfig } from '@playwright/test'

export default defineConfig({
  testDir: './tests/e2e',
  use: {
    baseURL: 'http://localhost:3000',
  },
  webServer: {
    command: 'pnpm dev',
    port: 3000,
    reuseExistingServer: !process.env.CI,
  },
})
```

**Step 3: Create E2E Tests**

**`tests/e2e/room-flow.spec.ts`**
```typescript
test('complete voting flow', async ({ page, context }) => {
  // User 1: Create room
  await page.goto('/')
  await page.click('text=Create Room')
  const roomUrl = await page.url()

  // User 1: Join room
  await page.fill('input[name="name"]', 'Alice')
  await page.click('text=Join Room')

  // User 2: Join same room
  const page2 = await context.newPage()
  await page2.goto(roomUrl)
  await page2.fill('input[name="name"]', 'Bob')
  await page2.click('text=Join Room')

  // Both users vote
  await page.click('text=5')
  await page2.click('text=8')

  // User 1 reveals votes
  await page.click('text=Reveal Votes')

  // Verify votes are visible
  await expect(page.locator('text=5')).toBeVisible()
  await expect(page.locator('text=8')).toBeVisible()

  // Reset round
  await page.click('text=New Round')

  // Verify votes cleared
  await expect(page.locator('text=5')).not.toBeVisible()
})

test('reconnection after disconnect', async ({ page }) => {
  // ... test reconnection logic
})

test('error handling for invalid actions', async ({ page }) => {
  // ... test error scenarios
})
```

**Success Criteria:**
- [ ] Playwright installed and configured
- [ ] E2E tests for critical user flows
- [ ] Tests run in CI pipeline
- [ ] Tests cover multi-user scenarios
- [ ] Reconnection scenarios tested

**Estimated Time:** 1 day

---

## Phase 2: Performance & Monitoring

**Priority:** HIGH
**Timeline:** 1-2 days
**Status:** Pending

### 2.1 Add Performance Metrics ⏳

**Goal:** Track and monitor application performance

**Metrics to Track:**
1. **WebSocket Performance**
   - Connection establishment time
   - Message round-trip latency
   - Broadcast time for N participants
   - Reconnection time

2. **Durable Object Performance**
   - CPU time per request
   - Active duration (GB-seconds)
   - Storage operations time
   - Broadcast debounce effectiveness

3. **User Experience Metrics**
   - Time to first vote
   - Time to reveal votes
   - Page load time
   - Interactive time

**Implementation:**

**Add Performance Tracking to Composable**
```typescript
// In composables/usePokerRoom.ts
const metrics = {
  connectionStartTime: 0,
  messageLatency: [] as number[],
  reconnectionCount: 0,
}

// Track connection time
const connectToRoom = () => {
  metrics.connectionStartTime = performance.now()
  // ... existing code

  ws.onopen = () => {
    const connectionTime = performance.now() - metrics.connectionStartTime
    logger.info('Connection established', { connectionTime })
    // ... existing code
  }
}

// Track message latency
const vote = async (value) => {
  const startTime = performance.now()
  // ... send message

  // On acknowledgment (add new message type)
  const latency = performance.now() - startTime
  metrics.messageLatency.push(latency)
}
```

**Add Cloudflare Analytics Integration**
```typescript
// Send custom metrics to Cloudflare Analytics
interface AnalyticsEvent {
  metric: string
  value: number
  timestamp: number
  metadata?: Record<string, any>
}

const sendAnalytics = (event: AnalyticsEvent) => {
  if (process.client && 'sendBeacon' in navigator) {
    navigator.sendBeacon('/api/analytics', JSON.stringify(event))
  }
}
```

**Success Criteria:**
- [ ] Performance metrics tracked client-side
- [ ] Metrics sent to Cloudflare Analytics
- [ ] Dashboard created for visualization
- [ ] Alerts configured for performance degradation
- [ ] Latency p99 < 100ms

**Estimated Time:** 4 hours

---

### 2.2 Optimize State Management ⏳

**Goal:** Reduce bandwidth and improve performance for large rooms

**Current Issue:** Full state broadcast on every change

**Optimizations:**

**1. Implement Delta Updates**
```typescript
// Instead of sending full state:
{
  type: 'update',
  payload: { participants: [...], votesRevealed: false, ... }
}

// Send only changes:
{
  type: 'delta',
  payload: {
    changes: [
      { type: 'participant_vote', userId: 'user-123', vote: 5 }
    ]
  }
}
```

**2. Add Message Compression**
```typescript
// For rooms with >20 participants, compress state
private async broadcastState() {
  const state = await this.getRoomState()
  const message = this.serializeRoomState(state)

  let payload = JSON.stringify(message)

  // Compress for large payloads
  if (payload.length > 1024) {
    payload = await compress(payload)
  }

  this.ctx.getWebSockets().forEach(ws => ws.send(payload))
}
```

**3. Optimize Participant Rendering**
```typescript
// Add virtual scrolling for 50+ participants
<RecycleScroller
  :items="roomState.participants"
  :item-size="60"
  key-field="id"
>
  <template #default="{ item }">
    <ParticipantCard :participant="item" />
  </template>
</RecycleScroller>
```

**Success Criteria:**
- [ ] Delta updates implemented and tested
- [ ] Bandwidth reduced by >50% for large rooms
- [ ] Virtual scrolling for participant list
- [ ] Performance maintained with 100+ participants
- [ ] Compression working for large payloads

**Estimated Time:** 4 hours

---

### 2.3 Add Health Check Endpoint ⏳

**Goal:** Monitor application health and readiness

**Implementation:**

**`server/api/health.get.ts`**
```typescript
export default defineEventHandler(async (event) => {
  const health = {
    status: 'healthy',
    timestamp: Date.now(),
    version: process.env.npm_package_version,
    environment: process.env.NODE_ENV,
    checks: {
      database: 'healthy',
      durableObjects: 'healthy',
      websockets: 'healthy',
    },
    metrics: {
      uptime: process.uptime?.() || 0,
      memory: process.memoryUsage?.() || {},
    }
  }

  // Check Durable Object availability
  try {
    const testRoom = env.POKER_ROOM.newUniqueId()
    const stub = env.POKER_ROOM.get(testRoom)
    // Basic connectivity check (don't actually create room)
    health.checks.durableObjects = 'healthy'
  } catch (error) {
    health.checks.durableObjects = 'unhealthy'
    health.status = 'degraded'
  }

  return health
})
```

**Add Metrics Endpoint**

**`server/api/metrics.get.ts`**
```typescript
export default defineEventHandler(async () => {
  return {
    activeConnections: getActiveConnectionCount(),
    roomCount: getRoomCount(),
    messageCount: getMessageCount(),
    errorRate: getErrorRate(),
  }
})
```

**Success Criteria:**
- [ ] `/api/health` endpoint returns health status
- [ ] `/api/metrics` endpoint returns key metrics
- [ ] Health checks run on all critical systems
- [ ] Monitoring dashboard configured
- [ ] Alerts set up for unhealthy status

**Estimated Time:** 2 hours

---

## Phase 3: Enhanced Security

**Priority:** MEDIUM
**Timeline:** 1-2 days
**Status:** Pending

### 3.1 WebSocket Security ⏳

**Goal:** Enhance WebSocket connection security

**Implementation:**

**1. Origin Validation**
```typescript
// In worker.ts
private async handleWebSocketUpgrade(request: Request): Promise<Response> {
  const origin = request.headers.get('Origin')
  const allowedOrigins = [
    'https://planning-poker.tombaker.workers.dev',
    'http://localhost:3000', // Dev only
  ]

  if (origin && !allowedOrigins.includes(origin)) {
    return new Response('Forbidden', { status: 403 })
  }

  // ... existing WebSocket upgrade code
}
```

**2. CSRF Token for WebSocket Upgrades**
```typescript
// Generate token on page load
const csrfToken = generateToken()
sessionStorage.setItem('csrf-token', csrfToken)

// Include in WebSocket URL
const wsUrl = `${protocol}//${host}/api/room/${roomId}/ws?csrf=${csrfToken}`

// Validate on server
const url = new URL(request.url)
const token = url.searchParams.get('csrf')
if (!validateCsrfToken(token)) {
  return new Response('Invalid CSRF token', { status: 403 })
}
```

**3. Message Signing**
```typescript
// Sign messages to prevent tampering
interface SignedMessage {
  type: string
  payload: any
  signature: string
  timestamp: number
}

const signMessage = (msg: any, secret: string) => {
  const payload = JSON.stringify({ ...msg, timestamp: Date.now() })
  const signature = createHmac('sha256', secret).update(payload).digest('hex')
  return { ...msg, signature, timestamp: Date.now() }
}
```

**Success Criteria:**
- [ ] Origin validation for all WebSocket connections
- [ ] CSRF tokens validated on upgrade
- [ ] Message signing implemented (optional)
- [ ] Security audit passed
- [ ] No unauthorized connections possible

**Estimated Time:** 4 hours

---

### 3.2 Room Access Control ⏳

**Goal:** Add optional password protection and moderation

**Implementation:**

**1. Room Passwords**
```typescript
// Add password field to room creation
interface RoomConfig {
  roomId: string
  password?: string
  createdBy: string
  createdAt: number
}

// Hash password before storage
const hashedPassword = await hashPassword(password)

// Verify on join
const verifyRoomPassword = async (roomId: string, password: string) => {
  const room = await getRoomConfig(roomId)
  if (!room.password) return true
  return await verifyPassword(password, room.password)
}
```

**2. Moderator Role**
```typescript
interface Participant {
  id: string
  name: string
  vote: string | number | null
  role: 'moderator' | 'participant'
  joinedAt: number
}

// Moderator actions
const moderatorActions = {
  kickUser: (userId: string) => {},
  lockRoom: () => {},
  unlockRoom: () => {},
  clearVotes: () => {},
}
```

**3. Room Ownership**
```typescript
// First user to join becomes owner/moderator
const handleJoin = (userId: string) => {
  const participants = Object.keys(roomState.participants)
  const role = participants.length === 0 ? 'moderator' : 'participant'

  roomState.participants[userId] = {
    name,
    vote: null,
    role,
    joinedAt: Date.now(),
  }
}
```

**Success Criteria:**
- [ ] Optional password protection working
- [ ] Moderator role with special permissions
- [ ] Room owner can kick/ban users
- [ ] Room locking prevents new joins
- [ ] UI shows moderator controls

**Estimated Time:** 4 hours

---

### 3.3 Improve Rate Limiting ⏳

**Goal:** Move rate limiting to Cloudflare KV for distributed enforcement

**Current Issue:** In-memory rate limiting doesn't work across Worker instances

**Implementation:**

**1. KV-Based Rate Limiting**
```typescript
// In wrangler.jsonc, add KV binding
"kv_namespaces": [
  { "binding": "RATE_LIMIT", "id": "..." }
]

// Implement distributed rate limiting
const checkRateLimit = async (ip: string, kv: KVNamespace) => {
  const key = `rate-limit:${ip}`
  const data = await kv.get(key, 'json')

  if (!data) {
    await kv.put(key, JSON.stringify({ count: 1, windowStart: Date.now() }), {
      expirationTtl: 60
    })
    return true
  }

  const { count, windowStart } = data
  const now = Date.now()

  if (now - windowStart >= 60000) {
    await kv.put(key, JSON.stringify({ count: 1, windowStart: now }), {
      expirationTtl: 60
    })
    return true
  }

  if (count >= 5) return false

  await kv.put(key, JSON.stringify({ count: count + 1, windowStart }), {
    expirationTtl: 60
  })
  return true
}
```

**2. Per-Room Participant Limits**
```typescript
// In PokerRoom Durable Object
const MAX_PARTICIPANTS = 100

override async fetch(request: Request): Promise<Response> {
  const participantCount = Object.keys(roomState.participants).length

  if (participantCount >= MAX_PARTICIPANTS) {
    return new Response('Room is full', { status: 429 })
  }

  return this.handleWebSocketUpgrade(request)
}
```

**3. Progressive Rate Limiting**
```typescript
// Track violation count
const violations = await kv.get(`violations:${ip}`, 'json') || 0

// Stricter limits for repeat offenders
const maxRequests = violations > 3 ? 2 : 5
const windowMs = violations > 3 ? 120000 : 60000
```

**Success Criteria:**
- [ ] KV namespace created and bound
- [ ] Rate limiting works across Worker instances
- [ ] Per-room participant limits enforced
- [ ] Progressive rate limiting working
- [ ] No single user can overwhelm system

**Estimated Time:** 3 hours

---

## Phase 4: Core Feature Enhancements

**Priority:** MEDIUM
**Timeline:** 3-4 days
**Status:** Pending

### 4.1 Room Management Features ⏳

**Goal:** Add room expiration and lifecycle management

**Implementation:**

**1. Room Expiration with Alarms**
```typescript
// Use Durable Object Alarms API
export class PokerRoom extends DurableObject {
  async scheduleExpiration() {
    const EXPIRATION_TIME = 24 * 60 * 60 * 1000 // 24 hours
    const expiresAt = Date.now() + EXPIRATION_TIME

    await this.ctx.storage.setAlarm(expiresAt)
  }

  async alarm() {
    // Send warning 1 hour before deletion
    const roomState = await this.getRoomState()
    const activeParticipants = this.ctx.getWebSockets().length

    if (activeParticipants > 0) {
      this.broadcastMessage({
        type: 'warning',
        payload: { message: 'Room will be deleted in 1 hour due to inactivity' }
      })

      // Reschedule for 1 hour
      await this.ctx.storage.setAlarm(Date.now() + 60 * 60 * 1000)
    } else {
      // Delete room data
      await this.ctx.storage.deleteAll()
    }
  }

  // Reset expiration on activity
  async handleMessage(ws: WebSocket, userId: string, message: WebSocketMessage) {
    await this.scheduleExpiration() // Reset on any activity
    // ... existing code
  }
}
```

**2. Room Extension**
```typescript
// Allow users to extend room lifetime
{
  type: 'extend',
  hours: 24
}

// In message handler
case 'extend': {
  if (roomState.participants[userId]?.role !== 'moderator') {
    ws.send(JSON.stringify({
      type: 'error',
      payload: { message: 'Only moderators can extend room lifetime' }
    }))
    return
  }

  const extensionMs = message.hours * 60 * 60 * 1000
  await this.ctx.storage.setAlarm(Date.now() + extensionMs)
  break
}
```

**Success Criteria:**
- [ ] Rooms expire after 24 hours of inactivity
- [ ] Warning sent 1 hour before deletion
- [ ] Moderators can extend room lifetime
- [ ] Activity resets expiration timer
- [ ] Deleted rooms cleaned up properly

**Estimated Time:** 3 hours

---

### 4.2 Voting Features ⏳

**Goal:** Add statistics, timer, and better visualization

**Implementation:**

**1. Vote Statistics**
```typescript
// Add computed statistics to usePokerRoom
const statistics = computed(() => {
  if (!roomState.value.votesRevealed) return null

  const votes = roomState.value.participants
    .map(p => p.vote)
    .filter((v): v is number => typeof v === 'number')

  if (votes.length === 0) return null

  const sorted = [...votes].sort((a, b) => a - b)
  const sum = votes.reduce((a, b) => a + b, 0)

  return {
    average: sum / votes.length,
    median: sorted[Math.floor(sorted.length / 2)],
    mode: findMode(votes),
    min: sorted[0],
    max: sorted[sorted.length - 1],
    consensus: calculateConsensus(votes),
    count: votes.length,
  }
})

const calculateConsensus = (votes: number[]) => {
  const counts = votes.reduce((acc, v) => {
    acc[v] = (acc[v] || 0) + 1
    return acc
  }, {} as Record<number, number>)

  const maxCount = Math.max(...Object.values(counts))
  return (maxCount / votes.length) * 100
}
```

**2. Timer System**
```typescript
// Add timer state to RoomStorage
interface RoomStorage {
  participants: Record<string, Participant>
  votesRevealed: boolean
  storyTitle: string
  timer?: {
    duration: number // seconds
    startedAt: number
    expiresAt: number
  }
}

// Timer actions
{
  type: 'start_timer',
  duration: 180 // 3 minutes
}

{
  type: 'cancel_timer'
}

// Auto-reveal on timer expiration
private async checkTimer() {
  const roomState = await this.getRoomState()

  if (roomState.timer && Date.now() >= roomState.timer.expiresAt) {
    roomState.votesRevealed = true
    delete roomState.timer
    await this.setRoomState(roomState)
    await this.broadcastState()
  }
}
```

**3. Visual Consensus Indicator**
```vue
<template>
  <div v-if="statistics" class="mt-4">
    <h3 class="font-semibold">Statistics</h3>
    <div class="grid grid-cols-2 gap-2">
      <div>Average: {{ statistics.average.toFixed(1) }}</div>
      <div>Median: {{ statistics.median }}</div>
      <div>Mode: {{ statistics.mode }}</div>
      <div>Range: {{ statistics.min }}-{{ statistics.max }}</div>
    </div>

    <!-- Consensus visualization -->
    <div class="mt-2">
      <div class="flex justify-between text-sm">
        <span>Consensus</span>
        <span>{{ statistics.consensus.toFixed(0) }}%</span>
      </div>
      <div class="w-full bg-gray-200 rounded-full h-2">
        <div
          class="h-2 rounded-full transition-all"
          :class="{
            'bg-red-500': statistics.consensus < 50,
            'bg-yellow-500': statistics.consensus >= 50 && statistics.consensus < 75,
            'bg-green-500': statistics.consensus >= 75,
          }"
          :style="{ width: `${statistics.consensus}%` }"
        />
      </div>
    </div>
  </div>
</template>
```

**Success Criteria:**
- [ ] Statistics calculated and displayed
- [ ] Timer can be set and cancelled
- [ ] Auto-reveal on timer expiration
- [ ] Consensus percentage shown
- [ ] Visual indicators for alignment
- [ ] Outlier detection working

**Estimated Time:** 4 hours

---

### 4.3 Multiple Stories Support ⏳

**Goal:** Support multiple estimation rounds and history

**Implementation:**

**1. Story Data Structure**
```typescript
interface Story {
  id: string
  title: string
  description?: string
  votes: Record<string, string | number | null>
  revealed: boolean
  createdAt: number
  estimatedAt?: number
  finalEstimate?: number
}

interface RoomStorage {
  participants: Record<string, Participant>
  currentStoryId?: string
  stories: Record<string, Story>
  storyOrder: string[]
}
```

**2. Story Actions**
```typescript
{
  type: 'create_story',
  title: string,
  description?: string
}

{
  type: 'select_story',
  storyId: string
}

{
  type: 'finalize_story',
  storyId: string,
  estimate: number
}

{
  type: 'delete_story',
  storyId: string
}
```

**3. Story List UI**
```vue
<template>
  <div class="story-list">
    <h3>Stories</h3>
    <div
      v-for="story in stories"
      :key="story.id"
      class="story-item"
      :class="{ active: story.id === currentStoryId }"
      @click="selectStory(story.id)"
    >
      <h4>{{ story.title }}</h4>
      <div v-if="story.finalEstimate" class="estimate">
        Final: {{ story.finalEstimate }}
      </div>
    </div>
    <button @click="createNewStory">+ New Story</button>
  </div>
</template>
```

**4. Export Functionality**
```typescript
const exportHistory = () => {
  const data = {
    roomId,
    exportedAt: Date.now(),
    participants: roomState.value.participants,
    stories: Object.values(roomState.value.stories).map(story => ({
      title: story.title,
      description: story.description,
      finalEstimate: story.finalEstimate,
      votes: story.votes,
      votingCompleted: story.revealed,
    })),
  }

  // CSV export
  const csv = convertToCSV(data)
  downloadFile(csv, `planning-poker-${roomId}.csv`, 'text/csv')

  // JSON export
  const json = JSON.stringify(data, null, 2)
  downloadFile(json, `planning-poker-${roomId}.json`, 'application/json')
}
```

**Success Criteria:**
- [ ] Create and manage multiple stories
- [ ] Switch between stories
- [ ] View estimation history
- [ ] Export to CSV format
- [ ] Export to JSON format
- [ ] Story templates working

**Estimated Time:** 6 hours

---

### 4.4 Custom Vote Scales ⏳

**Goal:** Support different estimation scales beyond Fibonacci

**Implementation:**

**1. Scale Definitions**
```typescript
interface VoteScale {
  id: string
  name: string
  values: (string | number)[]
  description: string
}

const VOTE_SCALES: Record<string, VoteScale> = {
  fibonacci: {
    id: 'fibonacci',
    name: 'Fibonacci',
    values: [1, 2, 3, 5, 8, 13, 21, '?', '☕'],
    description: 'Classic Fibonacci sequence for story points',
  },
  tshirt: {
    id: 'tshirt',
    name: 'T-Shirt Sizes',
    values: ['XS', 'S', 'M', 'L', 'XL', 'XXL', '?'],
    description: 'T-shirt sizing for relative estimation',
  },
  hours: {
    id: 'hours',
    name: 'Hours',
    values: [1, 2, 4, 8, 16, 24, 40, '?'],
    description: 'Time-based estimation in hours',
  },
  days: {
    id: 'days',
    name: 'Days',
    values: [0.5, 1, 2, 3, 5, 10, 20, '?'],
    description: 'Time-based estimation in days',
  },
  custom: {
    id: 'custom',
    name: 'Custom',
    values: [], // User-defined
    description: 'Create your own scale',
  },
}
```

**2. Room Configuration**
```typescript
interface RoomStorage {
  participants: Record<string, Participant>
  votesRevealed: boolean
  storyTitle: string
  voteScale: string // Scale ID
  customScaleValues?: (string | number)[]
}

// Message to change scale
{
  type: 'set_scale',
  scaleId: string,
  customValues?: (string | number)[]
}
```

**3. UI for Scale Selection**
```vue
<template>
  <div class="scale-selector">
    <label>Voting Scale</label>
    <select v-model="selectedScale" @change="changeScale">
      <option v-for="scale in scales" :key="scale.id" :value="scale.id">
        {{ scale.name }}
      </option>
    </select>

    <div v-if="selectedScale === 'custom'" class="custom-scale-input">
      <input
        v-model="customScaleInput"
        placeholder="Enter values (comma-separated)"
      />
      <button @click="saveCustomScale">Save Custom Scale</button>
    </div>
  </div>
</template>
```

**4. Persist Scale Preference**
```typescript
// Save to localStorage
const saveScalePreference = (scaleId: string) => {
  localStorage.setItem('preferred-vote-scale', scaleId)
}

// Load preference on room creation
const loadScalePreference = () => {
  return localStorage.getItem('preferred-vote-scale') || 'fibonacci'
}
```

**Success Criteria:**
- [ ] Multiple scales available
- [ ] Scale selection UI working
- [ ] Custom scale creation working
- [ ] Scale preference saved
- [ ] Scale applied to voting cards
- [ ] Backward compatibility maintained

**Estimated Time:** 3 hours

---

## Phase 5: Advanced UX Features

**Priority:** LOW
**Timeline:** 2-3 days
**Status:** Pending

### 5.1 Dark Mode 🌙

**Implementation:** System-aware dark mode with manual toggle

**Estimated Time:** 2 hours

---

### 5.2 Enhanced Visualizations 📊

**Implementation:** Voting distribution charts, trends, heatmaps

**Estimated Time:** 4 hours

---

### 5.3 Improved Mobile Experience 📱

**Implementation:** Touch-friendly UI, swipe gestures, responsive layouts

**Estimated Time:** 4 hours

---

### 5.4 Collaboration Features 🤝

**Implementation:** Spectator mode, integrations, screen sharing links

**Estimated Time:** 6 hours

---

## Phase 6: Infrastructure & DevOps

**Priority:** LOW
**Timeline:** 1-2 days
**Status:** Pending

### 6.1 Monitoring & Alerting 📈

**Implementation:** Error tracking, analytics dashboards, alerts

**Estimated Time:** 3 hours

---

### 6.2 CI/CD Improvements 🚀

**Implementation:** Staging environment, blue-green deployments, automation

**Estimated Time:** 4 hours

---

### 6.3 Documentation 📚

**Implementation:** API docs, JSDoc, architecture diagrams, deployment guide

**Estimated Time:** 3 hours

---

## Implementation Strategy

### Week 1: Quick Wins
- Console.log cleanup (1 hour)
- Type safety fixes (1 hour)
- Health check endpoint (30 mins)
- Test expansion (1 day)
- E2E test setup (1 day)

### Week 2: Foundation
- Performance metrics (4 hours)
- State optimization (4 hours)
- WebSocket security (4 hours)
- Room access control (4 hours)

### Week 3: Core Features
- Room expiration (3 hours)
- Vote statistics (4 hours)
- Timer system (2 hours)
- Multiple stories (6 hours)

### Week 4: Polish
- Custom scales (3 hours)
- Advanced visualizations (4 hours)
- Mobile optimization (4 hours)
- Documentation (3 hours)

---

## Success Metrics

### Technical Excellence
- ✅ Test coverage > 80%
- ✅ Zero console.logs in production
- ✅ 100% type safety (no `any` types)
- ✅ All critical paths have E2E tests
- ✅ Performance: < 100ms message latency
- ✅ Zero security vulnerabilities

### User Experience
- ✅ Room creation success rate > 99%
- ✅ Reconnection success rate > 95%
- ✅ User satisfaction score > 4.5/5
- ✅ Feature adoption rate > 60%
- ✅ Mobile usability score > 85%

### Security & Reliability
- ✅ Zero security incidents
- ✅ Rate limiting effectiveness > 99%
- ✅ No unauthorized room access
- ✅ Uptime > 99.9%
- ✅ Error rate < 0.1%

### Business Metrics
- 📈 Active users growth
- 📈 Rooms created per day
- 📈 Average session duration
- 📈 Feature engagement rates
- 📈 User retention rate

---

## Risk Mitigation

1. **Incremental Deployment**: Each phase deployed separately
2. **Feature Flags**: New features behind flags for gradual rollout
3. **Rollback Plan**: Keep previous versions ready for quick rollback
4. **User Communication**: Announce changes in advance
5. **Performance Budget**: Monitor impact of each change
6. **Testing Requirements**: No deploy without passing tests
7. **Code Review**: All changes reviewed before merge

---

## Next Steps

1. ✅ Create comprehensive improvement plan (this document)
2. ⏳ Start with Phase 1.1 (console.log cleanup)
3. ⏳ Set up test coverage reporting
4. ⏳ Create GitHub issues for each phase
5. ⏳ Track progress with detailed metrics
6. ⏳ Gather user feedback continuously
7. ⏳ Iterate based on data

---

## Resources

- **Production URL:** https://planning-poker.tombaker.workers.dev
- **Repository:** https://github.com/tombakerjr/planning-poker
- **Cloudflare Docs:** https://developers.cloudflare.com/durable-objects/
- **WebSocket Hibernation:** https://developers.cloudflare.com/durable-objects/api/websockets/
- **Playwright Docs:** https://playwright.dev/
- **Vitest Coverage:** https://vitest.dev/guide/coverage.html
- **Cloudflare Analytics:** https://developers.cloudflare.com/analytics/

---

## Change Log

**2025-10-19:** Created comprehensive incremental improvement plan
- Defined 6 phases of improvements
- Set clear success metrics
- Outlined implementation strategy
- Established risk mitigation approach
