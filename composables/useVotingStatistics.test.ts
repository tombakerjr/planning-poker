import { describe, expect, it } from 'vitest';
import { ref } from 'vue';

import type { Participant } from './usePokerRoom';

import { useVotingStatistics } from './useVotingStatistics';

describe('useVotingStatistics', () => {
  // Helper to create participants with votes
  function createParticipants(votes: (string | number | null)[]): Participant[] {
    return votes.map((vote, i) => ({
      id: `user-${i}`,
      name: `User ${i}`,
      vote: vote,
    }));
  }

  describe('numeric scales (fibonacci)', () => {
    it('calculates mean correctly', () => {
      const participants = ref(createParticipants([1, 2, 3, 5, 8]));
      const scaleType = ref('fibonacci');

      const stats = useVotingStatistics(participants, scaleType);

      // Mean of [1, 2, 3, 5, 8] = 19 / 5 = 3.8
      expect(stats.value.mean).toBeCloseTo(3.8);
    });

    it('calculates median correctly for odd count', () => {
      const participants = ref(createParticipants([1, 2, 3, 5, 8]));
      const scaleType = ref('fibonacci');

      const stats = useVotingStatistics(participants, scaleType);

      // Median of [1, 2, 3, 5, 8] = 3 (middle value)
      expect(stats.value.median).toBe(3);
    });

    it('calculates median correctly for even count', () => {
      const participants = ref(createParticipants([1, 2, 5, 8]));
      const scaleType = ref('fibonacci');

      const stats = useVotingStatistics(participants, scaleType);

      // Median of [1, 2, 5, 8] = (2 + 5) / 2 = 3.5
      expect(stats.value.median).toBe(3.5);
    });

    it('calculates mode correctly', () => {
      const participants = ref(createParticipants([3, 3, 5, 8, 3]));
      const scaleType = ref('fibonacci');

      const stats = useVotingStatistics(participants, scaleType);

      expect(stats.value.mode).toBe(3);
      expect(stats.value.modeCount).toBe(3);
    });

    it('calculates standard deviation correctly', () => {
      const participants = ref(createParticipants([2, 4, 4, 4, 5, 5, 7, 9]));
      const scaleType = ref('fibonacci');

      const stats = useVotingStatistics(participants, scaleType);

      // Standard deviation of [2, 4, 4, 4, 5, 5, 7, 9] = 2.0
      expect(stats.value.standardDeviation).toBeCloseTo(2.0);
    });

    it('calculates range correctly', () => {
      const participants = ref(createParticipants([1, 3, 5, 13]));
      const scaleType = ref('fibonacci');

      const stats = useVotingStatistics(participants, scaleType);

      expect(stats.value.range).toEqual({ min: 1, max: 13 });
    });

    it('calculates consensus percentage correctly', () => {
      const participants = ref(createParticipants([3, 3, 3, 5]));
      const scaleType = ref('fibonacci');

      const stats = useVotingStatistics(participants, scaleType);

      // 3 out of 4 voted for mode (3) = 75%
      expect(stats.value.consensusPercentage).toBe(75);
    });

    it('builds distribution correctly', () => {
      const participants = ref(createParticipants([3, 3, 5, 8]));
      const scaleType = ref('fibonacci');

      const stats = useVotingStatistics(participants, scaleType);

      expect(stats.value.distribution).toEqual([
        { value: 3, count: 2, percentage: 50 },
        { value: 5, count: 1, percentage: 25 },
        { value: 8, count: 1, percentage: 25 },
      ]);
    });

    it('identifies outliers (>2 std dev from mean)', () => {
      // Mean of [3,3,3,3,3,3,3,21] = 5.25, stddev ~= 6
      // 21 is >2 std devs from mean
      const participants = ref(createParticipants([3, 3, 3, 3, 3, 3, 3, 21]));
      const scaleType = ref('fibonacci');

      const stats = useVotingStatistics(participants, scaleType);

      expect(stats.value.outliers).toContain(21);
    });
  });

  describe('special vote handling', () => {
    it('excludes ? votes from calculations', () => {
      const participants = ref(createParticipants([2, 3, 5, '?']));
      const scaleType = ref('fibonacci');

      const stats = useVotingStatistics(participants, scaleType);

      // Mean of [2, 3, 5] = 10 / 3 ≈ 3.33
      expect(stats.value.mean).toBeCloseTo(3.33, 1);
      expect(stats.value.totalVotes).toBe(3);
      expect(stats.value.excludedVotes).toContainEqual({ value: '?', count: 1 });
    });

    it('excludes coffee votes from calculations', () => {
      const participants = ref(createParticipants([2, 3, '☕', '☕']));
      const scaleType = ref('fibonacci');

      const stats = useVotingStatistics(participants, scaleType);

      expect(stats.value.mean).toBeCloseTo(2.5);
      expect(stats.value.totalVotes).toBe(2);
      expect(stats.value.excludedVotes).toContainEqual({ value: '☕', count: 2 });
    });

    it('converts ½ to 0.5 for calculations', () => {
      const participants = ref(createParticipants(['½', 1, 2]));
      const scaleType = ref('modified-fibonacci');

      const stats = useVotingStatistics(participants, scaleType);

      // Mean of [0.5, 1, 2] = 3.5 / 3 ≈ 1.17
      expect(stats.value.mean).toBeCloseTo(1.17, 1);
    });

    it('handles null votes (not yet voted)', () => {
      const participants = ref(createParticipants([3, 5, null, null]));
      const scaleType = ref('fibonacci');

      const stats = useVotingStatistics(participants, scaleType);

      // Only count actual votes
      expect(stats.value.totalVotes).toBe(2);
      expect(stats.value.mean).toBe(4);
    });
  });

  describe('non-numeric scales (t-shirt)', () => {
    it('returns null for mean/median/stddev', () => {
      const participants = ref(createParticipants(['S', 'M', 'M', 'L']));
      const scaleType = ref('t-shirt');

      const stats = useVotingStatistics(participants, scaleType);

      expect(stats.value.isNumericScale).toBe(false);
      expect(stats.value.mean).toBeNull();
      expect(stats.value.median).toBeNull();
      expect(stats.value.standardDeviation).toBeNull();
      expect(stats.value.range).toBeNull();
    });

    it('still calculates mode and consensus', () => {
      const participants = ref(createParticipants(['S', 'M', 'M', 'L']));
      const scaleType = ref('t-shirt');

      const stats = useVotingStatistics(participants, scaleType);

      expect(stats.value.mode).toBe('M');
      expect(stats.value.modeCount).toBe(2);
      expect(stats.value.consensusPercentage).toBe(50);
    });

    it('builds distribution for t-shirt sizes', () => {
      const participants = ref(createParticipants(['S', 'M', 'M', 'L']));
      const scaleType = ref('t-shirt');

      const stats = useVotingStatistics(participants, scaleType);

      expect(stats.value.distribution).toEqual([
        { value: 'M', count: 2, percentage: 50 },
        { value: 'S', count: 1, percentage: 25 },
        { value: 'L', count: 1, percentage: 25 },
      ]);
    });
  });

  describe('edge cases', () => {
    it('handles single vote', () => {
      const participants = ref(createParticipants([5]));
      const scaleType = ref('fibonacci');

      const stats = useVotingStatistics(participants, scaleType);

      expect(stats.value.mean).toBe(5);
      expect(stats.value.median).toBe(5);
      expect(stats.value.mode).toBe(5);
      expect(stats.value.consensusPercentage).toBe(100);
      expect(stats.value.standardDeviation).toBe(0);
    });

    it('handles all same votes (perfect consensus)', () => {
      const participants = ref(createParticipants([3, 3, 3, 3]));
      const scaleType = ref('fibonacci');

      const stats = useVotingStatistics(participants, scaleType);

      expect(stats.value.consensusPercentage).toBe(100);
      expect(stats.value.standardDeviation).toBe(0);
    });

    it('handles empty participants', () => {
      const participants = ref<Participant[]>([]);
      const scaleType = ref('fibonacci');

      const stats = useVotingStatistics(participants, scaleType);

      expect(stats.value.totalVotes).toBe(0);
      expect(stats.value.mean).toBeNull();
      expect(stats.value.mode).toBeNull();
    });

    it('handles all null votes', () => {
      const participants = ref(createParticipants([null, null, null]));
      const scaleType = ref('fibonacci');

      const stats = useVotingStatistics(participants, scaleType);

      expect(stats.value.totalVotes).toBe(0);
      expect(stats.value.mean).toBeNull();
    });

    it('is reactive to participant changes', () => {
      const participants = ref(createParticipants([3, 3, 5]));
      const scaleType = ref('fibonacci');

      const stats = useVotingStatistics(participants, scaleType);

      expect(stats.value.mode).toBe(3);

      // Update participants
      participants.value = createParticipants([5, 5, 5, 3]);

      expect(stats.value.mode).toBe(5);
    });
  });
});
