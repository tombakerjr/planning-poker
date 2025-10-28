<script setup lang="ts">
import { usePokerRoom, PokerRoomKey } from '~/composables/usePokerRoom'
import type { VotingScaleType } from '~/composables/useVotingScale'

const route = useRoute()
const roomId = route.params.id as string

// Initialize the poker room composable
const pokerRoom = usePokerRoom(roomId)

// Provide the poker room to child components with type safety
provide(PokerRoomKey, pokerRoom)
const {
  roomState,
  currentUser,
  isJoined,
  status,
  isLoading,
  reconnectAttempts,
  connectToRoom,
  leaveRoom,
  joinRoom,
  tryAutoRejoin,
  setVotingScale,
  setAutoReveal,
} = pokerRoom

// Handle scale changes - send to server, which will broadcast to all clients
const handleScaleChange = (scaleType: VotingScaleType) => {
  setVotingScale(scaleType)
}

// Handle auto-reveal toggle
const handleAutoRevealChange = (value: boolean) => {
  setAutoReveal(value)
}

const showNameModal = ref(true)

// Auto-connect when component mounts
onMounted(() => {
  connectToRoom()
  
  // Try to auto-rejoin if we have a saved session
  setTimeout(() => {
    if (status.value === 'OPEN' && !isJoined.value) {
      const autoJoined = tryAutoRejoin()
      if (autoJoined) {
        showNameModal.value = false
      }
    }
  }, 500) // Small delay to ensure connection is established
})

// Clean up when leaving the page
onBeforeUnmount(() => {
  leaveRoom()
})

// Handle joining the room
const handleJoinRoom = (name: string) => {
  const success = joinRoom(name)
  if (success) {
    showNameModal.value = false
  }
}

// Copy room link to clipboard
const { success: toastSuccess } = useToast()
const copyRoomLink = async () => {
  const roomUrl = `${window.location.origin}/room/${roomId}`
  try {
    await navigator.clipboard.writeText(roomUrl)
    toastSuccess('Room link copied to clipboard!')
  } catch (error) {
    // Fallback for older browsers
    const textArea = document.createElement('textarea')
    textArea.value = roomUrl
    textArea.style.position = 'fixed'
    textArea.style.left = '-999999px'
    document.body.appendChild(textArea)
    textArea.select()
    try {
      document.execCommand('copy')
      toastSuccess('Room link copied to clipboard!')
    } catch (err) {
      console.error('Failed to copy:', err)
    }
    document.body.removeChild(textArea)
  }
}

// Show modal again if disconnected
watch(status, (newStatus) => {
  if (newStatus === 'CLOSED' && isJoined.value) {
    // Connection lost, might want to show reconnection status
  }
})
</script>

<template>
  <div class="flex min-h-screen flex-col bg-gray-100 dark:bg-gray-900 transition-colors duration-200">
    <header class="border-b border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 shadow-sm transition-colors duration-200">
      <div class="mx-auto max-w-screen-xl px-4 py-4 sm:px-6 lg:px-8">
        <div class="flex items-center justify-between">
          <h1 class="text-2xl font-bold text-gray-900 dark:text-white transition-colors duration-200">Planning Poker</h1>

          <div class="flex items-center gap-4">
            <!-- Auto-Reveal Toggle -->
            <AutoRevealToggle
              v-if="isJoined"
              :auto-reveal="roomState.autoReveal || false"
              @update:auto-reveal="handleAutoRevealChange"
            />

            <!-- Voting Scale Selector -->
            <VotingScaleSelector v-if="isJoined" :current-scale-id="roomState.votingScale" @change="handleScaleChange" />

            <!-- Theme Toggle -->
            <ThemeToggle />

            <!-- Copy Link Button -->
            <button
              @click="copyRoomLink"
              class="flex items-center gap-2 rounded-md bg-blue-600 dark:bg-blue-500 px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-700 dark:hover:bg-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400 transition-colors duration-200"
              title="Copy room link"
            >
              <svg class="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
              </svg>
              <span class="hidden sm:inline">Copy Link</span>
            </button>

            <!-- Connection Status -->
            <div class="flex items-center gap-2">
              <div
                class="h-2 w-2 rounded-full"
                :class="{
                  'bg-green-500': status === 'OPEN',
                  'bg-yellow-500 animate-pulse': status === 'CONNECTING' || status === 'RECONNECTING',
                  'bg-red-500': status === 'CLOSED'
                }"
              />
              <span class="text-sm text-gray-600 dark:text-gray-300 transition-colors duration-200">
                {{
                  status === 'OPEN'
                    ? 'Connected'
                    : status === 'CONNECTING'
                    ? 'Connecting...'
                    : status === 'RECONNECTING'
                    ? `Reconnecting (${reconnectAttempts}/10)...`
                    : 'Disconnected'
                }}
              </span>
            </div>
          </div>
        </div>
      </div>
    </header>

    <main class="flex-grow p-4 sm:p-6 lg:p-8">
      <!-- Loading/Connection State -->
      <div v-if="status === 'CONNECTING'" class="mx-auto max-w-screen-xl">
        <div class="text-center py-12">
          <div class="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 dark:border-blue-400 mx-auto mb-4"></div>
          <p class="text-gray-600 dark:text-gray-300 transition-colors duration-200">Connecting to room...</p>
        </div>
      </div>

      <!-- Main Content -->
      <div
        v-else-if="status === 'OPEN'"
        class="mx-auto grid max-w-screen-xl grid-cols-1 items-start gap-8 lg:grid-cols-3"
      >
        <!-- Main voting area -->
        <div class="lg:col-span-2">
          <VotingArea />
        </div>

        <!-- Participant list sidebar -->
        <div class="lg:col-span-1">
          <ParticipantList />
        </div>
      </div>

      <!-- Connection Error -->
      <div v-else class="mx-auto max-w-screen-xl">
        <div class="text-center py-12">
          <div class="text-red-500 dark:text-red-400 mb-4">
            <svg class="h-12 w-12 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z"></path>
            </svg>
          </div>
          <h2 class="text-xl font-semibold text-gray-900 dark:text-white mb-2 transition-colors duration-200">Connection Failed</h2>
          <p class="text-gray-600 dark:text-gray-300 mb-4 transition-colors duration-200">Unable to connect to the room</p>
          <button
            @click="connectToRoom"
            class="rounded-md bg-blue-600 dark:bg-blue-500 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 dark:hover:bg-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400 transition-colors duration-200"
          >
            Try Again
          </button>
        </div>
      </div>
    </main>

    <footer class="py-4 text-center text-sm text-gray-500 dark:text-gray-400 transition-colors duration-200">
      <p>Room ID: {{ route.params.id }}</p>
      <p v-if="currentUser && isJoined" class="mt-1">
        Joined as: <span class="font-medium">{{ currentUser.name }}</span>
      </p>
    </footer>

    <!-- User Name Modal -->
    <UserNameModal
      :show="showNameModal && status === 'OPEN'"
      @join="handleJoinRoom"
      @close="showNameModal = false"
    />

    <!-- Toast Notifications -->
    <ToastContainer />
  </div>
</template>
