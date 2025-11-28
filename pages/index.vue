<script setup lang="ts">
// Bug fix: Use console.error directly instead of server logger import
// (server code should not be imported in client components)

const isCreating = ref(false);
const error = ref('');

async function createRoom() {
  if (isCreating.value) return;

  isCreating.value = true;
  error.value = '';

  try {
    // Call the room creation API
    const response = await $fetch('/api/room/create', {
      method: 'POST',
    }) as { roomId: string };

    // Navigate to the new room
    await navigateTo(`/room/${response.roomId}`);
  } catch (err: any) {
    console.error('[CreateRoom] Error creating room:', err);
    error.value = err.message || 'Failed to create room. Please try again.';
  } finally {
    isCreating.value = false;
  }
}
</script>

<template>
  <div class="flex min-h-screen flex-col bg-gray-100 dark:bg-gray-900 transition-colors duration-200">
    <header class="border-b border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 shadow-sm transition-colors duration-200">
      <div class="mx-auto max-w-screen-xl px-4 py-4 sm:px-6 lg:px-8">
        <div class="flex items-center justify-between">
          <h1 class="text-2xl font-bold text-gray-900 dark:text-white">
            Planning Poker
          </h1>
          <ThemeToggle />
        </div>
      </div>
    </header>

    <main class="flex flex-grow items-center justify-center p-4 sm:p-6 lg:p-8">
      <div class="w-full max-w-md">
        <!-- Welcome Section -->
        <div class="text-center mb-8">
          <h2 class="text-3xl font-bold text-gray-900 dark:text-white mb-4 transition-colors duration-200">
            Welcome to Planning Poker
          </h2>
          <p class="text-lg text-gray-600 dark:text-gray-300 mb-2 transition-colors duration-200">
            Estimate your user stories with your team
          </p>
          <p class="text-sm text-gray-500 dark:text-gray-400 transition-colors duration-200">
            Create a room and invite your team to start planning together
          </p>
        </div>

        <!-- Create Room Form -->
        <div class="rounded-lg bg-white dark:bg-gray-800 p-6 shadow-lg transition-colors duration-200">
          <h3 class="text-xl font-semibold text-gray-800 dark:text-white mb-4 transition-colors duration-200">
            Create a New Room
          </h3>
          
          <div class="space-y-4">
            <!-- Error Message -->
            <div
              v-if="error"
              class="rounded-md bg-red-50 dark:bg-red-900/30 p-4 transition-colors duration-200"
            >
              <div class="flex">
                <div class="flex-shrink-0">
                  <svg
                    class="h-5 w-5 text-red-400 dark:text-red-300"
                    viewBox="0 0 20 20"
                    fill="currentColor"
                  >
                    <path
                      fill-rule="evenodd"
                      d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z"
                      clip-rule="evenodd"
                    />
                  </svg>
                </div>
                <div class="ml-3">
                  <p class="text-sm text-red-800 dark:text-red-200">
                    {{ error }}
                  </p>
                </div>
                <div class="ml-auto pl-3">
                  <div class="-mx-1.5 -my-1.5">
                    <button
                      class="inline-flex rounded-md bg-red-50 dark:bg-red-900/30 p-1.5 text-red-500 dark:text-red-300 hover:bg-red-100 dark:hover:bg-red-900/50 transition-colors"
                      @click="error = ''"
                    >
                      <svg
                        class="h-4 w-4"
                        viewBox="0 0 20 20"
                        fill="currentColor"
                      >
                        <path d="M6.28 5.22a.75.75 0 00-1.06 1.06L8.94 10l-3.72 3.72a.75.75 0 101.06 1.06L10 11.06l3.72 3.72a.75.75 0 101.06-1.06L11.06 10l3.72-3.72a.75.75 0 00-1.06-1.06L10 8.94 6.28 5.22z" />
                      </svg>
                    </button>
                  </div>
                </div>
              </div>
            </div>

            <!-- Bug fix: Removed unused roomName input field -->
            <!-- Room naming can be implemented as a future feature with server-side support -->

            <button
              :disabled="isCreating"
              class="w-full rounded-lg bg-blue-600 dark:bg-blue-500 px-4 py-3 text-white font-semibold shadow-md transition-all duration-200 ease-in-out hover:bg-blue-700 dark:hover:bg-blue-600 hover:shadow-lg focus:outline-none focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400 focus:ring-offset-2 dark:focus:ring-offset-gray-800 disabled:opacity-50 disabled:cursor-not-allowed"
              @click="createRoom"
            >
              <span v-if="!isCreating">Create Room</span>
              <span
                v-else
                class="flex items-center justify-center"
              >
                <svg
                  class="animate-spin -ml-1 mr-3 h-5 w-5 text-white"
                  xmlns="http://www.w3.org/2000/svg"
                  fill="none"
                  viewBox="0 0 24 24"
                >
                  <circle
                    class="opacity-25"
                    cx="12"
                    cy="12"
                    r="10"
                    stroke="currentColor"
                    stroke-width="4"
                  />
                  <path
                    class="opacity-75"
                    fill="currentColor"
                    d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                  />
                </svg>
                Creating...
              </span>
            </button>
          </div>
        </div>

        <!-- Recent Rooms Section -->
        <div class="mt-6">
          <RecentRooms />
        </div>

        <!-- Session History Section -->
        <SessionHistory />

        <!-- Features Section -->
        <div class="mt-8 text-center">
          <h4 class="text-lg font-semibold text-gray-800 dark:text-white mb-4 transition-colors duration-200">
            Features
          </h4>
          <div class="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div class="rounded-lg bg-white dark:bg-gray-800 p-4 shadow transition-colors duration-200">
              <div class="text-2xl mb-2">
                🃏
              </div>
              <h5 class="font-medium text-gray-800 dark:text-white transition-colors duration-200">
                Planning Cards
              </h5>
              <p class="text-sm text-gray-600 dark:text-gray-300 transition-colors duration-200">
                Fibonacci sequence and custom values
              </p>
            </div>
            <div class="rounded-lg bg-white dark:bg-gray-800 p-4 shadow transition-colors duration-200">
              <div class="text-2xl mb-2">
                👥
              </div>
              <h5 class="font-medium text-gray-800 dark:text-white transition-colors duration-200">
                Team Collaboration
              </h5>
              <p class="text-sm text-gray-600 dark:text-gray-300 transition-colors duration-200">
                Real-time voting and discussion
              </p>
            </div>
            <div class="rounded-lg bg-white dark:bg-gray-800 p-4 shadow transition-colors duration-200">
              <div class="text-2xl mb-2">
                📊
              </div>
              <h5 class="font-medium text-gray-800 dark:text-white transition-colors duration-200">
                Vote Tracking
              </h5>
              <p class="text-sm text-gray-600 dark:text-gray-300 transition-colors duration-200">
                See who voted and reveal results
              </p>
            </div>
            <div class="rounded-lg bg-white dark:bg-gray-800 p-4 shadow transition-colors duration-200">
              <div class="text-2xl mb-2">
                ⚡
              </div>
              <h5 class="font-medium text-gray-800 dark:text-white transition-colors duration-200">
                Fast & Simple
              </h5>
              <p class="text-sm text-gray-600 dark:text-gray-300 transition-colors duration-200">
                No registration required
              </p>
            </div>
          </div>
        </div>
      </div>
    </main>

    <footer class="py-4 text-center text-sm text-gray-500 dark:text-gray-400 transition-colors duration-200">
      <p>Start planning your next sprint with confidence</p>
    </footer>
  </div>
</template>
