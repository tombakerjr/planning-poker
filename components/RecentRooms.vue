<script setup lang="ts">
import { useSessionStorage } from '~/composables/useSessionStorage';

const { sortedRecentRooms, removeRecentRoom, clearRecentRooms } = useSessionStorage();

// Format relative time (e.g., "2 hours ago")
function formatRelativeTime(timestamp: number): string {
  const now = Date.now();
  const diff = now - timestamp;
  const minutes = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days = Math.floor(diff / 86400000);

  if (minutes < 1) return 'Just now';
  if (minutes < 60) return `${minutes}m ago`;
  if (hours < 24) return `${hours}h ago`;
  if (days < 7) return `${days}d ago`;
  return new Date(timestamp).toLocaleDateString();
}

function handleRemove(roomId: string, event: Event) {
  event.preventDefault();
  event.stopPropagation();
  removeRecentRoom(roomId);
}
</script>

<template>
  <div
    v-if="sortedRecentRooms.length > 0"
    class="w-full"
  >
    <div class="flex items-center justify-between mb-3">
      <h3 class="text-lg font-semibold text-gray-800 dark:text-white transition-colors duration-200">
        Recent Rooms
      </h3>
      <button
        class="text-xs text-gray-500 dark:text-gray-400 hover:text-red-600 dark:hover:text-red-400 transition-colors"
        title="Clear all recent rooms"
        @click="clearRecentRooms"
      >
        Clear all
      </button>
    </div>

    <div class="space-y-2">
      <NuxtLink
        v-for="room in sortedRecentRooms"
        :key="room.roomId"
        :to="`/room/${room.roomId}`"
        class="group flex items-center justify-between rounded-lg bg-white dark:bg-gray-800 p-3 shadow-sm hover:shadow-md transition-all duration-200 border border-gray-200 dark:border-gray-700"
      >
        <div class="flex-1 min-w-0">
          <div class="flex items-center gap-2">
            <span class="font-medium text-gray-900 dark:text-white truncate transition-colors duration-200">
              {{ room.name }}
            </span>
            <span class="text-xs text-gray-400 dark:text-gray-500 shrink-0">
              {{ formatRelativeTime(room.lastVisited) }}
            </span>
          </div>
          <div class="flex items-center gap-2 mt-1">
            <span class="text-xs text-gray-500 dark:text-gray-400 font-mono truncate transition-colors duration-200">
              {{ room.roomId }}
            </span>
            <span
              v-if="room.storyTitle"
              class="text-xs text-blue-600 dark:text-blue-400 truncate max-w-[150px] transition-colors duration-200"
              :title="room.storyTitle"
            >
              {{ room.storyTitle }}
            </span>
          </div>
        </div>

        <div class="flex items-center gap-2 ml-2">
          <!-- Rejoin arrow -->
          <span class="text-gray-400 group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
            <svg
              class="w-5 h-5"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                stroke-width="2"
                d="M9 5l7 7-7 7"
              />
            </svg>
          </span>

          <!-- Remove button -->
          <button
            class="p-1 rounded-full text-gray-400 hover:text-red-600 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors opacity-0 group-hover:opacity-100"
            title="Remove from recent rooms"
            @click="handleRemove(room.roomId, $event)"
          >
            <svg
              class="w-4 h-4"
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
      </NuxtLink>
    </div>
  </div>
</template>
