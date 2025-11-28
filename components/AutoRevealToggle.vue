<script setup lang="ts">
const props = defineProps<{
  autoReveal: boolean
}>();

const emit = defineEmits<{
  (e: 'update:autoReveal', value: boolean): void
}>();

function toggleAutoReveal() {
  emit('update:autoReveal', !props.autoReveal);
}
</script>

<template>
  <div class="flex items-center gap-3 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-4 py-2 transition-colors duration-200">
    <div class="flex-1">
      <p class="text-sm font-medium text-gray-700 dark:text-gray-200 transition-colors duration-200">
        Auto-reveal
      </p>
      <p class="text-xs text-gray-500 dark:text-gray-400 transition-colors duration-200">
        Reveal votes when everyone has voted
      </p>
    </div>
    <button
      type="button"
      role="switch"
      :aria-checked="autoReveal"
      class="relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400 focus:ring-offset-2 dark:focus:ring-offset-gray-800"
      :class="autoReveal ? 'bg-blue-600 dark:bg-blue-500' : 'bg-gray-200 dark:bg-gray-600'"
      @click="toggleAutoReveal"
    >
      <span class="sr-only">Toggle auto-reveal</span>
      <span
        aria-hidden="true"
        class="pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out"
        :class="autoReveal ? 'translate-x-5' : 'translate-x-0'"
      ></span>
    </button>
  </div>
</template>
