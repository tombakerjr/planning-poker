<script setup lang="ts">
import { PokerRoomKey } from '~/composables/usePokerRoom';

// Inject the poker room state and actions with type safety
const pokerRoom = inject(PokerRoomKey);
if (!pokerRoom) throw new Error('PokerRoom not provided');

const {
  roomState,
  isJoined,
  status,
  timerRemaining,
  timerExpired,
  startTimer,
  cancelTimer,
  setTimerAutoReveal,
} = pokerRoom;

// Timer durations in seconds (must match server-side VALID_TIMER_DURATIONS)
const TIMER_PRESETS = [
  { label: '30s', value: 30 },
  { label: '1m', value: 60 },
  { label: '2m', value: 120 },
  { label: '5m', value: 300 },
] as const;

// Format remaining time as M:SS
function formatTime(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

// Computed: is timer active?
const isTimerActive = computed(() => timerRemaining.value !== null && timerRemaining.value > 0);

// Computed: should show warning state (<=10 seconds)
const isWarning = computed(() => timerRemaining.value !== null && timerRemaining.value <= 10 && timerRemaining.value > 0);

// Handle timer auto-reveal toggle
function handleTimerAutoRevealChange(event: Event) {
  const target = event.target as HTMLInputElement;
  setTimerAutoReveal(target.checked);
}
</script>

<template>
  <div
    v-if="isJoined && !roomState.votesRevealed"
    class="mt-4 border-t border-gray-200 dark:border-gray-600 pt-4"
  >
    <!-- Timer Expired Alert -->
    <Transition
      enter-active-class="transition ease-out duration-200"
      enter-from-class="opacity-0 scale-95"
      enter-to-class="opacity-100 scale-100"
      leave-active-class="transition ease-in duration-150"
      leave-from-class="opacity-100 scale-100"
      leave-to-class="opacity-0 scale-95"
    >
      <div
        v-if="timerExpired"
        class="mb-3 rounded-md bg-red-100 dark:bg-red-900/30 px-3 py-2 text-center animate-pulse"
      >
        <span class="text-sm font-semibold text-red-700 dark:text-red-300">
          Time's up!
        </span>
      </div>
    </Transition>

    <!-- Timer Display (when active) -->
    <div
      v-if="isTimerActive"
      class="flex items-center justify-between mb-3"
    >
      <div
        class="text-2xl font-mono font-bold transition-colors duration-200"
        :class="{
          'text-gray-900 dark:text-white': !isWarning,
          'text-orange-600 dark:text-orange-400': isWarning,
        }"
      >
        {{ formatTime(timerRemaining!) }}
      </div>
      <button
        :disabled="status !== 'OPEN'"
        class="rounded-md px-3 py-1.5 text-sm font-medium text-white transition-colors disabled:cursor-not-allowed disabled:opacity-50 bg-gray-500 dark:bg-gray-600 hover:bg-gray-600 dark:hover:bg-gray-700"
        @click="cancelTimer"
      >
        Cancel
      </button>
    </div>

    <!-- Timer Preset Buttons (when not active) -->
    <div
      v-else
      class="space-y-3"
    >
      <div class="flex items-center justify-between">
        <span class="text-xs text-gray-500 dark:text-gray-400 transition-colors duration-200">
          Timer
        </span>
      </div>
      <div class="flex gap-2">
        <button
          v-for="preset in TIMER_PRESETS"
          :key="preset.value"
          :disabled="status !== 'OPEN'"
          class="flex-1 rounded-md px-2 py-1.5 text-xs font-medium text-gray-700 dark:text-gray-200 transition-colors disabled:cursor-not-allowed disabled:opacity-50 bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600"
          @click="startTimer(preset.value)"
        >
          {{ preset.label }}
        </button>
      </div>
    </div>

    <!-- Timer Auto-Reveal Toggle -->
    <div class="mt-3 flex items-center gap-2">
      <input
        id="timer-auto-reveal"
        type="checkbox"
        :checked="roomState.timerAutoReveal"
        :disabled="status !== 'OPEN'"
        class="h-4 w-4 rounded border-gray-300 dark:border-gray-600 text-blue-600 focus:ring-blue-500 dark:focus:ring-blue-400 disabled:cursor-not-allowed disabled:opacity-50"
        @change="handleTimerAutoRevealChange"
      />
      <label
        for="timer-auto-reveal"
        class="text-xs text-gray-500 dark:text-gray-400 transition-colors duration-200"
      >
        Auto-reveal on timer
      </label>
    </div>
  </div>
</template>
