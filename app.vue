<script setup lang="ts">
import { useColorMode } from '~/composables/useColorMode';

// Initialize color mode on app mount (needed for side effects)
useColorMode();

// Global maintenance mode state (set by usePokerRoom when server reports maintenance)
const maintenance = useState('maintenance-mode', () => false);
</script>

<template>
  <div class="transition-colors duration-200">
    <!-- Maintenance overlay -->
    <Teleport to="body">
      <Transition name="fade">
        <div
          v-if="maintenance"
          class="fixed inset-0 z-50 flex items-center justify-center bg-gray-900/95 backdrop-blur-sm"
        >
          <div class="text-center p-8 max-w-md">
            <div class="text-6xl mb-6">
              🔧
            </div>
            <h1 class="text-3xl font-bold text-white mb-4">
              Under Maintenance
            </h1>
            <p class="text-gray-300 mb-2">
              Planning Poker is temporarily unavailable for scheduled maintenance.
            </p>
            <p class="text-gray-400 text-sm">
              We'll be back shortly. Thank you for your patience!
            </p>
          </div>
        </div>
      </Transition>
    </Teleport>

    <NuxtRouteAnnouncer />
    <NuxtPage />
  </div>
</template>

<style>
.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.3s ease;
}

.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}
</style>
