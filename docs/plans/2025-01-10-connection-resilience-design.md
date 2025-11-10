# Connection Resilience Design (Phase 5D)

**Date:** 2025-01-10
**Issue:** #22
**Phase:** Sprint 1 - Phase 5D

## Overview

Enhance connection resilience for international users with high-latency or flaky internet connections (Central/South America, Eastern Europe). Support users on 3G connections with 500ms+ latency while maintaining a smooth user experience.

## Scope

**In Scope (Phase 5D):**
- Connection quality monitoring (latency + jitter)
- Message queuing during disconnections
- Network state detection (browser events + heartbeat validation)
- Enhanced reconnection with longer timeouts
- UI feedback system (connection indicator + toasts)

**Out of Scope:**
- Optimistic UI updates (deferred to future phase)
- Compression for low-bandwidth scenarios
- Bandwidth detection and adaptation

## Goals

- App remains usable on 3G connections
- Graceful handling of 500ms+ latency
- No message loss during brief disconnections (<15s)
- Clear feedback on connection issues
- Automatic recovery without page refresh

## Architecture

### High-Level Design

The connection resilience system is built primarily **client-side** in `composables/usePokerRoom.ts` with minimal server changes. This keeps the Durable Object simple and puts intelligence at the edge where users need it.

**Key Components:**
1. Connection Quality Monitor
2. Message Queue System
3. Network State Detector
4. Enhanced Reconnection Logic
5. UI Feedback System

**Data Flow:**
```
Network events → Update state → Queue messages if offline →
Attempt reconnection → Flush queue → Update UI
```

---

## Component 1: Connection Quality Monitor

### Purpose
Measure connection quality based on latency and jitter (variance) to provide accurate feedback to users.

### Implementation

**New state in `usePokerRoom.ts`:**
```typescript
const latencyMeasurements = ref<number[]>([])  // Rolling window of last 3 RTT
const currentLatency = ref<number | null>(null)
const connectionQuality = ref<'good' | 'fair' | 'poor' | 'disconnected'>('disconnected')
```

**Latency measurement:**
- Use incrementing ping IDs to track round-trip time (RTT)
- Send: `{ type: 'ping', id: pingId, timestamp: Date.now() }`
- Receive: `{ type: 'pong', id: pingId }`
- Calculate: RTT = `Date.now() - pingTimestamp`
- Store in rolling array (max 3 measurements)

**Quality calculation:**
```typescript
function calculateQuality(measurements: number[]): Quality {
  if (measurements.length === 0) return 'disconnected'

  const avgLatency = measurements.reduce((a, b) => a + b, 0) / measurements.length

  // Calculate jitter (standard deviation)
  const variance = measurements.reduce((sum, val) =>
    sum + Math.pow(val - avgLatency, 2), 0) / measurements.length
  const jitter = Math.sqrt(variance)

  // Good: Low latency AND stable
  if (avgLatency < 200 && jitter < 50) return 'good'

  // Poor: High latency OR very unstable
  if (avgLatency > 500 || jitter > 150) return 'poor'

  // Fair: Everything in between
  return 'fair'
}
```

**Quality definitions:**
- **Good**: <200ms average, <50ms jitter (stable, fast connection)
- **Fair**: Medium latency or moderate jitter (usable but not ideal)
- **Poor**: >500ms average OR >150ms jitter (degraded experience)
- **Disconnected**: No active WebSocket connection

**Server changes:**
Modify ping handler in `server/poker-room.ts` to echo ping ID:
```typescript
case "ping":
  ws.send(JSON.stringify({ type: "pong", id: message.id }))
  return
```

**Exposed API:**
```typescript
return {
  connectionQuality,      // computed: 'good' | 'fair' | 'poor' | 'disconnected'
  currentLatency,         // ref: number | null
  averageLatency,         // computed: number | null
  jitter,                 // computed: number | null
}
```

---

## Component 2: Message Queue System

### Purpose
Prevent message loss during brief disconnections by queuing critical actions and replaying them on reconnection.

### Implementation

**Queue structure:**
```typescript
interface QueuedMessage {
  message: WebSocketMessage       // The actual message to send
  timestamp: number                // When it was queued
  action: 'vote' | 'setStory' | 'setScale' | 'setAutoReveal'
}

const messageQueue = ref<QueuedMessage[]>([])
const MAX_QUEUE_SIZE = 10
const MAX_MESSAGE_AGE_MS = 15000  // 15 seconds
```

**Queuing logic:**
```typescript
function queueMessage(message: WebSocketMessage, action: string) {
  // Don't queue if connection is open
  if (ws?.readyState === WebSocket.OPEN) return false

  // Remove stale messages (>15s old)
  messageQueue.value = messageQueue.value.filter(
    m => Date.now() - m.timestamp < MAX_MESSAGE_AGE_MS
  )

  // For votes: replace existing queued vote (deduplication)
  if (action === 'vote') {
    messageQueue.value = messageQueue.value.filter(m => m.action !== 'vote')
  }

  // Check size limit
  if (messageQueue.value.length >= MAX_QUEUE_SIZE) {
    toast.warning('Message queue full. Please wait for reconnection.')
    return false
  }

  // Add to queue
  messageQueue.value.push({ message, timestamp: Date.now(), action })
  return true
}
```

**Flush logic (on reconnection):**
```typescript
async function flushMessageQueue() {
  if (!ws || ws.readyState !== WebSocket.OPEN) return

  // Remove stale messages before flushing
  const validMessages = messageQueue.value.filter(
    m => Date.now() - m.timestamp < MAX_MESSAGE_AGE_MS
  )

  const expiredCount = messageQueue.value.length - validMessages.length

  // Send each queued message
  for (const queued of validMessages) {
    try {
      ws.send(JSON.stringify(queued.message))
      await new Promise(resolve => setTimeout(resolve, 100)) // 100ms delay between sends
    } catch (error) {
      logger.error('Failed to flush queued message:', error)
    }
  }

  // Clear queue after flush
  messageQueue.value = []

  // User feedback
  if (validMessages.length > 0) {
    toast.success(`Reconnected! Sent ${validMessages.length} queued message(s).`)
  }
  if (expiredCount > 0) {
    toast.info(`${expiredCount} stale message(s) discarded.`)
  }
}
```

**Integration:**
- Call `queueMessage()` in `vote()`, `setStoryTitle()`, `setVotingScale()`, `setAutoReveal()` when WebSocket is not open
- Call `flushMessageQueue()` in `ws.onopen` handler after successful reconnection
- Only queue critical actions (not reveals/resets - those are room-wide actions better re-triggered manually)

**Exposed API:**
```typescript
return {
  queuedMessageCount: computed(() => messageQueue.value.length)
}
```

---

## Component 3: Network State Detector

### Purpose
Detect network state changes using browser events for instant feedback and heartbeat validation for accuracy.

### Implementation

**New state:**
```typescript
const networkState = ref<'online' | 'offline' | 'unstable'>('online')
const lastSuccessfulPong = ref<number>(Date.now())
const missedPongs = ref<number>(0)
```

**Browser event listeners:**
```typescript
function setupNetworkListeners() {
  if (!process.client) return

  let onlineDebounce: ReturnType<typeof setTimeout> | null = null
  let offlineDebounce: ReturnType<typeof setTimeout> | null = null

  const handleOnline = () => {
    // Debounce to prevent flickering on rapid transitions
    if (onlineDebounce) clearTimeout(onlineDebounce)
    onlineDebounce = setTimeout(() => {
      logger.debug('Browser detected online')
      networkState.value = 'online'

      // Trigger reconnection if we're not connected
      if (!ws || ws.readyState !== WebSocket.OPEN) {
        toast.info('Network restored. Reconnecting...')
        connectToRoom()
      }
    }, 500)
  }

  const handleOffline = () => {
    if (offlineDebounce) clearTimeout(offlineDebounce)
    offlineDebounce = setTimeout(() => {
      logger.debug('Browser detected offline')
      networkState.value = 'offline'
      toast.warning('Network connection lost')
    }, 500)
  }

  window.addEventListener('online', handleOnline)
  window.addEventListener('offline', handleOffline)

  // Cleanup on unmount
  onUnmounted(() => {
    window.removeEventListener('online', handleOnline)
    window.removeEventListener('offline', handleOffline)
    if (onlineDebounce) clearTimeout(onlineDebounce)
    if (offlineDebounce) clearTimeout(offlineDebounce)
  })
}
```

**Heartbeat validation:**
```typescript
const HEARTBEAT_TIMEOUT_MS = 35000  // 35s (server sends every 30s)
const MAX_MISSED_PONGS = 2

// Modified startHeartbeat to track pongs
heartbeatInterval = setInterval(() => {
  if (ws && ws.readyState === WebSocket.OPEN) {
    const pingId = Date.now()
    pingTimestamps.set(pingId, Date.now())
    ws.send(JSON.stringify({ type: 'ping', id: pingId }))

    // Check if we haven't received a pong recently
    const timeSinceLastPong = Date.now() - lastSuccessfulPong.value
    if (timeSinceLastPong > HEARTBEAT_TIMEOUT_MS) {
      missedPongs.value++

      if (missedPongs.value >= MAX_MISSED_PONGS) {
        logger.warn('Multiple missed pongs - connection unstable')
        networkState.value = 'unstable'

        // Force reconnection
        ws.close()
      }
    }
  }
}, HEARTBEAT_INTERVAL_MS)

// In handleMessage for 'pong' type:
case 'pong':
  const pingTimestamp = pingTimestamps.get(message.id)
  if (pingTimestamp) {
    const rtt = Date.now() - pingTimestamp
    currentLatency.value = rtt
    latencyMeasurements.value.push(rtt)
    if (latencyMeasurements.value.length > 3) {
      latencyMeasurements.value.shift()
    }
    pingTimestamps.delete(message.id)
  }

  lastSuccessfulPong.value = Date.now()
  missedPongs.value = 0
  if (networkState.value === 'unstable') {
    networkState.value = 'online'
  }
  break
```

**State transitions:**
- `offline`: Browser events indicate no network
- `unstable`: Network exists but pongs are missed (packet loss, high latency, server issues)
- `online`: Browser says online AND pongs received regularly

**Exposed API:**
```typescript
return {
  networkState,  // ref: 'online' | 'offline' | 'unstable'
}
```

---

## Component 4: Enhanced Reconnection Logic

### Purpose
Support high-latency connections with longer timeouts, more attempts, and jitter to prevent thundering herd.

### Implementation

**Updated constants:**
```typescript
const MAX_RECONNECT_ATTEMPTS = 15        // Increased from 10
const MAX_RECONNECT_DELAY_MS = 60000     // Increased from 30s to 60s
const BASE_DELAY_MS = 1000               // Starting delay
const JITTER_FACTOR = 0.3                // ±30% randomization
```

**Enhanced backoff with jitter:**
```typescript
function calculateReconnectDelay(attempt: number): number {
  // Exponential: 1s, 2s, 4s, 8s, 16s, 32s, 60s, 60s...
  const exponentialDelay = Math.min(
    BASE_DELAY_MS * Math.pow(2, attempt),
    MAX_RECONNECT_DELAY_MS
  )

  // Add jitter to prevent thundering herd
  // Example: 30s ± 30% = 21s to 39s
  const jitter = exponentialDelay * JITTER_FACTOR * (Math.random() - 0.5) * 2
  const delayWithJitter = exponentialDelay + jitter

  return Math.max(BASE_DELAY_MS, delayWithJitter)  // Never less than 1s
}
```

**Modified reconnection logic:**
```typescript
ws.onclose = (event) => {
  logger.debug('WebSocket closed:', event.code, event.reason)
  stopHeartbeat()

  if (event.code !== 1000) {  // Not normal closure
    if (reconnectAttempts >= MAX_RECONNECT_ATTEMPTS) {
      status.value = 'CLOSED'
      networkState.value = 'offline'
      toast.error('Unable to reconnect. Please refresh the page.', 15000)
      return
    }

    status.value = 'RECONNECTING'
    const delay = calculateReconnectDelay(reconnectAttempts)

    logger.debug(
      `Reconnecting in ${Math.round(delay)}ms ` +
      `(attempt ${reconnectAttempts + 1}/${MAX_RECONNECT_ATTEMPTS})`
    )

    // Progressive toast messages based on attempt count
    if (reconnectAttempts === 0) {
      toast.warning('Connection lost. Reconnecting...', delay + 1000)
    } else if (reconnectAttempts === 5) {
      toast.warning('Still reconnecting... This may take a moment.', delay + 1000)
    } else if (reconnectAttempts >= 10) {
      toast.error('Connection issues persist. Check your network.', delay + 1000)
    }

    reconnectTimeout = setTimeout(() => {
      reconnectAttempts++
      connectToRoom()
    }, delay)
  } else {
    status.value = 'CLOSED'
  }
}
```

**Key improvements:**
- More attempts (15 vs 10) for flaky connections
- Longer max delay (60s vs 30s) for recovering from prolonged outages
- Jitter prevents all clients reconnecting simultaneously (reduces server load)
- Progressive user feedback based on attempt count

---

## Component 5: UI Feedback System

### Purpose
Provide clear, persistent visibility into connection status and quality.

### Implementation

**Updated status ref:**
```typescript
const status = ref<'CONNECTING' | 'OPEN' | 'RECONNECTING' | 'OFFLINE' | 'CLOSED'>('CLOSED')
```

**New component:** `components/ConnectionIndicator.vue`

```vue
<template>
  <div
    v-if="shouldShow"
    class="fixed top-4 right-4 z-50 flex items-center gap-2 px-3 py-2 rounded-lg shadow-lg transition-all duration-300"
    :class="containerClass"
  >
    <div class="relative">
      <div
        class="w-3 h-3 rounded-full"
        :class="dotClass"
      ></div>
      <div
        v-if="quality !== 'disconnected' && quality !== 'poor'"
        class="absolute inset-0 w-3 h-3 rounded-full animate-ping opacity-20"
        :class="dotClass"
      ></div>
    </div>

    <div class="flex flex-col">
      <span class="text-sm font-medium" :class="textClass">
        {{ statusText }}
      </span>
      <span
        v-if="showLatency"
        class="text-xs opacity-75"
        :class="textClass"
      >
        {{ latencyText }}
      </span>
    </div>

    <div
      v-if="queuedCount > 0"
      class="ml-2 px-2 py-0.5 bg-white/20 rounded text-xs font-medium"
      :class="textClass"
    >
      {{ queuedCount }} queued
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'

const props = defineProps<{
  quality: 'good' | 'fair' | 'poor' | 'disconnected'
  status: string
  latency: number | null
  jitter: number | null
  queuedCount: number
}>()

const shouldShow = computed(() => {
  // Always show if disconnected, reconnecting, or poor quality
  return props.quality === 'disconnected' ||
         props.quality === 'poor' ||
         props.status === 'RECONNECTING' ||
         props.status === 'CONNECTING' ||
         props.queuedCount > 0
})

const containerClass = computed(() => {
  if (props.quality === 'disconnected') return 'bg-gray-700 dark:bg-gray-800'
  if (props.quality === 'poor' || props.status === 'RECONNECTING') return 'bg-red-600 dark:bg-red-700'
  if (props.quality === 'fair') return 'bg-yellow-600 dark:bg-yellow-700'
  return 'bg-green-600 dark:bg-green-700'
})

const dotClass = computed(() => {
  if (props.quality === 'disconnected') return 'bg-gray-400'
  if (props.quality === 'poor') return 'bg-red-300'
  if (props.quality === 'fair') return 'bg-yellow-300'
  return 'bg-green-300'
})

const textClass = computed(() => 'text-white')

const statusText = computed(() => {
  if (props.status === 'RECONNECTING') return 'Reconnecting...'
  if (props.status === 'CONNECTING') return 'Connecting...'
  if (props.quality === 'disconnected') return 'Disconnected'
  if (props.quality === 'poor') return 'Poor Connection'
  if (props.quality === 'fair') return 'Fair Connection'
  return 'Connected'
})

const showLatency = computed(() =>
  props.quality !== 'disconnected' && props.latency !== null
)

const latencyText = computed(() => {
  if (!props.latency) return ''
  const jitterText = props.jitter ? ` ±${Math.round(props.jitter)}ms` : ''
  return `${Math.round(props.latency)}ms${jitterText}`
})
</script>
```

**Usage in `pages/room/[id].vue`:**
```vue
<template>
  <div>
    <ConnectionIndicator
      :quality="connectionQuality"
      :status="status"
      :latency="currentLatency"
      :jitter="jitter"
      :queued-count="queuedMessageCount"
    />

    <!-- Rest of room page -->
  </div>
</template>
```

**Toast strategy:**
- **Connection lost**: Warning toast (automatic, first reconnect attempt)
- **Reconnecting**: Progressive toasts at attempts 0, 5, and 10+
- **Reconnected**: Success toast (automatic)
- **Queue full**: Warning toast when max queue size reached
- **Queue flushed**: Success toast with count of sent messages
- **Stale messages**: Info toast if any messages expired
- **Max retries**: Error toast with "please refresh" message (15s duration)

**Display behavior:**
- Always show if: `disconnected`, `poor`, `reconnecting`, or has queued messages
- Auto-hide when: `good` quality with no queued messages
- Animate in/out with smooth transitions
- Don't obstruct voting area or participant list

**Exposed from composable:**
```typescript
return {
  // Connection monitoring
  connectionQuality,
  currentLatency,
  averageLatency,
  jitter,
  networkState,
  queuedMessageCount,

  // Existing returns...
  status,
  roomState,
  // ... etc
}
```

---

## Error Handling & Edge Cases

### Edge Case: Queue overflow during long disconnection
- After 10 messages queued, reject new actions
- Show toast: "Message queue full. Please wait for reconnection."
- User can still browse room state, just can't add more actions
- On reconnect, flush what's queued, user can retry failed actions

### Edge Case: Stale queue messages
- Scenario: User votes "5", disconnects for 20 seconds, story changed
- Solution: 15s max age removes stale messages before flush
- User sees toast: "X stale message(s) discarded." (if any removed)
- Rationale: In planning poker, context changes quickly (story updates, resets)

### Edge Case: Reconnection during queue flush
- If connection drops mid-flush, re-queue remaining unsent messages
- Track flush progress with `flushingQueue` flag to prevent double-flush
- Resume flush on next successful reconnection

### Edge Case: Rapid online/offline transitions
- Debounce browser events (500ms) to prevent UI flickering
- Only trigger reconnection if offline state persists for >500ms
- Prevents unnecessary reconnection attempts during momentary blips

### Edge Case: WebSocket open but server unreachable
- Heartbeat detects this via missed pongs
- Mark as 'unstable' after 1 missed pong (warning)
- Force close after 2 missed pongs, trigger reconnection
- Prevents "zombie" connections that appear open but don't work

### Error Recovery

**JSON parse errors:**
- Log error with context
- Close connection gracefully (code 1003)
- Trigger reconnection logic

**Send failures during queue flush:**
- Log error
- Skip failed message
- Continue flushing remaining messages
- Don't abort entire flush on single failure

**Storage quota exceeded:**
- Catch `QuotaExceededError` when writing to localStorage
- Clear old session data
- Retry save operation
- Show toast if storage persistently unavailable

**Network event listener leaks:**
- Always cleanup listeners in `onUnmounted`
- Clear all debounce timers on unmount
- Prevents memory leaks in SPA navigation

### Performance Considerations

**Memory:**
- Latency measurements: Only store last 3 (minimal footprint)
- Queue size: Hard limit 10 messages (prevent unbounded growth)
- Ping timestamps: Clean up after pong received (prevent Map growth)

**CPU:**
- Jitter calculation: Compute on-demand via computed property
- Quality updates: Only on heartbeat interval (every 25s)
- Debounce browser events: Prevent excessive recalculations

**Network:**
- Ping/pong overhead: ~100 bytes every 25s (negligible)
- Queue flush: 100ms delay between messages (prevent rate limiting)

### Backward Compatibility

**Server changes:**
- Ping/pong ID echoing is backward compatible
- Old clients ignore the `id` field, continue working
- New clients gracefully degrade if server doesn't echo ID (no quality metrics)

**Client changes:**
- All new features are client-side additions
- No breaking changes to existing WebSocket message protocol
- Existing functionality remains unchanged

---

## Testing Strategy

### Unit Tests

**File:** `composables/usePokerRoom.test.ts` (new)

```typescript
describe('Connection Quality Monitor', () => {
  test('calculates good quality with low latency and jitter', () => {
    // Measurements: [100ms, 110ms, 105ms]
    // Avg: 105ms, Jitter: ~4ms → 'good'
  })

  test('calculates poor quality with high jitter', () => {
    // Measurements: [100ms, 300ms, 150ms]
    // Avg: 183ms, Jitter: ~83ms → 'poor' (high jitter)
  })

  test('calculates poor quality with high latency', () => {
    // Measurements: [600ms, 650ms, 620ms]
    // Avg: 623ms → 'poor' (high latency)
  })

  test('calculates fair quality with moderate metrics', () => {
    // Measurements: [250ms, 280ms, 260ms]
    // Avg: 263ms, Jitter: ~12ms → 'fair'
  })
})

describe('Message Queue', () => {
  test('queues vote when WebSocket closed', () => {
    // Close WS, call vote(), verify queue has message
  })

  test('deduplicates votes in queue', () => {
    // Queue vote "5", then vote "8", verify only "8" in queue
  })

  test('does not deduplicate non-vote actions', () => {
    // Queue setStory "A", then setStory "B", verify both in queue
  })

  test('removes stale messages (>15s)', () => {
    // Add message, advance time 16s, verify removed before flush
  })

  test('flushes queue on reconnection', () => {
    // Queue 3 messages, reconnect, verify all sent in order
  })

  test('respects max queue size', () => {
    // Queue 11 messages, verify only 10 stored + warning toast
  })

  test('shows toast for expired messages', () => {
    // Queue messages, advance time 16s, flush, verify info toast
  })
})

describe('Network State Detection', () => {
  test('detects browser offline event', () => {
    // Trigger 'offline' event, verify networkState = 'offline'
  })

  test('detects browser online event', () => {
    // Trigger 'online' event, verify networkState = 'online'
  })

  test('marks unstable after missed pongs', () => {
    // Skip 2 heartbeat responses, verify networkState = 'unstable'
  })

  test('recovers to online after successful pong', () => {
    // From 'unstable', receive pong, verify 'online'
  })

  test('debounces rapid online/offline transitions', () => {
    // Trigger offline, online within 500ms, verify no state change
  })
})

describe('Enhanced Reconnection', () => {
  test('adds jitter to delay calculation', () => {
    // Calculate 100 delays for same attempt, verify variance exists
  })

  test('respects max delay of 60s', () => {
    // Attempt 20, verify delay ≤ 60000ms
  })

  test('respects min delay of 1s', () => {
    // All attempts, verify delay ≥ 1000ms
  })

  test('gives up after 15 attempts', () => {
    // Fail 15 times, verify status = 'CLOSED' + error toast
  })

  test('shows progressive toast messages', () => {
    // Verify different toasts at attempts 0, 5, 10+
  })
})
```

**File:** `server/poker-room.test.ts` (additions)

```typescript
describe('Ping/Pong with ID', () => {
  test('echoes ping ID in pong response', async () => {
    // Send: { type: 'ping', id: 123 }
    // Expect: { type: 'pong', id: 123 }
  })

  test('handles ping without ID (backward compatibility)', async () => {
    // Send: { type: 'ping' }
    // Expect: { type: 'pong' } (no error)
  })
})
```

### Manual Testing with Chrome DevTools

**Test 1: Fast 3G (Fair quality expected)**
- Network: Fast 3G (1.5Mbps, 500ms latency, 0% packet loss)
- Expected: Connection indicator shows "Fair Connection" with ~500ms latency
- Actions: Vote, change story, verify queuing not needed
- Success: All actions complete, just slower feedback

**Test 2: Slow 3G (Poor quality expected)**
- Network: Slow 3G (500Kbps, 2000ms latency, 5% packet loss)
- Expected: "Poor Connection" indicator, potential 'unstable' state
- Actions: Vote multiple times, observe queue behavior
- Success: Messages queued if disconnections occur, flushed on reconnect

**Test 3: Offline → Online transition**
- Network: Start online, then "Offline" in DevTools
- Expected: Instant "Disconnected" indicator via browser event
- Actions: Attempt to vote (queued), change story (queued)
- Network: Restore to "Online"
- Expected: Auto-reconnect, queue flush, success toast
- Success: All queued actions applied to room

**Test 4: Flaky connection (Unstable detection)**
- Network: Custom with intermittent packet loss (10-20%)
- Expected: Heartbeat misses trigger 'unstable' state
- Actions: Continue using app, observe auto-reconnection
- Success: App remains usable despite flakiness

**Test 5: Long disconnection (Stale message handling)**
- Network: Disconnect for 20+ seconds
- Actions: Vote, change story multiple times while offline
- Network: Reconnect after 20s
- Expected: Toast indicating stale messages discarded
- Success: Only recent actions applied (vote deduplicated)

**Test 6: Queue overflow**
- Network: Offline
- Actions: Perform 15+ different actions (story changes)
- Expected: After 10, toast "Message queue full"
- Success: Queue capped at 10, user notified

### E2E Tests (Optional)

**File:** `e2e/connection-resilience.spec.ts` (new)

```typescript
test('displays connection indicator on poor connection', async ({ page }) => {
  // Simulate slow network, verify indicator appears
})

test('queues and flushes messages on reconnection', async ({ page }) => {
  // Go offline, vote, go online, verify vote applied
})

test('shows progressive reconnection toasts', async ({ page }) => {
  // Force multiple reconnection attempts, verify toast progression
})
```

---

## Success Criteria

- [ ] App remains usable on simulated 3G connection
- [ ] Connection quality indicator accurately reflects latency/jitter
- [ ] No message loss during disconnections <15 seconds
- [ ] Graceful handling of 500ms+ latency (fair/poor indicators)
- [ ] Automatic reconnection without page refresh (up to 15 attempts)
- [ ] Clear user feedback via toasts and persistent indicator
- [ ] Unit test coverage >80% for new code
- [ ] Manual testing passes all 6 scenarios

---

## Implementation Checklist

- [ ] Update server ping/pong handler to echo ID
- [ ] Implement connection quality monitor in composable
- [ ] Implement message queue system
- [ ] Implement network state detection
- [ ] Enhance reconnection logic with jitter
- [ ] Create ConnectionIndicator component
- [ ] Integrate ConnectionIndicator into room page
- [ ] Write unit tests for all new features
- [ ] Perform manual testing with simulated 3G
- [ ] Update CLAUDE.md with new features
- [ ] Create pull request

---

## Future Enhancements (Out of Scope)

- **Optimistic UI updates**: Apply changes immediately, rollback on failure
- **Compression**: gzip/brotli for WebSocket messages
- **Bandwidth detection**: Adapt message frequency based on available bandwidth
- **Offline mode**: Full offline support with sync on reconnect
- **Connection history**: Track and display connection quality over time
