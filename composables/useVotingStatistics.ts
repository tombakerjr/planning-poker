import { computed, type ComputedRef, type Ref } from 'vue';

import type { Participant } from './usePokerRoom';

// Special votes that should be excluded from numeric calculations
const EXCLUDED_VOTES = ['?', '☕'];

// Non-numeric scale types
const NON_NUMERIC_SCALES = ['t-shirt', 'custom'];

export interface DistributionItem {
  value: string | number;
  count: number;
  percentage: number;
}

export interface ExcludedVote {
  value: string;
  count: number;
}

export interface VotingStatistics {
  // Core stats (null for non-numeric scales or no votes)
  mean: number | null;
  median: number | null;
  standardDeviation: number | null;
  range: { min: number; max: number } | null;

  // Always available (null only if no votes)
  mode: string | number | null;
  modeCount: number;
  consensusPercentage: number;
  distribution: DistributionItem[];

  // Outliers (only for numeric scales)
  outliers: number[];

  // Metadata
  totalVotes: number;
  excludedVotes: ExcludedVote[];
  isNumericScale: boolean;
}

/**
 * Convert vote value to numeric, handling special cases like '½'
 */
function toNumeric(vote: string | number): number | null {
  if (typeof vote === 'number') return vote;
  if (vote === '½') return 0.5;
  const parsed = parseFloat(vote);
  return isNaN(parsed) ? null : parsed;
}

/**
 * Check if a vote should be excluded from calculations
 */
function isExcludedVote(vote: string | number | null): boolean {
  if (vote === null) return true;
  return EXCLUDED_VOTES.includes(String(vote));
}

/**
 * Calculate mean of numeric array
 */
function calculateMean(values: number[]): number {
  if (values.length === 0) return 0;
  return values.reduce((sum, v) => sum + v, 0) / values.length;
}

/**
 * Calculate median of numeric array
 */
function calculateMedian(values: number[]): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  if (sorted.length % 2 === 0) {
    return (sorted[mid - 1] + sorted[mid]) / 2;
  }
  return sorted[mid];
}

/**
 * Calculate population standard deviation
 */
function calculateStdDev(values: number[], mean: number): number {
  if (values.length === 0) return 0;
  const squaredDiffs = values.map(v => Math.pow(v - mean, 2));
  return Math.sqrt(squaredDiffs.reduce((sum, v) => sum + v, 0) / values.length);
}

/**
 * Find mode (most frequent value) from votes
 */
function findMode(votes: (string | number)[]): { mode: string | number | null; count: number } {
  if (votes.length === 0) return { mode: null, count: 0 };

  const counts = new Map<string | number, number>();
  for (const vote of votes) {
    counts.set(vote, (counts.get(vote) || 0) + 1);
  }

  let maxCount = 0;
  let mode: string | number | null = null;
  for (const [value, count] of counts) {
    if (count > maxCount) {
      maxCount = count;
      mode = value;
    }
  }

  return { mode, count: maxCount };
}

/**
 * Build distribution from votes
 */
function buildDistribution(votes: (string | number)[]): DistributionItem[] {
  if (votes.length === 0) return [];

  const counts = new Map<string | number, number>();
  for (const vote of votes) {
    counts.set(vote, (counts.get(vote) || 0) + 1);
  }

  const distribution: DistributionItem[] = [];
  for (const [value, count] of counts) {
    distribution.push({
      value,
      count,
      percentage: Math.round((count / votes.length) * 100),
    });
  }

  // Sort by count descending
  distribution.sort((a, b) => b.count - a.count);

  return distribution;
}

/**
 * Count excluded votes by type
 */
function countExcludedVotes(participants: Participant[]): ExcludedVote[] {
  const counts = new Map<string, number>();

  for (const p of participants) {
    if (p.vote !== null && EXCLUDED_VOTES.includes(String(p.vote))) {
      const key = String(p.vote);
      counts.set(key, (counts.get(key) || 0) + 1);
    }
  }

  const excluded: ExcludedVote[] = [];
  for (const [value, count] of counts) {
    excluded.push({ value, count });
  }

  return excluded;
}

/**
 * Find outliers (values more than 2 standard deviations from mean)
 */
function findOutliers(values: number[], mean: number, stdDev: number): number[] {
  if (stdDev === 0) return [];
  return values.filter(v => Math.abs(v - mean) > 2 * stdDev);
}

/**
 * Composable for calculating voting statistics
 */
export function useVotingStatistics(
  participants: Ref<Participant[]>,
  scaleType: Ref<string>,
): ComputedRef<VotingStatistics> {
  return computed(() => {
    const isNumericScale = !NON_NUMERIC_SCALES.includes(scaleType.value);

    // Filter out null and excluded votes
    const validVotes = participants.value
      .filter(p => !isExcludedVote(p.vote))
      .map(p => p.vote as string | number);

    const excludedVotes = countExcludedVotes(participants.value);
    const totalVotes = validVotes.length;

    // Handle empty case
    if (totalVotes === 0) {
      return {
        mean: null,
        median: null,
        standardDeviation: null,
        range: null,
        mode: null,
        modeCount: 0,
        consensusPercentage: 0,
        distribution: [],
        outliers: [],
        totalVotes: 0,
        excludedVotes,
        isNumericScale,
      };
    }

    // Calculate mode and distribution (works for all scales)
    const { mode, count: modeCount } = findMode(validVotes);
    const distribution = buildDistribution(validVotes);
    const consensusPercentage = Math.round((modeCount / totalVotes) * 100);

    // For non-numeric scales, skip numeric calculations
    if (!isNumericScale) {
      return {
        mean: null,
        median: null,
        standardDeviation: null,
        range: null,
        mode,
        modeCount,
        consensusPercentage,
        distribution,
        outliers: [],
        totalVotes,
        excludedVotes,
        isNumericScale,
      };
    }

    // Convert to numeric values
    const numericVotes = validVotes
      .map(v => toNumeric(v))
      .filter((v): v is number => v !== null);

    if (numericVotes.length === 0) {
      return {
        mean: null,
        median: null,
        standardDeviation: null,
        range: null,
        mode,
        modeCount,
        consensusPercentage,
        distribution,
        outliers: [],
        totalVotes,
        excludedVotes,
        isNumericScale,
      };
    }

    // Calculate numeric statistics
    const mean = calculateMean(numericVotes);
    const median = calculateMedian(numericVotes);
    const stdDev = calculateStdDev(numericVotes, mean);
    const sorted = [...numericVotes].sort((a, b) => a - b);
    const range = { min: sorted[0], max: sorted[sorted.length - 1] };
    const outliers = findOutliers(numericVotes, mean, stdDev);

    return {
      mean,
      median,
      standardDeviation: stdDev,
      range,
      mode,
      modeCount,
      consensusPercentage,
      distribution,
      outliers,
      totalVotes,
      excludedVotes,
      isNumericScale,
    };
  });
}
