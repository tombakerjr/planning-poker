<script setup lang="ts">
const roomName = ref('')
const isCreating = ref(false)
const error = ref('')

async function createRoom() {
  if (isCreating.value) return
  
  isCreating.value = true
  error.value = ''
  
  try {
    // Call the room creation API
    const response = await $fetch('/api/room/create', {
      method: 'POST',
    }) as { roomId: string }
    
    // Navigate to the new room
    await navigateTo(`/room/${response.roomId}`)
  } catch (err: any) {
    console.error('Error creating room:', err)
    error.value = err.message || 'Failed to create room. Please try again.'
  } finally {
    isCreating.value = false
  }
}

function handleKeyPress(event: KeyboardEvent) {
  if (event.key === 'Enter') {
    createRoom()
  }
}
</script>

<template>
  <div class="flex min-h-screen flex-col bg-gray-100">
    <header class="border-b border-gray-200 bg-white shadow-sm">
      <div class="mx-auto max-w-screen-xl px-4 py-4 sm:px-6 lg:px-8">
        <h1 class="text-2xl font-bold text-gray-900">Planning Poker</h1>
      </div>
    </header>

    <main class="flex flex-grow items-center justify-center p-4 sm:p-6 lg:p-8">
      <div class="w-full max-w-md">
        <!-- Welcome Section -->
        <div class="text-center mb-8">
          <h2 class="text-3xl font-bold text-gray-900 mb-4">
            Welcome to Planning Poker
          </h2>
          <p class="text-lg text-gray-600 mb-2">
            Estimate your user stories with your team
          </p>
          <p class="text-sm text-gray-500">
            Create a room and invite your team to start planning together
          </p>
        </div>

        <!-- Create Room Form -->
        <div class="rounded-lg bg-white p-6 shadow-lg">
          <h3 class="text-xl font-semibold text-gray-800 mb-4">
            Create a New Room
          </h3>
          
          <div class="space-y-4">
            <!-- Error Message -->
            <div v-if="error" class="rounded-md bg-red-50 p-4">
              <div class="flex">
                <div class="flex-shrink-0">
                  <svg class="h-5 w-5 text-red-400" viewBox="0 0 20 20" fill="currentColor">
                    <path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clip-rule="evenodd" />
                  </svg>
                </div>
                <div class="ml-3">
                  <p class="text-sm text-red-800">{{ error }}</p>
                </div>
                <div class="ml-auto pl-3">
                  <div class="-mx-1.5 -my-1.5">
                    <button
                      @click="error = ''"
                      class="inline-flex rounded-md bg-red-50 p-1.5 text-red-500 hover:bg-red-100"
                    >
                      <svg class="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                        <path d="M6.28 5.22a.75.75 0 00-1.06 1.06L8.94 10l-3.72 3.72a.75.75 0 101.06 1.06L10 11.06l3.72 3.72a.75.75 0 101.06-1.06L11.06 10l3.72-3.72a.75.75 0 00-1.06-1.06L10 8.94 6.28 5.22z" />
                      </svg>
                    </button>
                  </div>
                </div>
              </div>
            </div>

            <div>
              <label for="roomName" class="block text-sm font-medium text-gray-700 mb-2">
                Room Name (Optional)
              </label>
              <input
                id="roomName"
                v-model="roomName"
                type="text"
                placeholder="e.g., Sprint Planning - Team Alpha"
                class="w-full rounded-lg border border-gray-300 px-4 py-3 text-gray-900 placeholder-gray-500 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
                @keypress="handleKeyPress"
                :disabled="isCreating"
              />
            </div>
            
            <button
              @click="createRoom"
              :disabled="isCreating"
              class="w-full rounded-lg bg-blue-600 px-4 py-3 text-white font-semibold shadow-md transition-all duration-200 ease-in-out hover:bg-blue-700 hover:shadow-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <span v-if="!isCreating">Create Room</span>
              <span v-else class="flex items-center justify-center">
                <svg class="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                  <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                Creating...
              </span>
            </button>
          </div>
        </div>

        <!-- Features Section -->
        <div class="mt-8 text-center">
          <h4 class="text-lg font-semibold text-gray-800 mb-4">Features</h4>
          <div class="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div class="rounded-lg bg-white p-4 shadow">
              <div class="text-2xl mb-2">🃏</div>
              <h5 class="font-medium text-gray-800">Planning Cards</h5>
              <p class="text-sm text-gray-600">Fibonacci sequence and custom values</p>
            </div>
            <div class="rounded-lg bg-white p-4 shadow">
              <div class="text-2xl mb-2">👥</div>
              <h5 class="font-medium text-gray-800">Team Collaboration</h5>
              <p class="text-sm text-gray-600">Real-time voting and discussion</p>
            </div>
            <div class="rounded-lg bg-white p-4 shadow">
              <div class="text-2xl mb-2">📊</div>
              <h5 class="font-medium text-gray-800">Vote Tracking</h5>
              <p class="text-sm text-gray-600">See who voted and reveal results</p>
            </div>
            <div class="rounded-lg bg-white p-4 shadow">
              <div class="text-2xl mb-2">⚡</div>
              <h5 class="font-medium text-gray-800">Fast & Simple</h5>
              <p class="text-sm text-gray-600">No registration required</p>
            </div>
          </div>
        </div>
      </div>
    </main>

    <footer class="py-4 text-center text-sm text-gray-500">
      <p>Start planning your next sprint with confidence</p>
    </footer>
  </div>
</template>
