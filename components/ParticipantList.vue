<script setup lang="ts">
import { ref } from 'vue'

interface Participant {
  id: number
  name: string
  vote: string | number | null
}

const participants = ref<Participant[]>([
  { id: 1, name: 'Alice', vote: 5 },
  { id: 2, name: 'Bob', vote: null },
  { id: 3, name: 'Charlie', vote: 8 },
  { id: 4, name: 'Diana', vote: '☕' },
])

const votesRevealed = ref(false)
</script>

<template>
  <div class="w-full max-w-sm rounded-lg bg-gray-100 p-4 shadow-lg">
    <h2 class="mb-4 text-xl font-bold text-gray-700">Participants</h2>
    <ul class="space-y-3">
      <li
        v-for="participant in participants"
        :key="participant.id"
        class="flex items-center justify-between rounded-lg bg-white p-3 shadow"
      >
        <span class="font-medium text-gray-800">{{ participant.name }}</span>
        <span class="w-8 text-center font-mono text-lg font-bold">
          <template v-if="!votesRevealed">
            <span v-if="participant.vote !== null" class="text-green-500">✔</span>
            <span v-else class="text-gray-400">...</span>
          </template>
          <template v-else>
            <span class="text-blue-600">{{ participant.vote ?? '-' }}</span>
          </template>
        </span>
      </li>
    </ul>
  </div>
</template>
