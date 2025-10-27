<script setup lang="ts">
import { logger } from '~/server/utils/logger'
import { PokerRoomKey } from '~/composables/usePokerRoom'
import { useVotingScale } from '~/composables/useVotingScale'

// Inject the poker room state and actions with type safety
const pokerRoom = inject(PokerRoomKey)
if (!pokerRoom) throw new Error('PokerRoom not provided')

const { roomState, isJoined, vote, myVote, votingComplete, averageVote, medianVote, consensusPercentage, setStoryTitle } = pokerRoom

// Use voting scale composable with the room's current scale
const { currentScale } = useVotingScale(computed(() => roomState.value.votingScale))
const pokerDeck = computed(() => currentScale.value.values)

// Check if current scale supports numeric statistics
const supportsNumericStats = computed(() => {
  // Only show stats for scales with numeric values
  return ['fibonacci', 'modified-fibonacci', 'powers-of-2', 'linear'].includes(currentScale.value.id)
})

const selectedValue = ref<string | number | null>(null)
const isEditingStory = ref(false)
const storyInput = ref('')
const voteChanged = ref(false)
const hasVotedBefore = ref(false)
const voteChangeTimeout = ref<ReturnType<typeof setTimeout> | null>(null)

// Watch for changes in our vote from the server (sync selected value with server state)
watch(myVote, (newVote) => {
  if (newVote) {
    selectedValue.value = newVote
  }
})

function handleSelect(value: string | number) {
  if (!isJoined.value) {
    logger.warn('Must join room before voting')
    return
  }

  const newValue = selectedValue.value === value ? null : value
  const isChangingVote = hasVotedBefore.value && selectedValue.value !== null

  selectedValue.value = newValue

  // Track if this is a vote change (not the first vote or revote after unvote)
  // Show indicator when: changing from one vote to another, OR revoting after clearing
  if (newValue !== null && hasVotedBefore.value) {
    voteChanged.value = true

    // Clear existing timeout
    if (voteChangeTimeout.value) {
      clearTimeout(voteChangeTimeout.value)
    }

    // Hide the indicator after 3 seconds
    voteChangeTimeout.value = setTimeout(() => {
      voteChanged.value = false
    }, 3000)
  }

  if (newValue !== null) {
    hasVotedBefore.value = true
  }

  // Send vote to server
  vote(newValue)
}

// Clean up timeout on unmount
onBeforeUnmount(() => {
  if (voteChangeTimeout.value) {
    clearTimeout(voteChangeTimeout.value)
  }
})

function startEditingStory() {
  if (!isJoined.value) return
  storyInput.value = roomState.value.storyTitle
  isEditingStory.value = true
}

function cancelEditStory() {
  isEditingStory.value = false
  storyInput.value = ''
}

function saveStoryTitle() {
  if (storyInput.value.trim()) {
    setStoryTitle(storyInput.value)
  }
  isEditingStory.value = false
  storyInput.value = ''
}

function handleStoryKeydown(event: KeyboardEvent) {
  if (event.key === 'Enter') {
    event.preventDefault()
    saveStoryTitle()
  } else if (event.key === 'Escape') {
    cancelEditStory()
  }
}
</script>

<template>
  <div class="w-full max-w-2xl rounded-lg bg-gray-50 dark:bg-gray-800 p-6 shadow-md transition-colors duration-200">
    <div class="text-center">
      <h2 class="text-lg font-semibold text-gray-600 dark:text-gray-300 transition-colors duration-200">Story for Estimation:</h2>

      <!-- Story Title Display/Edit -->
      <div class="mb-6">
        <div v-if="!isEditingStory" class="group flex items-center justify-center gap-2">
          <p class="text-xl font-bold text-gray-800 dark:text-white transition-colors duration-200">
            {{ roomState.storyTitle || 'No story set yet' }}
          </p>
          <button
            v-if="isJoined"
            @click="startEditingStory"
            class="opacity-0 group-hover:opacity-100 transition-opacity rounded p-1 hover:bg-gray-200 dark:hover:bg-gray-700"
            title="Edit story"
          >
            <svg class="h-4 w-4 text-gray-600 dark:text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
            </svg>
          </button>
        </div>

        <!-- Edit Mode -->
        <div v-else class="flex items-center justify-center gap-2">
          <input
            v-model="storyInput"
            type="text"
            placeholder="Enter story title..."
            @keydown="handleStoryKeydown"
            class="flex-1 max-w-md rounded-md border border-gray-300 dark:border-gray-600 px-3 py-2 text-center text-xl font-bold text-gray-900 dark:text-white bg-white dark:bg-gray-700 focus:border-blue-500 dark:focus:border-blue-400 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:focus:ring-blue-400 transition-colors duration-200"
            autofocus
          />
          <button
            @click="saveStoryTitle"
            class="rounded-md bg-green-600 dark:bg-green-500 p-2 text-white hover:bg-green-700 dark:hover:bg-green-600 transition-colors duration-200"
            title="Save"
          >
            <svg class="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7" />
            </svg>
          </button>
          <button
            @click="cancelEditStory"
            class="rounded-md bg-gray-400 dark:bg-gray-600 p-2 text-white hover:bg-gray-500 dark:hover:bg-gray-700 transition-colors duration-200"
            title="Cancel"
          >
            <svg class="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      </div>
    </div>

    <!-- Voting disabled message -->
    <div v-if="!isJoined" class="mb-4 text-center">
      <p class="text-sm text-gray-500 dark:text-gray-400 transition-colors duration-200">Join the room to start voting</p>
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
      <p class="text-gray-600 dark:text-gray-300 transition-colors duration-200">Your vote:</p>
      <p class="min-h-[48px] text-4xl font-bold text-blue-600 dark:text-blue-400 transition-colors duration-200">
        {{ selectedValue ?? '...' }}
      </p>
      <!-- Vote changed indicator -->
      <Transition
        enter-active-class="transition ease-out duration-200"
        enter-from-class="opacity-0 scale-95"
        enter-to-class="opacity-100 scale-100"
        leave-active-class="transition ease-in duration-150"
        leave-from-class="opacity-100 scale-100"
        leave-to-class="opacity-0 scale-95"
      >
        <p v-if="voteChanged" class="mt-2 inline-block rounded-full bg-yellow-100 dark:bg-yellow-900/30 px-3 py-1 text-sm font-medium text-yellow-800 dark:text-yellow-300 transition-colors duration-200">
          🔄 Vote changed
        </p>
      </Transition>
    </div>

    <!-- Voting status -->
    <div v-if="isJoined" class="mt-4 text-center">
      <div v-if="roomState.votesRevealed && supportsNumericStats && (averageVote !== null || medianVote !== null)" class="space-y-2">
        <!-- Statistics Grid -->
        <div class="grid grid-cols-3 gap-3 text-sm">
          <div v-if="averageVote !== null" class="rounded-lg bg-blue-50 dark:bg-blue-900/30 p-3 transition-colors duration-200">
            <p class="text-xs text-gray-600 dark:text-gray-300 transition-colors duration-200">Average</p>
            <p class="text-lg font-bold text-blue-600 dark:text-blue-400 transition-colors duration-200">{{ averageVote }}</p>
          </div>
          <div v-if="medianVote !== null" class="rounded-lg bg-green-50 dark:bg-green-900/30 p-3 transition-colors duration-200">
            <p class="text-xs text-gray-600 dark:text-gray-300 transition-colors duration-200">Median</p>
            <p class="text-lg font-bold text-green-600 dark:text-green-400 transition-colors duration-200">{{ medianVote }}</p>
          </div>
          <div v-if="consensusPercentage !== null" class="rounded-lg bg-purple-50 dark:bg-purple-900/30 p-3 transition-colors duration-200">
            <p class="text-xs text-gray-600 dark:text-gray-300 transition-colors duration-200">Consensus</p>
            <p class="text-lg font-bold text-purple-600 dark:text-purple-400 transition-colors duration-200">{{ consensusPercentage }}%</p>
          </div>
        </div>
        <!-- Consensus indicator -->
        <div v-if="consensusPercentage !== null" class="mt-2">
          <div class="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2 transition-colors duration-200">
            <div
              class="h-2 rounded-full transition-all duration-300"
              :class="{
                'bg-red-500': consensusPercentage < 50,
                'bg-yellow-500': consensusPercentage >= 50 && consensusPercentage < 75,
                'bg-green-500': consensusPercentage >= 75
              }"
              :style="{ width: `${consensusPercentage}%` }"
            ></div>
          </div>
          <p class="text-xs text-gray-500 dark:text-gray-400 mt-1 transition-colors duration-200">
            {{
              consensusPercentage >= 75 ? 'Strong consensus!' :
              consensusPercentage >= 50 ? 'Moderate agreement' :
              'Low consensus - discuss?'
            }}
          </p>
        </div>
      </div>
      <div v-else-if="votingComplete" class="text-sm text-green-600 dark:text-green-400 transition-colors duration-200">
        <p>All votes are in! Ready to reveal.</p>
      </div>
    </div>
  </div>
</template>
