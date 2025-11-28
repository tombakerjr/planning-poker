# Voting Statistics & Analytics Design

**Date:** 2025-01-28
**Issue:** #25 - Phase 6B: Voting Statistics & Analytics
**Status:** Approved

## Overview

Calculate and display voting statistics when votes are revealed, helping teams understand consensus and identify outliers.

## Design Decisions

### 1. UI Placement
**Decision:** Replace VotingArea content with statistics when votes are revealed.

**Rationale:** The VotingArea becomes unused after reveal (can't vote again). Placing statistics where votes were provides natural flow - you vote, then see results in the same spot.

### 2. Non-Numeric Scale Handling
**Decision:** Smart detection - full statistics for numeric scales, distribution-only for non-numeric (t-shirt sizes).

**Rationale:** Calculating "mean" of XS, S, M, L is meaningless. Automatic detection provides rich stats when meaningful and avoids misleading calculations for ordinal data.

- **Numeric scales:** fibonacci, modified-fibonacci, powers-of-2, linear
- **Non-numeric scales:** t-shirt, custom (when non-numeric)

### 3. Special Vote Handling
**Decision:** Exclude `?` and `☕` from calculations, show note about excluded votes. Convert `½` to 0.5.

**Rationale:** Transparency - users see accurate statistics while understanding some participants didn't provide estimable votes.

### 4. Distribution Visualization
**Decision:** Horizontal bars using Tailwind CSS (no chart library).

**Rationale:** Fits naturally in the layout, easy to scan, lightweight implementation.

### 5. Trend Indicators
**Decision:** Skip for initial implementation.

**Rationale:** Trends require persisting historical data across rounds, adding significant complexity. Core statistics provide immediate value - trends can be a future enhancement.

## Architecture

### Component Structure

```
VotingArea.vue (modified)
├── When !votesRevealed → Show voting cards (existing)
└── When votesRevealed → Show <VotingStatistics>

VotingStatistics.vue (new)
├── StatsSummary - mean, median, mode, stddev, range, consensus %
├── ConsensusBar - color-coded progress bar
├── DistributionChart - horizontal bar chart
└── ExcludedVotesNote - shows excluded special votes
```

### Statistics Composable

New `composables/useVotingStatistics.ts`:

```typescript
interface VotingStatistics {
  // Core stats (null for non-numeric scales)
  mean: number | null;
  median: number | null;
  standardDeviation: number | null;
  range: { min: number; max: number } | null;

  // Always available
  mode: string | number;
  modeCount: number;
  consensusPercentage: number;
  distribution: Array<{ value: string | number; count: number; percentage: number }>;

  // Metadata
  totalVotes: number;
  excludedVotes: Array<{ value: string; count: number }>;
  isNumericScale: boolean;
}

function useVotingStatistics(
  participants: Ref<Participant[]>,
  scaleType: Ref<string>
): ComputedRef<VotingStatistics>
```

### Visual Indicators

**Consensus Bar Colors:**
- Red (`bg-red-500`): < 50% consensus
- Yellow (`bg-yellow-500`): 50-75% consensus
- Green (`bg-green-500`): > 75% consensus

**Outlier Highlighting:**
- Votes > 2 standard deviations from mean get visual indicator
- Only applicable for numeric scales

## Data Flow

1. `VotingArea` receives `roomState` from injected `pokerRoom`
2. When `votesRevealed === true`, render `<VotingStatistics>` instead of cards
3. `VotingStatistics` calls `useVotingStatistics(participants, votingScale)`
4. Composable computes all statistics reactively
5. Child components render computed values

## Statistics Calculations

### Mean
```typescript
sum(numericVotes) / numericVotes.length
```

### Median
```typescript
// Sort votes, return middle value (or average of two middle values)
```

### Mode
```typescript
// Most frequent vote value
```

### Standard Deviation
```typescript
sqrt(sum((vote - mean)²) / n)
```

### Consensus Percentage
```typescript
(modeCount / totalVotes) * 100
```

### Outliers
```typescript
// Votes where |vote - mean| > 2 * standardDeviation
```

## Test Strategy

1. **Unit tests** for `useVotingStatistics`:
   - Numeric scale calculations (fibonacci)
   - Non-numeric scale (t-shirt) - verify no mean/median
   - Special vote exclusion
   - Edge cases (single vote, all same vote, empty)

2. **Component tests** for `VotingStatistics.vue`:
   - Renders correct stats
   - Consensus bar colors
   - Distribution chart accuracy
   - Excluded votes note

3. **E2E tests**:
   - Full flow: vote → reveal → see statistics
   - Verify statistics match expected values

## Success Criteria

- [ ] Statistics calculated correctly for all vote scales
- [ ] Visual indicators accurate and helpful
- [ ] Statistics update in real-time on reveal
- [ ] Works with non-numeric scales (t-shirt sizes)
- [ ] Special votes excluded with transparency note
