<script setup lang="ts">
interface Props {
  show: boolean
}

interface Emits {
  (e: 'join', name: string): void
  (e: 'close'): void
}

defineProps<Props>()
const emit = defineEmits<Emits>()

const name = ref('')
const isSubmitting = ref(false)

const handleSubmit = () => {
  const trimmedName = name.value.trim()
  if (!trimmedName) return

  isSubmitting.value = true
  emit('join', trimmedName)
  
  // Reset form
  name.value = ''
  isSubmitting.value = false
}

const handleClose = () => {
  name.value = ''
  emit('close')
}

// Generate a random guest name if empty
const generateGuestName = () => {
  const adjectives = ['Swift', 'Clever', 'Bright', 'Bold', 'Quick', 'Sharp']
  const animals = ['Fox', 'Eagle', 'Wolf', 'Hawk', 'Lion', 'Bear']
  const adj = adjectives[Math.floor(Math.random() * adjectives.length)]
  const animal = animals[Math.floor(Math.random() * animals.length)]
  name.value = `${adj}${animal}${Math.floor(Math.random() * 100)}`
}
</script>

<template>
  <div
    v-if="show"
    class="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50"
    @click.self="handleClose"
  >
    <div class="w-full max-w-md rounded-lg bg-white p-6 shadow-xl">
      <h2 class="mb-4 text-xl font-bold text-gray-900">
        Join Planning Poker Room
      </h2>
      
      <form @submit.prevent="handleSubmit">
        <div class="mb-4">
          <label
            for="name"
            class="mb-2 block text-sm font-medium text-gray-700"
          >
            Your Name
          </label>
          <input
            id="name"
            v-model="name"
            type="text"
            placeholder="Enter your name"
            class="w-full rounded-md border border-gray-300 px-3 py-2 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            :disabled="isSubmitting"
            required
          >
        </div>

        <div class="mb-6">
          <button
            type="button"
            @click="generateGuestName"
            class="text-sm text-blue-600 hover:text-blue-800"
            :disabled="isSubmitting"
          >
            Generate random name
          </button>
        </div>

        <div class="flex gap-3">
          <button
            type="button"
            @click="handleClose"
            class="flex-1 rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500"
            :disabled="isSubmitting"
          >
            Cancel
          </button>
          <button
            type="submit"
            class="flex-1 rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50"
            :disabled="!name.trim() || isSubmitting"
          >
            {{ isSubmitting ? 'Joining...' : 'Join Room' }}
          </button>
        </div>
      </form>
    </div>
  </div>
</template>
