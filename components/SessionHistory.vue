<script setup lang="ts">
import { useSessionStorage } from '~/composables/useSessionStorage'

const {
  sortedSessionHistory,
  sessionStats,
  removeSessionFromHistory,
  clearSessionHistory,
  downloadExport,
} = useSessionStorage()

const isExpanded = ref(false)
const showExportMenu = ref(false)

// Format date for display
function formatDate(timestamp: number): string {
  return new Date(timestamp).toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

// Format duration
function formatDuration(joinedAt: number, leftAt: number | null): string {
  if (!leftAt) return 'In progress'
  const minutes = Math.round((leftAt - joinedAt) / 60000)
  if (minutes < 60) return `${minutes}m`
  const hours = Math.floor(minutes / 60)
  const remainingMinutes = minutes % 60
  return `${hours}h ${remainingMinutes}m`
}

function handleExport(format: 'json' | 'csv') {
  downloadExport(format)
  showExportMenu.value = false
}

function handleRemove(roomId: string, joinedAt: number, event: Event) {
  event.stopPropagation()
  removeSessionFromHistory(roomId, joinedAt)
}

// Close export menu when clicking outside
function handleClickOutside(event: MouseEvent) {
  const target = event.target as HTMLElement
  if (!target.closest('.export-menu-container')) {
    showExportMenu.value = false
  }
}

onMounted(() => {
  document.addEventListener('click', handleClickOutside)
})

onUnmounted(() => {
  document.removeEventListener('click', handleClickOutside)
})
</script>

<template>
  <div v-if="sortedSessionHistory.length > 0" class="w-full mt-6">
    <!-- Header with toggle -->
    <button
      @click="isExpanded = !isExpanded"
      class="w-full flex items-center justify-between p-3 rounded-lg bg-gray-50 dark:bg-gray-800/50 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors duration-200"
    >
      <div class="flex items-center gap-2">
        <svg
          class="w-5 h-5 text-gray-600 dark:text-gray-400 transition-transform duration-200"
          :class="{ 'rotate-90': isExpanded }"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7" />
        </svg>
        <span class="font-semibold text-gray-800 dark:text-white transition-colors duration-200">
          Session History
        </span>
        <span class="text-xs text-gray-500 dark:text-gray-400 bg-gray-200 dark:bg-gray-700 px-2 py-0.5 rounded-full transition-colors duration-200">
          {{ sessionStats.totalSessions }} sessions
        </span>
      </div>

      <!-- Stats preview when collapsed -->
      <div v-if="!isExpanded" class="flex items-center gap-4 text-xs text-gray-500 dark:text-gray-400">
        <span>{{ sessionStats.totalRounds }} rounds</span>
        <span>{{ sessionStats.avgParticipants }} avg participants</span>
      </div>
    </button>

    <!-- Expanded content -->
    <Transition
      enter-active-class="transition-all duration-200 ease-out"
      enter-from-class="opacity-0 max-h-0"
      enter-to-class="opacity-100 max-h-[500px]"
      leave-active-class="transition-all duration-200 ease-in"
      leave-from-class="opacity-100 max-h-[500px]"
      leave-to-class="opacity-0 max-h-0"
    >
      <div v-if="isExpanded" class="mt-2 overflow-hidden">
        <!-- Action buttons -->
        <div class="flex items-center justify-between mb-3 px-1">
          <div class="flex items-center gap-2">
            <!-- Export dropdown -->
            <div class="relative export-menu-container">
              <button
                @click.stop="showExportMenu = !showExportMenu"
                class="flex items-center gap-1 px-3 py-1.5 text-sm font-medium text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/30 hover:bg-blue-100 dark:hover:bg-blue-900/50 rounded-md transition-colors"
              >
                <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                </svg>
                Export
              </button>

              <!-- Dropdown menu -->
              <Transition
                enter-active-class="transition ease-out duration-100"
                enter-from-class="transform opacity-0 scale-95"
                enter-to-class="transform opacity-100 scale-100"
                leave-active-class="transition ease-in duration-75"
                leave-from-class="transform opacity-100 scale-100"
                leave-to-class="transform opacity-0 scale-95"
              >
                <div
                  v-if="showExportMenu"
                  class="absolute left-0 mt-1 w-32 rounded-md bg-white dark:bg-gray-800 shadow-lg ring-1 ring-black ring-opacity-5 z-10"
                >
                  <button
                    @click="handleExport('json')"
                    class="block w-full text-left px-4 py-2 text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-t-md"
                  >
                    Export as JSON
                  </button>
                  <button
                    @click="handleExport('csv')"
                    class="block w-full text-left px-4 py-2 text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-b-md"
                  >
                    Export as CSV
                  </button>
                </div>
              </Transition>
            </div>
          </div>

          <button
            @click="clearSessionHistory"
            class="text-xs text-gray-500 dark:text-gray-400 hover:text-red-600 dark:hover:text-red-400 transition-colors"
          >
            Clear all
          </button>
        </div>

        <!-- Session list -->
        <div class="space-y-2 max-h-[350px] overflow-y-auto">
          <div
            v-for="session in sortedSessionHistory"
            :key="`${session.roomId}-${session.joinedAt}`"
            class="group flex items-center justify-between rounded-lg bg-white dark:bg-gray-800 p-3 shadow-sm border border-gray-200 dark:border-gray-700 transition-colors duration-200"
          >
            <div class="flex-1 min-w-0">
              <div class="flex items-center gap-2">
                <span class="font-medium text-gray-900 dark:text-white truncate transition-colors duration-200">
                  {{ session.userName }}
                </span>
                <span class="text-xs text-gray-400 dark:text-gray-500 font-mono truncate">
                  {{ session.roomId }}
                </span>
              </div>
              <div class="flex items-center gap-3 mt-1 text-xs text-gray-500 dark:text-gray-400">
                <span>{{ formatDate(session.joinedAt) }}</span>
                <span>{{ formatDuration(session.joinedAt, session.leftAt) }}</span>
                <span>{{ session.participantCount }} participants</span>
                <span>{{ session.roundCount }} rounds</span>
              </div>
            </div>

            <button
              @click="handleRemove(session.roomId, session.joinedAt, $event)"
              class="p-1 rounded-full text-gray-400 hover:text-red-600 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors opacity-0 group-hover:opacity-100"
              title="Remove from history"
            >
              <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>
      </div>
    </Transition>
  </div>
</template>
