<script setup lang="ts">
import { useVotingScale, type VotingScaleType } from '~/composables/useVotingScale'

const emit = defineEmits<{
  (e: 'change', scaleType: VotingScaleType): void
}>()

const { currentScale, currentScaleType, availableScales, setScale } = useVotingScale()
const isOpen = ref(false)

function handleScaleChange(scaleType: VotingScaleType) {
  setScale(scaleType)
  emit('change', scaleType)
  isOpen.value = false
}

// Close dropdown on Escape key
function handleKeydown(event: KeyboardEvent) {
  if (event.key === 'Escape' && isOpen.value) {
    isOpen.value = false
  }
}

// Add/remove keyboard listener
onMounted(() => {
  if (typeof window !== 'undefined') {
    window.addEventListener('keydown', handleKeydown)
  }
})

onUnmounted(() => {
  if (typeof window !== 'undefined') {
    window.removeEventListener('keydown', handleKeydown)
  }
})
</script>

<template>
  <div class="relative">
    <button
      @click="isOpen = !isOpen"
      class="flex items-center gap-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400 transition-colors duration-200"
      :title="`Current scale: ${currentScale.name}`"
    >
      <svg class="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M7 21a4 4 0 01-4-4V5a2 2 0 012-2h4a2 2 0 012 2v12a4 4 0 01-4 4zm0 0h12a2 2 0 002-2v-4a2 2 0 00-2-2h-2.343M11 7.343l1.657-1.657a2 2 0 012.828 0l2.829 2.829a2 2 0 010 2.828l-8.486 8.485M7 17h.01" />
      </svg>
      <span class="hidden sm:inline">{{ currentScale.name }}</span>
      <svg class="h-4 w-4" :class="{ 'rotate-180': isOpen }" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7" />
      </svg>
    </button>

    <!-- Dropdown -->
    <Transition
      enter-active-class="transition ease-out duration-100"
      enter-from-class="transform opacity-0 scale-95"
      enter-to-class="transform opacity-100 scale-100"
      leave-active-class="transition ease-in duration-75"
      leave-from-class="transform opacity-100 scale-100"
      leave-to-class="transform opacity-0 scale-95"
    >
      <div
        v-if="isOpen"
        class="absolute right-0 z-10 mt-2 w-72 origin-top-right rounded-lg border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-800 shadow-lg ring-1 ring-black ring-opacity-5 focus:outline-none transition-colors duration-200"
      >
        <div class="p-2">
          <p class="px-3 py-2 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider transition-colors duration-200">
            Select Voting Scale
          </p>
          <button
            v-for="scale in availableScales"
            :key="scale.id"
            @click="handleScaleChange(scale.id)"
            class="w-full rounded-md px-3 py-2 text-left transition-colors duration-200"
            :class="{
              'bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300': currentScaleType === scale.id,
              'text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700': currentScaleType !== scale.id,
            }"
          >
            <div class="flex items-start justify-between">
              <div class="flex-1">
                <p class="text-sm font-medium">{{ scale.name }}</p>
                <p class="text-xs text-gray-500 dark:text-gray-400 mt-0.5 transition-colors duration-200">{{ scale.description }}</p>
                <div class="mt-1 flex flex-wrap gap-1">
                  <span
                    v-for="(value, idx) in scale.values.slice(0, 8)"
                    :key="idx"
                    class="inline-block rounded px-1.5 py-0.5 text-xs font-mono bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 transition-colors duration-200"
                  >
                    {{ value }}
                  </span>
                  <span
                    v-if="scale.values.length > 8"
                    class="inline-block rounded px-1.5 py-0.5 text-xs text-gray-500 dark:text-gray-400"
                  >
                    +{{ scale.values.length - 8 }} more
                  </span>
                </div>
              </div>
              <svg
                v-if="currentScaleType === scale.id"
                class="h-5 w-5 text-blue-600 dark:text-blue-400 ml-2 flex-shrink-0 transition-colors duration-200"
                fill="currentColor"
                viewBox="0 0 20 20"
              >
                <path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clip-rule="evenodd" />
              </svg>
            </div>
          </button>
        </div>
      </div>
    </Transition>

    <!-- Click outside to close -->
    <div
      v-if="isOpen"
      @click="isOpen = false"
      class="fixed inset-0 z-0"
    ></div>
  </div>
</template>
