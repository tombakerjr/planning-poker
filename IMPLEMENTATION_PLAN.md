# Planning Poker - Post-Migration Improvement Plan

## Context

This plan addresses issues identified in the Claude Code review after successfully migrating to a single-worker architecture with WebSocket Hibernation API. The migration is complete and deployed, but several critical bugs and improvements need to be addressed.

**Current State:**
- ✅ Single worker architecture with WebSocket Hibernation
- ✅ Durable Objects properly configured
- ✅ Basic real-time voting functionality working
- ✅ Deployed to production at https://planning-poker.tombaker.workers.dev
- ❌ Several critical bugs need fixing (see below)
- ❌ Missing security measures (rate limiting, input validation)
- ❌ No test coverage

---

## 🔴 Phase 1: Critical Fixes (Must Fix - Production Blockers)

**Priority:** Immediate
**Estimated Time:** 2 hours
**Status:** Pending

### 1.1 Memory Leak in Heartbeat Implementation
**File:** `server/poker-room.ts:278-291`
**Severity:** High

**Problem:**
- Heartbeat intervals never cleared on disconnect
- Multiple calls create multiple intervals
- Leads to memory leak in Durable Object

**Fix:**
```typescript
private heartbeatIntervals = new Map<WebSocket, number>();

private startHeartbeat(ws: WebSocket) {
  this.stopHeartbeat(ws);
  const intervalId = setInterval(() => {
    try {
      ws.send(JSON.stringify({ type: "ping" }));
    } catch (error) {
      console.error("Failed to send ping:", error);
      this.stopHeartbeat(ws);
    }
  }, 30000) as unknown as number;
  this.heartbeatIntervals.set(ws, intervalId);
}

private stopHeartbeat(ws: WebSocket) {
  const intervalId = this.heartbeatIntervals.get(ws);
  if (intervalId) {
    clearInterval(intervalId);
    this.heartbeatIntervals.delete(ws);
  }
}

override async webSocketClose(ws: WebSocket, code: number, reason: string, wasClean: boolean) {
  this.stopHeartbeat(ws);
  // ... rest of implementation
}
```

**Success Criteria:**
- [ ] Heartbeat intervals properly cleaned up on disconnect
- [ ] No interval leaks when testing multiple connect/disconnect cycles
- [ ] Memory usage stable during stress testing

---

### 1.2 Race Condition in Authentication Flow
**File:** `server/poker-room.ts:112-124`
**Severity:** High

**Problem:**
- Sessions Map lost on Durable Object hibernation
- `serializeAttachment()` data persists but not read back
- Users lose session on wake-up

**Fix:**
```typescript
override async webSocketMessage(ws: WebSocket, message: ArrayBuffer | string) {
  // Restore session from attachment if not in memory
  if (!this.sessions.has(ws)) {
    const meta = ws.deserializeAttachment() as WebSocketMeta | null;
    if (meta) {
      this.sessions.set(ws, meta);
    }
  }

  // ... rest of implementation
}
```

**Success Criteria:**
- [ ] Sessions persist across Durable Object hibernation
- [ ] Users don't lose connection after idle period
- [ ] Test hibernation with `wrangler dev` after inactivity

---

### 1.3 Auto-Reconnect Infinite Loop
**File:** `composables/usePokerRoom.ts:150-164`
**Severity:** High

**Problem:**
- No maximum retry count
- No exponential backoff
- Will retry forever even if server permanently unavailable

**Fix:**
```typescript
let reconnectAttempts = 0;
const MAX_RECONNECT_ATTEMPTS = 10;

const scheduleReconnect = () => {
  if (reconnectAttempts >= MAX_RECONNECT_ATTEMPTS) {
    console.error('Max reconnection attempts reached');
    // TODO: Show user-friendly error message
    return;
  }

  const delay = Math.min(1000 * Math.pow(2, reconnectAttempts), 30000);
  reconnectTimeout = setTimeout(() => {
    reconnectAttempts++;
    connectToRoom();
  }, delay);
};

ws.onopen = () => {
  reconnectAttempts = 0; // Reset on successful connection
  status.value = 'OPEN';
  // ... rest of onopen handler
};

ws.onclose = (event) => {
  status.value = 'CLOSED';
  if (event.code !== 1000) {
    scheduleReconnect();
  }
};
```

**Success Criteria:**
- [ ] Reconnection stops after 10 attempts
- [ ] Exponential backoff prevents server hammering
- [ ] User sees error message when max retries reached

---

### 1.4 Missing Error Handling in Room Operations
**File:** `server/poker-room.ts:169-208`
**Severity:** High

**Problem:**
- Operations silently fail if user hasn't joined
- No validation before state mutations
- Confusing user experience

**Fix:**
```typescript
case "vote": {
  if (!roomState.participants[userId]) {
    ws.send(JSON.stringify({
      type: "error",
      payload: { message: "Must join room before voting" }
    }));
    return;
  }
  roomState.participants[userId].vote = message.vote;
  break;
}

case "reveal": {
  if (!roomState.participants[userId]) {
    ws.send(JSON.stringify({
      type: "error",
      payload: { message: "Must join room before revealing votes" }
    }));
    return;
  }
  roomState.votesRevealed = true;
  break;
}

case "reset": {
  if (!roomState.participants[userId]) {
    ws.send(JSON.stringify({
      type: "error",
      payload: { message: "Must join room before resetting" }
    }));
    return;
  }
  // ... rest of reset logic
}
```

**Client-side error handling:**
```typescript
// In composables/usePokerRoom.ts
const handleMessage = (data: any) => {
  if (data.type === 'error') {
    // TODO: Show toast notification or error banner
    console.error('Server error:', data.payload.message);
    return;
  }
  // ... rest of message handling
}
```

**Success Criteria:**
- [ ] All operations validate user joined
- [ ] Error messages sent to client
- [ ] User sees helpful error feedback

---

## ⚠️ Phase 2: High Priority Fixes (Should Fix Soon)

**Priority:** This Week
**Estimated Time:** 1 hour
**Status:** Pending

### 2.1 Remove Unused WebSocket Endpoint
**File:** `server/api/room/[id]/ws.get.ts`
**Severity:** Medium

**Problem:**
- Entire file bypassed by `worker.ts:14-25`
- Confusing for future developers
- Dead code in repository

**Fix:** Delete the file entirely

**Success Criteria:**
- [ ] File removed from repository
- [ ] WebSocket connections still work via worker.ts
- [ ] No dead code warnings

---

### 2.2 Fix LocalStorage Session Age Bug
**File:** `composables/usePokerRoom.ts:44-56`
**Severity:** Medium

**Problem:**
- Missing null check on `session.timestamp`
- Could cause `NaN` comparisons

**Fix:**
```typescript
if (session.timestamp && (Date.now() - session.timestamp) < 24 * 60 * 60 * 1000) {
  userId = session.userId;
}
```

**Success Criteria:**
- [ ] No NaN comparisons
- [ ] Sessions properly expire after 24 hours
- [ ] Test with missing timestamp field

---

### 2.3 Add Input Validation
**Files:** `server/poker-room.ts:176`, `composables/usePokerRoom.ts:133`
**Severity:** Medium

**Problem:**
- No length limits on names (could accept megabytes)
- No sanitization
- No character validation

**Fix:**
```typescript
// server/poker-room.ts
const MAX_NAME_LENGTH = 50;
const sanitizedName = message.name?.trim().substring(0, MAX_NAME_LENGTH);
name: sanitizedName || `Guest-${userId.substring(0, 4)}`,

// composables/usePokerRoom.ts
const joinRoom = async (name: string) => {
  const trimmedName = name.trim().substring(0, 50);
  if (!trimmedName) {
    // TODO: Show error to user
    return;
  }
  ws?.send(JSON.stringify({
    type: 'join',
    name: trimmedName
  }));
};
```

**Success Criteria:**
- [ ] Names limited to 50 characters
- [ ] Empty names rejected with error message
- [ ] Whitespace trimmed automatically

---

### 2.4 Fix Default Story Title
**File:** `server/poker-room.ts:270`
**Severity:** Low (but user-facing)

**Problem:**
- Shows internal test story: "As a user, I want to see my vote reflected in the UI."
- Confusing to users

**Fix:**
```typescript
storyTitle: "",
```

**Success Criteria:**
- [ ] Default story title is empty
- [ ] Users can set their own story title
- [ ] No internal test data visible

---

## 🟡 Phase 3: Security & Polish (Post-Launch)

**Priority:** Next Week
**Estimated Time:** 3 hours
**Status:** Pending

### 3.1 Add Rate Limiting
**Severity:** Medium (Security)

**Implementation:**
- Message flood protection (max 10 messages/second per connection)
- Room creation rate limiting (max 5 rooms/minute per IP)
- Connection throttling (max 100 concurrent connections per Durable Object)

**Files to Create:**
- `server/middleware/ratelimit.ts`

**Success Criteria:**
- [ ] Message flooding blocked
- [ ] Room creation spam prevented
- [ ] Durable Object protected from overload

---

### 3.2 Replace Console.log with Proper Logging
**Files:** Multiple (`composables/usePokerRoom.ts`, `server/poker-room.ts`)
**Severity:** Low

**Implementation:**
- Create logging utility with levels (debug, info, warn, error)
- Environment-aware logging (verbose in dev, quiet in prod)
- Structured logging for better observability

**Success Criteria:**
- [ ] No console.log in production
- [ ] Structured logs for debugging
- [ ] Log levels configurable by environment

---

### 3.3 Documentation Cleanup
**Files:** `DEPLOYMENT.md`, `DEPLOYMENT_WORKERS.md`, `MIGRATION_COMPLETE.md`
**Severity:** Low

**Problem:**
- Empty documentation files (0 bytes)
- Confusing for new developers

**Fix:**
- Delete empty files
- Update README.md with current architecture
- Document WebSocket message protocol

**Success Criteria:**
- [ ] No empty documentation files
- [ ] README reflects current architecture
- [ ] Message protocol documented

---

### 3.4 Improve User ID Generation
**File:** `composables/usePokerRoom.ts:57`
**Severity:** Low (Security)

**Problem:**
- Using Math.random() for user IDs
- Low entropy, potential collisions

**Fix:**
```typescript
import { nanoid } from 'nanoid';

const userId = existingSession?.userId || `user-${nanoid()}`;
```

**Success Criteria:**
- [ ] Using nanoid for user IDs
- [ ] No ID collisions in testing
- [ ] Better security through randomness

---

## 🔵 Phase 4: Long-term Improvements (Future)

**Priority:** Future Iterations
**Estimated Time:** 8+ hours
**Status:** Backlog

### 4.1 Add Comprehensive Test Coverage
**Current State:** No tests

**Test Files to Create:**
- `server/poker-room.test.ts` - Durable Object unit tests
- `composables/usePokerRoom.test.ts` - Composable tests
- `tests/e2e/websocket-flow.spec.ts` - End-to-end WebSocket flow

**Test Scenarios:**
- Room creation and joining
- Voting flow with multiple users
- Reveal and reset functionality
- Connection/disconnection handling
- Error scenarios
- Hibernation and wake-up

**Success Criteria:**
- [ ] >80% code coverage
- [ ] All critical paths tested
- [ ] E2E tests passing in CI

---

### 4.2 Performance Optimizations

**4.2.1 Extract Duplicate State Serialization**
**File:** `server/poker-room.ts:217-263`

**Problem:** Duplicate code in `sendRoomState()` and `broadcastState()`

**Fix:**
```typescript
private serializeRoomState(roomState: RoomStorage) {
  return {
    ...roomState,
    participants: Object.entries(roomState.participants).map(
      ([id, p]) => ({ id, ...p })
    ),
  };
}
```

---

**4.2.2 Add Broadcast Debouncing**

**Problem:** Multiple rapid state changes cause excessive broadcasts

**Fix:** Debounce broadcast with 100ms delay

---

### 4.3 Enhanced Features

**Features from Original Plan (Still Relevant):**
- User name input modal (Phase 3 from old plan)
- Connection status indicators
- Room controls (reveal/reset buttons with better UI)
- Loading states throughout app
- Error toast notifications

**New Feature Ideas:**
- Room expiration (auto-delete after 24 hours of inactivity)
- Room access control (optional passwords)
- Maximum participant limits (prevent abuse)
- Story title editing
- Vote statistics (average, median, etc.)
- Export voting history

---

## Implementation Checklist

### Phase 1 - Critical Fixes ✅
- [ ] 1.1 Fix heartbeat memory leak
- [ ] 1.2 Fix authentication race condition
- [ ] 1.3 Add reconnection backoff
- [ ] 1.4 Add error handling for operations
- [ ] Test all fixes together
- [ ] Deploy to production
- [ ] Verify no regressions

### Phase 2 - High Priority ✅
- [ ] 2.1 Remove unused ws.get.ts
- [ ] 2.2 Fix session timestamp validation
- [ ] 2.3 Add input validation
- [ ] 2.4 Fix default story title
- [ ] Test all fixes together
- [ ] Deploy to production

### Phase 3 - Security & Polish ✅
- [ ] 3.1 Implement rate limiting
- [ ] 3.2 Replace console.log with logging
- [ ] 3.3 Clean up documentation
- [ ] 3.4 Use nanoid for user IDs
- [ ] Security audit
- [ ] Deploy to production

### Phase 4 - Long-term ✅
- [ ] 4.1 Add test coverage
- [ ] 4.2 Performance optimizations
- [ ] 4.3 Enhanced features
- [ ] Full end-to-end testing
- [ ] Production monitoring setup

---

## Success Metrics

### After Phase 1:
- No memory leaks in Durable Objects
- Sessions persist across hibernation
- Reconnection gracefully fails after max attempts
- All operations validate user state

### After Phase 2:
- No dead code in repository
- All inputs validated
- No user-facing test data
- Session handling bulletproof

### After Phase 3:
- Rate limiting prevents abuse
- Clean, structured logs
- Complete documentation
- Secure user ID generation

### After Phase 4:
- >80% test coverage
- Production-ready monitoring
- Feature-complete planning poker app
- Performance optimized

---

## Resources

- **Claude Code Review:** [PR #2](https://github.com/tombakerjr/planning-poker/pull/2)
- **Production URL:** https://planning-poker.tombaker.workers.dev
- **Cloudflare Docs:** https://developers.cloudflare.com/durable-objects/
- **WebSocket Hibernation:** https://developers.cloudflare.com/durable-objects/api/websockets/

---

## Notes

- This plan assumes the app is not yet handling production traffic
- Security items (rate limiting, etc.) should be prioritized if usage increases
- Test coverage can be built incrementally alongside feature work
- Each phase should be completed, tested, and deployed before moving to the next
