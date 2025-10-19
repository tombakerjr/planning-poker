<script setup lang="ts">
// Inject the poker room state and actions
const pokerRoom = inject('pokerRoom') as any
const { roomState, revealVotes, resetRound, isJoined, votingComplete, isLoading, status } = pokerRoom
</script>

<template>
  <div class="w-full max-w-sm rounded-lg bg-gray-100 p-4 shadow-lg">
    <div class="flex items-center justify-between mb-4">
      <h2 class="text-xl font-bold text-gray-700">Participants</h2>
      <span class="text-sm text-gray-500">{{ roomState.participants.length }}</span>
    </div>

    <!-- Empty state -->
    <div v-if="roomState.participants.length === 0" class="text-center py-8">
      <p class="text-gray-500">No participants yet</p>
      <p class="text-sm text-gray-400 mt-1">Waiting for people to join...</p>
    </div>

    <!-- Participants list -->
    <ul v-else class="space-y-3">
      <li
        v-for="participant in roomState.participants"
        :key="participant.id"
        class="flex items-center justify-between rounded-lg bg-white p-3 shadow"
      >
        <span class="font-medium text-gray-800">{{ participant.name }}</span>
        <span class="w-8 text-center font-mono text-lg font-bold">
          <template v-if="!roomState.votesRevealed">
            <span v-if="participant.vote !== null" class="text-green-500">✔</span>
            <span v-else class="text-gray-400">...</span>
          </template>
          <template v-else>
            <span class="text-blue-600">{{ participant.vote ?? '-' }}</span>
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
        :class="isLoading ? 'bg-green-500' : 'bg-green-600 hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-green-500'"
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
        :class="isLoading ? 'bg-blue-500' : 'bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500'"
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
      <p v-if="status !== 'OPEN'" class="text-xs text-center text-gray-500 mt-2">
        Reconnecting to enable controls...
      </p>
    </div>

    <!-- Voting Progress -->
    <div v-if="roomState.participants.length > 0" class="mt-4">
      <div class="flex justify-between text-xs text-gray-500 mb-1">
        <span>Voting Progress</span>
        <span>{{ roomState.participants.filter((p: any) => p.vote !== null).length }}/{{ roomState.participants.length }}</span>
      </div>
      <div class="w-full bg-gray-200 rounded-full h-2">
        <div
          class="bg-blue-600 h-2 rounded-full transition-all duration-300"
          :style="{ 
            width: `${(roomState.participants.filter((p: any) => p.vote !== null).length / roomState.participants.length) * 100}%` 
          }"
        ></div>
      </div>
    </div>
  </div>
</template>
