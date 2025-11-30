<script setup lang="ts">
import { PokerRoomKey } from '~/composables/usePokerRoom';
import { useVotingScale } from '~/composables/useVotingScale';

// Inject the poker room state and actions with type safety
const pokerRoom = inject(PokerRoomKey);
if (!pokerRoom) throw new Error('PokerRoom not provided');

const { roomState, isJoined, vote, myVote, votingComplete, setStoryTitle } = pokerRoom;

// Use voting scale composable with the room's current scale
const { currentScale } = useVotingScale(computed(() => roomState.value.votingScale));
const pokerDeck = computed(() => currentScale.value.values);

const selectedValue = ref<string | number | null>(null);
const isEditingStory = ref(false);
const storyInput = ref('');
const voteChanged = ref(false);
const hasVotedBefore = ref(false);
const voteChangeTimeout = ref<ReturnType<typeof setTimeout> | null>(null);

// Watch for changes in our vote from the server (sync selected value with server state)
// Always sync, even when null (handles vote clearing)
watch(myVote, (newVote) => {
  selectedValue.value = newVote;

  // Clear any pending vote change indicator when server sends update
  if (voteChangeTimeout.value) {
    clearTimeout(voteChangeTimeout.value);
    voteChangeTimeout.value = null;
    voteChanged.value = false;
  }
});

// Reset vote change tracking when round resets
watch(() => roomState.value.votesRevealed, (newRevealed, oldRevealed) => {
  // When transitioning from revealed to not revealed (round reset)
  if (oldRevealed && !newRevealed) {
    hasVotedBefore.value = false;
    voteChanged.value = false;
    if (voteChangeTimeout.value) {
      clearTimeout(voteChangeTimeout.value);
      voteChangeTimeout.value = null;
    }
  }
});

function handleSelect(value: string | number) {
  if (!isJoined.value) {
    console.warn('[VotingArea] Must join room before voting');
    return;
  }

  const newValue = selectedValue.value === value ? null : value;

  selectedValue.value = newValue;

  // Handle unvote: clear vote change indicator but keep tracking state
  // hasVotedBefore is only reset on round reset (see watch on votesRevealed)
  if (newValue === null) {
    // Clear vote change indicator if showing
    voteChanged.value = false;
    if (voteChangeTimeout.value) {
      clearTimeout(voteChangeTimeout.value);
      voteChangeTimeout.value = null;
    }
  } else if (hasVotedBefore.value) {
    // Track vote changes (not the first vote)
    voteChanged.value = true;

    // Clear existing timeout
    if (voteChangeTimeout.value) {
      clearTimeout(voteChangeTimeout.value);
    }

    // Hide the indicator after 3 seconds
    voteChangeTimeout.value = setTimeout(() => {
      voteChanged.value = false;
    }, 3000);
  }

  // Set flag after first vote
  if (newValue !== null) {
    hasVotedBefore.value = true;
  }

  // Send vote to server
  vote(newValue);
}

// Clean up timeout and state on unmount
onBeforeUnmount(() => {
  if (voteChangeTimeout.value) {
    clearTimeout(voteChangeTimeout.value);
    voteChangeTimeout.value = null;
  }
  // Clear state to prevent stale data if component remounts
  voteChanged.value = false;
  hasVotedBefore.value = false;
});

function startEditingStory() {
  if (!isJoined.value) return;
  storyInput.value = roomState.value.storyTitle;
  isEditingStory.value = true;
}

function cancelEditStory() {
  isEditingStory.value = false;
  storyInput.value = '';
}

function saveStoryTitle() {
  if (storyInput.value.trim()) {
    setStoryTitle(storyInput.value);
  }
  isEditingStory.value = false;
  storyInput.value = '';
}

function handleStoryKeydown(event: KeyboardEvent) {
  if (event.key === 'Enter') {
    event.preventDefault();
    saveStoryTitle();
  } else if (event.key === 'Escape') {
    cancelEditStory();
  }
}
</script>

<template>
  <div class="w-full max-w-2xl rounded-lg bg-gray-50 dark:bg-gray-800 p-6 shadow-md transition-colors duration-200">
    <div class="text-center">
      <h2 class="text-lg font-semibold text-gray-600 dark:text-gray-300 transition-colors duration-200">
        Story for Estimation:
      </h2>

      <!-- Story Title Display/Edit -->
      <div class="mb-6">
        <div
          v-if="!isEditingStory"
          class="group flex items-center justify-center gap-2"
        >
          <p class="text-xl font-bold text-gray-800 dark:text-white transition-colors duration-200">
            {{ roomState.storyTitle || 'No story set yet' }}
          </p>
          <button
            v-if="isJoined"
            class="opacity-0 group-hover:opacity-100 transition-opacity rounded p-1 hover:bg-gray-200 dark:hover:bg-gray-700"
            title="Edit story"
            @click="startEditingStory"
          >
            <svg
              class="h-4 w-4 text-gray-600 dark:text-gray-300"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                stroke-width="2"
                d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z"
              />
            </svg>
          </button>
        </div>

        <!-- Edit Mode -->
        <div
          v-else
          class="flex items-center justify-center gap-2"
        >
          <input
            v-model="storyInput"
            type="text"
            placeholder="Enter story title..."
            class="flex-1 max-w-md rounded-md border border-gray-300 dark:border-gray-600 px-3 py-2 text-center text-xl font-bold text-gray-900 dark:text-white bg-white dark:bg-gray-700 focus:border-blue-500 dark:focus:border-blue-400 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:focus:ring-blue-400 transition-colors duration-200"
            autofocus
            @keydown="handleStoryKeydown"
          />
          <button
            class="rounded-md bg-green-600 dark:bg-green-500 p-2 text-white hover:bg-green-700 dark:hover:bg-green-600 transition-colors duration-200"
            title="Save"
            @click="saveStoryTitle"
          >
            <svg
              class="h-5 w-5"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                stroke-width="2"
                d="M5 13l4 4L19 7"
              />
            </svg>
          </button>
          <button
            class="rounded-md bg-gray-400 dark:bg-gray-600 p-2 text-white hover:bg-gray-500 dark:hover:bg-gray-700 transition-colors duration-200"
            title="Cancel"
            @click="cancelEditStory"
          >
            <svg
              class="h-5 w-5"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                stroke-width="2"
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </button>
        </div>
      </div>
    </div>

    <!-- Statistics View (shown when votes revealed) -->
    <div v-if="roomState.votesRevealed">
      <VotingStatistics
        :participants="roomState.participants"
        :scale-type="currentScale.id"
      />
    </div>

    <!-- Voting View (shown when voting in progress) -->
    <template v-else>
      <!-- Voting disabled message -->
      <div
        v-if="!isJoined"
        class="mb-4 text-center"
      >
        <p class="text-sm text-gray-500 dark:text-gray-400 transition-colors duration-200">
          Join the room to start voting
        </p>
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
        <p class="text-gray-600 dark:text-gray-300 transition-colors duration-200">
          Your vote:
        </p>
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
          <p
            v-if="voteChanged"
            class="mt-2 inline-block rounded-full bg-yellow-100 dark:bg-yellow-900/30 px-3 py-1 text-sm font-medium text-yellow-800 dark:text-yellow-300 transition-colors duration-200"
          >
            Vote changed
          </p>
        </Transition>
      </div>

      <!-- Voting status -->
      <div
        v-if="isJoined && votingComplete"
        class="mt-4 text-center text-sm text-green-600 dark:text-green-400 transition-colors duration-200"
      >
        <p>All votes are in! Ready to reveal.</p>
      </div>
    </template>
  </div>
</template>
