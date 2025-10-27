<script setup lang="ts">
import { PokerRoomKey } from '~/composables/usePokerRoom'

// Inject the poker room state and actions with type safety
const pokerRoom = inject(PokerRoomKey)
if (!pokerRoom) throw new Error('PokerRoom not provided')

const { roomState, revealVotes, resetRound, isJoined, votingComplete, isLoading, status } = pokerRoom

// Generate a consistent color for each participant based on their ID
const colorPalette = [
  'bg-blue-500',
  'bg-green-500',
  'bg-purple-500',
  'bg-pink-500',
  'bg-yellow-500',
  'bg-red-500',
  'bg-indigo-500',
  'bg-teal-500',
  'bg-orange-500',
  'bg-cyan-500',
]

function getParticipantColor(userId: string): string {
  // Generate a hash from the userId
  let hash = 0
  for (let i = 0; i < userId.length; i++) {
    hash = userId.charCodeAt(i) + ((hash << 5) - hash)
  }
  // Use the hash to pick a color from the palette
  const index = Math.abs(hash) % colorPalette.length
  return colorPalette[index]
}
</script>

<template>
  <div class="w-full max-w-sm rounded-lg bg-gray-100 dark:bg-gray-800 p-4 shadow-lg transition-colors duration-200">
    <div class="flex items-center justify-between mb-4">
      <h2 class="text-xl font-bold text-gray-700 dark:text-white transition-colors duration-200">Participants</h2>
      <span class="text-sm text-gray-500 dark:text-gray-400 transition-colors duration-200">{{ roomState.participants.length }}</span>
    </div>

    <!-- Empty state -->
    <div v-if="roomState.participants.length === 0" class="text-center py-8">
      <p class="text-gray-500 dark:text-gray-400 transition-colors duration-200">No participants yet</p>
      <p class="text-sm text-gray-400 dark:text-gray-500 mt-1 transition-colors duration-200">Waiting for people to join...</p>
    </div>

    <!-- Participants list -->
    <ul v-else class="space-y-3">
      <li
        v-for="participant in roomState.participants"
        :key="participant.id"
        class="flex items-center justify-between rounded-lg bg-white dark:bg-gray-700 p-3 shadow transition-colors duration-200"
      >
        <div class="flex items-center gap-3">
          <!-- Color indicator -->
          <div
            class="h-8 w-8 rounded-full flex items-center justify-center text-white font-bold text-sm"
            :class="getParticipantColor(participant.id)"
          >
            {{ participant.name.charAt(0).toUpperCase() }}
          </div>
          <span class="font-medium text-gray-800 dark:text-white transition-colors duration-200">{{ participant.name }}</span>
        </div>
        <span class="w-8 text-center text-lg" :title="participant.vote !== null ? 'Voted' : 'Not voted'">
          <template v-if="!roomState.votesRevealed">
            <span v-if="participant.vote !== null" class="text-green-500 dark:text-green-400">✓</span>
            <span v-else class="text-gray-400 dark:text-gray-500">⏳</span>
          </template>
          <template v-else>
            <span class="text-blue-600 dark:text-blue-400 font-mono font-bold transition-colors duration-200">{{ participant.vote ?? '-' }}</span>
          </template>
        </span>
      </li>
    </ul>

    <!-- Room Controls -->
    <div v-if="isJoined && roomState.participants.length > 0" class="mt-6 space-y-2">
      <button
        v-if="!roomState.votesRevealed && votingComplete"
        @click="revealVotes"
        :disabled="isLoading || status !== 'OPEN'"
        class="w-full rounded-md px-4 py-2 text-sm font-medium text-white transition-all disabled:cursor-not-allowed disabled:opacity-50"
        :class="isLoading ? 'bg-green-500 dark:bg-green-400' : 'bg-green-600 dark:bg-green-500 hover:bg-green-700 dark:hover:bg-green-600 focus:outline-none focus:ring-2 focus:ring-green-500 dark:focus:ring-green-400'"
      >
        <span v-if="isLoading" class="flex items-center justify-center">
          <svg class="animate-spin -ml-1 mr-2 h-4 w-4 text-white" fill="none" viewBox="0 0 24 24">
            <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
            <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
          </svg>
          Revealing...
        </span>
        <span v-else>Reveal Votes</span>
      </button>

      <button
        v-if="roomState.votesRevealed"
        @click="resetRound"
        :disabled="isLoading || status !== 'OPEN'"
        class="w-full rounded-md px-4 py-2 text-sm font-medium text-white transition-all disabled:cursor-not-allowed disabled:opacity-50"
        :class="isLoading ? 'bg-blue-500 dark:bg-blue-400' : 'bg-blue-600 dark:bg-blue-500 hover:bg-blue-700 dark:hover:bg-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400'"
      >
        <span v-if="isLoading" class="flex items-center justify-center">
          <svg class="animate-spin -ml-1 mr-2 h-4 w-4 text-white" fill="none" viewBox="0 0 24 24">
            <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
            <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
          </svg>
          Starting...
        </span>
        <span v-else>New Round</span>
      </button>

      <!-- Disconnected hint -->
      <p v-if="status !== 'OPEN'" class="text-xs text-center text-gray-500 dark:text-gray-400 mt-2 transition-colors duration-200">
        Reconnecting to enable controls...
      </p>
    </div>

    <!-- Voting Progress -->
    <div v-if="roomState.participants.length > 0" class="mt-4">
      <div class="flex justify-between text-xs text-gray-500 dark:text-gray-400 mb-1 transition-colors duration-200">
        <span>Voting Progress</span>
        <span>{{ roomState.participants.filter(p => p.vote !== null).length }}/{{ roomState.participants.length }}</span>
      </div>
      <div class="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2 transition-colors duration-200">
        <div
          class="bg-blue-600 dark:bg-blue-400 h-2 rounded-full transition-all duration-300"
          :style="{
            width: `${(roomState.participants.filter(p => p.vote !== null).length / roomState.participants.length) * 100}%`
          }"
        ></div>
      </div>
    </div>
  </div>
</template>
