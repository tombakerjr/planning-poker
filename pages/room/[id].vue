<script setup lang="ts">
import { usePokerRoom } from '~/composables/usePokerRoom'

const route = useRoute()
const roomId = route.params.id as string

// Initialize the poker room composable
const pokerRoom = usePokerRoom(roomId)
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
} = pokerRoom

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

// Show modal again if disconnected
watch(status, (newStatus) => {
  if (newStatus === 'CLOSED' && isJoined.value) {
    // Connection lost, might want to show reconnection status
  }
})

// Provide the room state and actions to child components
provide('pokerRoom', pokerRoom)
</script>

<template>
  <div class="flex min-h-screen flex-col bg-gray-100">
    <header class="border-b border-gray-200 bg-white shadow-sm">
      <div class="mx-auto max-w-screen-xl px-4 py-4 sm:px-6 lg:px-8">
        <div class="flex items-center justify-between">
          <h1 class="text-2xl font-bold text-gray-900">Planning Poker</h1>
          
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
            <span class="text-sm text-gray-600">
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
    </header>

    <main class="flex-grow p-4 sm:p-6 lg:p-8">
      <!-- Loading/Connection State -->
      <div v-if="status === 'CONNECTING'" class="mx-auto max-w-screen-xl">
        <div class="text-center py-12">
          <div class="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p class="text-gray-600">Connecting to room...</p>
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
          <div class="text-red-500 mb-4">
            <svg class="h-12 w-12 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z"></path>
            </svg>
          </div>
          <h2 class="text-xl font-semibold text-gray-900 mb-2">Connection Failed</h2>
          <p class="text-gray-600 mb-4">Unable to connect to the room</p>
          <button
            @click="connectToRoom"
            class="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            Try Again
          </button>
        </div>
      </div>
    </main>

    <footer class="py-4 text-center text-sm text-gray-500">
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
