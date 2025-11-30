# Phase 7: Timer & Round Management Design

## Overview

Add optional timer for voting rounds with synchronization across participants. Timers help teams maintain focus and keep estimation sessions moving.

## Design Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Who can control timer | Any participant | No roles exist yet; designed for easy role-gating later |
| Synchronization model | Server-authoritative timestamp | Minimal network traffic; clients compute locally |
| Timer expiration behavior | Configurable per-room | Reuses auto-reveal concept; flexibility for teams |
| Duration options | Preset buttons only (30s, 1m, 2m, 5m) | Covers 95% of use cases; simpler UI |
| Audio alerts | None (visual only) | Avoids autoplay complexity; can add later |
| Timer on reset | Cancels automatically | Clean slate mental model |
| UI placement | Between New Round button and voting progress | In the action area where most relevant |

## Data Model

### Server-side (PokerRoom Durable Object)

Add to room state:

```typescript
timerEndTime: number | null    // Unix timestamp (ms) when timer expires
timerAutoReveal: boolean       // Auto-reveal votes when timer expires (default: false)
```

### Client-side (RoomState interface)

```typescript
timerEndTime?: number | null
timerAutoReveal?: boolean
```

### New Message Types

| Type | Payload | Description |
|------|---------|-------------|
| `startTimer` | `{ duration: number }` | Start timer (duration in seconds: 30, 60, 120, 300) |
| `cancelTimer` | none | Cancel running timer |
| `setTimerAutoReveal` | `{ enabled: boolean }` | Toggle auto-reveal on timer expiration |

## Server Logic (PokerRoom)

### Starting a Timer

1. Validate duration is one of: 30, 60, 120, 300 seconds
2. Set `timerEndTime = Date.now() + (duration * 1000)`
3. Broadcast room state update to all clients

### Timer Expiration Handling

The server does NOT run an interval. Instead, on any incoming message:

1. Check if `timerEndTime !== null && Date.now() >= timerEndTime`
2. If expired AND `timerAutoReveal === true` AND `votesRevealed === false`:
   - Set `votesRevealed = true`
3. Set `timerEndTime = null`
4. Broadcast update

Clients handle visual expiration independently since they know the end time.

### Canceling a Timer

1. Set `timerEndTime = null`
2. Broadcast update

### On Reset (New Round)

Existing reset logic plus:
- Set `timerEndTime = null` (cancel any running timer)
- `timerAutoReveal` persists (room preference)

### Future Role-Gating

Timer actions route through a helper for easy role checks later:

```typescript
function canControlTimer(userId: string): boolean {
  // Currently: anyone can control
  // Future: check if user has facilitator role
  return true;
}
```

## Client Logic (usePokerRoom composable)

### New Methods

```typescript
startTimer(duration: number): void    // Send startTimer message
cancelTimer(): void                   // Send cancelTimer message
setTimerAutoReveal(enabled: boolean): void
```

### New Computed State

```typescript
timerRemaining: ComputedRef<number | null>  // Seconds remaining, null if no timer
timerExpired: ComputedRef<boolean>          // True when timer just reached zero
```

### Timer Countdown Logic

1. When `timerEndTime` is set, start local `setInterval` (1 second)
2. Calculate: `Math.max(0, Math.ceil((timerEndTime - Date.now()) / 1000))`
3. When remaining hits 0, set `timerExpired = true` (triggers visual alert)
4. Clear interval when timer cancelled or component unmounts
5. On reconnection, `timerEndTime` comes in room state update automatically

## UI Design

### Timer Controls

Located between New Round button and voting progress indicator.

**When no timer running:**
```
[30s] [1m] [2m] [5m]
```

**When timer running:**
```
  2:00  [Cancel]
```

### Countdown Display

| State | Appearance |
|-------|------------|
| Normal (>10s) | Neutral color, `M:SS` format |
| Warning (≤10s) | Yellow/orange highlight |
| Expired | Red background, "Time's up!" text |

Format examples: "2:00", "0:30", "0:05"

### Timer Auto-Reveal Toggle

Checkbox near timer controls: "Auto-reveal on timer"
- Follows same pattern as existing auto-reveal toggle
- Persists as room setting

### Visual Expiration Alert

- Countdown area pulses briefly when hitting zero
- "Time's up!" replaces countdown for ~3 seconds, then clears
- No modal or blocking UI

## Testing Strategy

### Unit Tests (poker-room.test.ts)

- `startTimer` sets correct `timerEndTime`
- `startTimer` rejects invalid durations
- `cancelTimer` clears `timerEndTime`
- Reset clears `timerEndTime`
- Timer expiration + `timerAutoReveal` triggers reveal
- Timer expiration without `timerAutoReveal` doesn't reveal
- `setTimerAutoReveal` updates setting

### Component Tests

- Timer buttons appear when no timer running
- Countdown + cancel button appear when timer running
- Countdown updates every second
- Warning state at ≤10 seconds
- Expired state shows "Time's up!"

### E2E Tests

- Start timer, verify synced across multiple clients
- Cancel timer, verify cleared for all clients
- Timer expiration with auto-reveal enabled
- Reset during active timer cancels it

## Implementation Notes

- Timer precision of 1-2 seconds is acceptable
- No audio alerts in initial implementation
- Designed for future role-gating without breaking changes

## Known Limitations

### Timer Expiration Requires Activity

The server checks for timer expiration **on message receipt**, not via a background interval. This design choice:

- **Pros**: No server-side intervals (efficient for Durable Objects), simpler implementation
- **Cons**: Auto-reveal requires at least one message after timer expires

**Behavior**: If a timer expires with `timerAutoReveal=true` but no messages arrive:
- Client countdown shows "Time's up!" (computed locally from `timerEndTime`)
- Server won't auto-reveal until the next message (vote, ping, heartbeat, etc.)
- Heartbeats run every 30 seconds, so worst-case delay is ~30 seconds

**Why this is acceptable**:
1. Active voting rooms have continuous message flow (votes, pings)
2. Client UI shows timer expired immediately (visual feedback correct)
3. Heartbeat ensures eventual server-side processing
4. Adding DO alarms would significantly increase complexity

**Future enhancement**: If sub-second auto-reveal is needed, implement using Durable Object alarms.

### Timer Clears on Multiple Actions

Timer is automatically cancelled when:
- Reset (new round) is triggered
- Voting scale is changed (votes cleared)
- Votes are manually revealed (timer's purpose fulfilled)

This ensures clean state and prevents "phantom" timers.
