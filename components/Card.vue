<script setup lang="ts">
defineProps<{
  value: string | number
  selected?: boolean
}>()

defineEmits<{
  (e: 'select'): void
}>()
</script>

<template>
  <button
    type="button"
    class="flex h-36 w-24 items-center justify-center rounded-lg border border-gray-200 bg-white text-2xl font-bold shadow-md transition-all duration-200 ease-in-out hover:-translate-y-1 hover:shadow-lg focus:outline-none focus:ring-2 focus:ring-blue-400 focus:ring-offset-2"
    :class="{ 'ring-4 ring-blue-500 shadow-xl -translate-y-1': selected }"
    @click="$emit('select')"
  >
    {{ value }}
  </button>
</template>
