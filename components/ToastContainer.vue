<script setup lang="ts">
import { useToast } from '~/composables/useToast';

const { toasts, removeToast } = useToast();

const getIcon = (type: string) => {
  switch (type) {
    case 'success':
      return '✓';
    case 'error':
      return '✕';
    case 'warning':
      return '⚠';
    case 'info':
      return 'ℹ';
    default:
      return '';
  }
};

const getColorClasses = (type: string) => {
  switch (type) {
    case 'success':
      return 'bg-green-50 dark:bg-green-900/30 border-green-500 dark:border-green-400 text-green-800 dark:text-green-200 transition-colors duration-200';
    case 'error':
      return 'bg-red-50 dark:bg-red-900/30 border-red-500 dark:border-red-400 text-red-800 dark:text-red-200 transition-colors duration-200';
    case 'warning':
      return 'bg-yellow-50 dark:bg-yellow-900/30 border-yellow-500 dark:border-yellow-400 text-yellow-800 dark:text-yellow-200 transition-colors duration-200';
    case 'info':
      return 'bg-blue-50 dark:bg-blue-900/30 border-blue-500 dark:border-blue-400 text-blue-800 dark:text-blue-200 transition-colors duration-200';
    default:
      return 'bg-gray-50 dark:bg-gray-800 border-gray-500 dark:border-gray-400 text-gray-800 dark:text-gray-200 transition-colors duration-200';
  }
};
</script>

<template>
  <div
    class="pointer-events-none fixed inset-0 z-50 flex items-end justify-center p-4 sm:justify-end sm:p-6"
    aria-live="polite"
    aria-atomic="true"
    role="status"
  >
    <div class="flex w-full flex-col items-center space-y-4 sm:items-end">
      <TransitionGroup
        enter-active-class="transform transition duration-300 ease-out"
        enter-from-class="translate-y-2 opacity-0"
        enter-to-class="translate-y-0 opacity-100"
        leave-active-class="transition duration-200 ease-in"
        leave-from-class="opacity-100"
        leave-to-class="opacity-0"
      >
        <div
          v-for="toast in toasts"
          :key="toast.id"
          class="pointer-events-auto w-full max-w-sm overflow-hidden rounded-lg border-l-4 shadow-lg"
          :class="getColorClasses(toast.type)"
        >
          <div class="p-4">
            <div class="flex items-start">
              <div class="flex-shrink-0">
                <span class="text-xl font-bold">{{ getIcon(toast.type) }}</span>
              </div>
              <div class="ml-3 flex-1 pt-0.5">
                <p class="text-sm font-medium">
                  {{ toast.message }}
                </p>
              </div>
              <div class="ml-4 flex flex-shrink-0">
                <button
                  class="inline-flex rounded-md focus:outline-none focus:ring-2 focus:ring-offset-2 dark:focus:ring-offset-gray-800 transition-colors duration-200"
                  :class="{
                    'text-green-500 dark:text-green-400 hover:text-green-600 dark:hover:text-green-300 focus:ring-green-500 dark:focus:ring-green-400': toast.type === 'success',
                    'text-red-500 dark:text-red-400 hover:text-red-600 dark:hover:text-red-300 focus:ring-red-500 dark:focus:ring-red-400': toast.type === 'error',
                    'text-yellow-500 dark:text-yellow-400 hover:text-yellow-600 dark:hover:text-yellow-300 focus:ring-yellow-500 dark:focus:ring-yellow-400': toast.type === 'warning',
                    'text-blue-500 dark:text-blue-400 hover:text-blue-600 dark:hover:text-blue-300 focus:ring-blue-500 dark:focus:ring-blue-400': toast.type === 'info',
                  }"
                  @click="removeToast(toast.id)"
                >
                  <span class="sr-only">Close</span>
                  <svg
                    class="h-5 w-5"
                    viewBox="0 0 20 20"
                    fill="currentColor"
                  >
                    <path
                      fill-rule="evenodd"
                      d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z"
                      clip-rule="evenodd"
                    />
                  </svg>
                </button>
              </div>
            </div>
          </div>
        </div>
      </TransitionGroup>
    </div>
  </div>
</template>
