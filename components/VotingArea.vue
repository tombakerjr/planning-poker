<script setup lang="ts">
const pokerDeck = ['1', '2', '3', '5', '8', '13', '21', '?', '☕️']

// Inject the poker room state and actions
const pokerRoom = inject('pokerRoom') as any
const { roomState, isJoined, vote, myVote, votingComplete, averageVote } = pokerRoom

const selectedValue = ref<string | number | null>(null)

// Watch for changes in our vote from the server
watchEffect(() => {
  if (myVote.value) {
    selectedValue.value = myVote.value
  }
})

function handleSelect(value: string | number) {
  if (!isJoined.value) {
    console.warn('Must join room before voting')
    return
  }

  const newValue = selectedValue.value === value ? null : value
  selectedValue.value = newValue
  
  // Send vote to server
  vote(newValue)
}
</script>

<template>
  <div class="w-full max-w-2xl rounded-lg bg-gray-50 p-6 shadow-md">
    <div class="text-center">
      <h2 class="text-lg font-semibold text-gray-600">Story for Estimation:</h2>
      <p class="mb-6 text-xl font-bold text-gray-800">
        {{ roomState.storyTitle || 'No story set yet' }}
      </p>
    </div>

    <!-- Voting disabled message -->
    <div v-if="!isJoined" class="mb-4 text-center">
      <p class="text-sm text-gray-500">Join the room to start voting</p>
    </div>

    <div 
      class="grid grid-cols-3 justify-items-center gap-4 sm:grid-cols-5"
      :class="{ 'opacity-50 pointer-events-none': !isJoined }"
    >
      <Card
        v-for="cardValue in pokerDeck"
        :key="cardValue"
        :value="cardValue"
        :selected="selectedValue === cardValue"
        @select="handleSelect(cardValue)"
      />
    </div>

    <div class="mt-8 text-center">
      <p class="text-gray-600">Your vote:</p>
      <p class="min-h-[48px] text-4xl font-bold text-blue-600">
        {{ selectedValue ?? '...' }}
      </p>
    </div>

    <!-- Voting status -->
    <div v-if="isJoined" class="mt-4 text-center">
      <div v-if="roomState.votesRevealed && averageVote !== null" class="text-sm text-gray-600">
        <p>Average: <span class="font-bold text-green-600">{{ averageVote }}</span></p>
      </div>
      <div v-else-if="votingComplete" class="text-sm text-green-600">
        <p>All votes are in! Ready to reveal.</p>
      </div>
    </div>
  </div>
</template>
