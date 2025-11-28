<script setup lang="ts">
import type { Participant } from '~/composables/usePokerRoom';

import { useVotingStatistics } from '~/composables/useVotingStatistics';

const props = defineProps<{
  participants: Participant[];
  scaleType: string;
}>();

// Create refs for the composable
const participantsRef = computed(() => props.participants);
const scaleTypeRef = computed(() => props.scaleType);

// Get statistics
const stats = useVotingStatistics(participantsRef, scaleTypeRef);

// Consensus bar color class
const consensusColorClass = computed(() => {
  const pct = stats.value.consensusPercentage;
  if (pct >= 75) return 'bg-green-500';
  if (pct >= 50) return 'bg-yellow-500';
  return 'bg-red-500';
});

// Consensus message
const consensusMessage = computed(() => {
  const pct = stats.value.consensusPercentage;
  if (pct >= 75) return 'Strong consensus!';
  if (pct >= 50) return 'Moderate agreement';
  return 'Low consensus - discuss?';
});

// Format number for display (handle decimals nicely)
function formatNumber(value: number | null): string {
  if (value === null) return '-';
  if (Number.isInteger(value)) return value.toString();
  return value.toFixed(1);
}

// Check if a vote value is an outlier
function isOutlier(value: string | number): boolean {
  if (typeof value === 'string') return false;
  return stats.value.outliers.includes(value);
}

// Get bar width percentage for distribution
function getBarWidth(percentage: number): string {
  // Minimum 5% width for visibility
  return `${Math.max(percentage, 5)}%`;
}
</script>

<template>
  <div class="space-y-6">
    <!-- Empty state -->
    <div
      v-if="stats.totalVotes === 0"
      class="text-center py-8"
    >
      <p class="text-gray-500 dark:text-gray-400 transition-colors duration-200">
        No votes to analyze
      </p>
    </div>

    <template v-else>
      <!-- Statistics Summary -->
      <div class="grid grid-cols-2 sm:grid-cols-3 gap-3">
        <!-- Mode (Most Common) -->
        <div class="rounded-lg bg-indigo-50 dark:bg-indigo-900/30 p-3 transition-colors duration-200">
          <p class="text-xs font-medium text-gray-600 dark:text-gray-300 uppercase tracking-wide">
            Mode
          </p>
          <p class="text-2xl font-bold text-indigo-600 dark:text-indigo-400 transition-colors duration-200">
            {{ stats.mode ?? '-' }}
          </p>
          <p class="text-xs text-gray-500 dark:text-gray-400">
            {{ stats.modeCount }} vote{{ stats.modeCount !== 1 ? 's' : '' }}
          </p>
        </div>

        <!-- Mean (only for numeric scales) -->
        <div
          v-if="stats.isNumericScale"
          class="rounded-lg bg-blue-50 dark:bg-blue-900/30 p-3 transition-colors duration-200"
        >
          <p class="text-xs font-medium text-gray-600 dark:text-gray-300 uppercase tracking-wide">
            Average
          </p>
          <p class="text-2xl font-bold text-blue-600 dark:text-blue-400 transition-colors duration-200">
            {{ formatNumber(stats.mean) }}
          </p>
        </div>

        <!-- Median (only for numeric scales) -->
        <div
          v-if="stats.isNumericScale"
          class="rounded-lg bg-green-50 dark:bg-green-900/30 p-3 transition-colors duration-200"
        >
          <p class="text-xs font-medium text-gray-600 dark:text-gray-300 uppercase tracking-wide">
            Median
          </p>
          <p class="text-2xl font-bold text-green-600 dark:text-green-400 transition-colors duration-200">
            {{ formatNumber(stats.median) }}
          </p>
        </div>

        <!-- Consensus -->
        <div class="rounded-lg bg-purple-50 dark:bg-purple-900/30 p-3 transition-colors duration-200">
          <p class="text-xs font-medium text-gray-600 dark:text-gray-300 uppercase tracking-wide">
            Consensus
          </p>
          <p class="text-2xl font-bold text-purple-600 dark:text-purple-400 transition-colors duration-200">
            {{ stats.consensusPercentage }}%
          </p>
        </div>

        <!-- Standard Deviation (only for numeric scales) -->
        <div
          v-if="stats.isNumericScale"
          class="rounded-lg bg-orange-50 dark:bg-orange-900/30 p-3 transition-colors duration-200"
        >
          <p class="text-xs font-medium text-gray-600 dark:text-gray-300 uppercase tracking-wide">
            Std Dev
          </p>
          <p class="text-2xl font-bold text-orange-600 dark:text-orange-400 transition-colors duration-200">
            {{ formatNumber(stats.standardDeviation) }}
          </p>
        </div>

        <!-- Range (only for numeric scales) -->
        <div
          v-if="stats.isNumericScale && stats.range"
          class="rounded-lg bg-teal-50 dark:bg-teal-900/30 p-3 transition-colors duration-200"
        >
          <p class="text-xs font-medium text-gray-600 dark:text-gray-300 uppercase tracking-wide">
            Range
          </p>
          <p class="text-2xl font-bold text-teal-600 dark:text-teal-400 transition-colors duration-200">
            {{ stats.range.min }} - {{ stats.range.max }}
          </p>
        </div>
      </div>

      <!-- Consensus Bar -->
      <div>
        <div class="flex justify-between text-xs text-gray-500 dark:text-gray-400 mb-1">
          <span>Consensus Level</span>
          <span>{{ consensusMessage }}</span>
        </div>
        <div class="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-3 transition-colors duration-200">
          <div
            class="h-3 rounded-full transition-all duration-500"
            :class="consensusColorClass"
            :style="{ width: `${stats.consensusPercentage}%` }"
          ></div>
        </div>
      </div>

      <!-- Distribution Chart (Horizontal Bars) -->
      <div>
        <h3 class="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3 transition-colors duration-200">
          Vote Distribution
        </h3>
        <div class="space-y-2">
          <div
            v-for="item in stats.distribution"
            :key="String(item.value)"
            class="flex items-center gap-3"
          >
            <!-- Vote Value Label -->
            <div
              class="w-12 text-right font-mono font-bold text-sm"
              :class="[
                isOutlier(item.value)
                  ? 'text-red-600 dark:text-red-400'
                  : 'text-gray-700 dark:text-gray-300'
              ]"
            >
              {{ item.value }}
              <span
                v-if="isOutlier(item.value)"
                class="text-xs"
                title="Outlier (>2 std dev from mean)"
              >*</span>
            </div>

            <!-- Bar -->
            <div class="flex-1 bg-gray-200 dark:bg-gray-700 rounded-full h-6 transition-colors duration-200">
              <div
                class="h-6 rounded-full flex items-center justify-end pr-2 transition-all duration-300"
                :class="[
                  isOutlier(item.value)
                    ? 'bg-red-400 dark:bg-red-600'
                    : 'bg-blue-500 dark:bg-blue-600'
                ]"
                :style="{ width: getBarWidth(item.percentage) }"
              >
                <span class="text-xs text-white font-medium">
                  {{ item.count }}
                </span>
              </div>
            </div>

            <!-- Percentage -->
            <div class="w-12 text-left text-sm text-gray-500 dark:text-gray-400">
              {{ item.percentage }}%
            </div>
          </div>
        </div>
      </div>

      <!-- Outliers Note -->
      <div
        v-if="stats.outliers.length > 0"
        class="flex items-start gap-2 text-sm text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20 rounded-lg p-3 transition-colors duration-200"
      >
        <svg
          class="w-5 h-5 flex-shrink-0 mt-0.5"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            stroke-linecap="round"
            stroke-linejoin="round"
            stroke-width="2"
            d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
          />
        </svg>
        <div>
          <p class="font-medium">
            Outliers detected
          </p>
          <p class="text-xs text-red-500 dark:text-red-300">
            Vote{{ stats.outliers.length !== 1 ? 's' : '' }} marked with * are &gt;2 standard deviations from the mean
          </p>
        </div>
      </div>

      <!-- Excluded Votes Note -->
      <div
        v-if="stats.excludedVotes.length > 0"
        class="flex items-start gap-2 text-sm text-gray-600 dark:text-gray-400 bg-gray-100 dark:bg-gray-700/50 rounded-lg p-3 transition-colors duration-200"
      >
        <svg
          class="w-5 h-5 flex-shrink-0 mt-0.5"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            stroke-linecap="round"
            stroke-linejoin="round"
            stroke-width="2"
            d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
          />
        </svg>
        <div>
          <p class="font-medium">
            Excluded from statistics
          </p>
          <p class="text-xs">
            <span
              v-for="(excluded, index) in stats.excludedVotes"
              :key="excluded.value"
            >
              {{ excluded.count }} voted "{{ excluded.value }}"<span v-if="index < stats.excludedVotes.length - 1">, </span>
            </span>
          </p>
        </div>
      </div>

      <!-- Total Votes -->
      <div class="text-center text-sm text-gray-500 dark:text-gray-400 transition-colors duration-200">
        Based on {{ stats.totalVotes }} vote{{ stats.totalVotes !== 1 ? 's' : '' }}
      </div>
    </template>
  </div>
</template>
