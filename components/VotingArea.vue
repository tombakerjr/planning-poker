<script setup lang="ts">
import { ref } from 'vue'

const storyTitle = 'As a user, I want to see my vote reflected in the UI.'

const pokerDeck = ['1', '2', '3', '5', '8', '13', '21', '?', '☕️']

const selectedValue = ref<string | number | null>(null)

function handleSelect(value: string | number) {
  if (selectedValue.value === value) {
    selectedValue.value = null // Deselect if the same card is clicked
  } else {
    selectedValue.value = value
  }
}
</script>

<template>
  <div class="w-full max-w-2xl rounded-lg bg-gray-50 p-6 shadow-md">
    <div class="text-center">
      <h2 class="text-lg font-semibold text-gray-600">Story for Estimation:</h2>
      <p class="mb-6 text-xl font-bold text-gray-800">{{ storyTitle }}</p>
    </div>

    <div class="grid grid-cols-3 justify-items-center gap-4 sm:grid-cols-5">
      <Card
        v-for="cardValue in pokerDeck"
        :key="cardValue"
        :value="cardValue"
        :selected="selectedValue === cardValue"
        @select="handleSelect(cardValue)"
      />
    </div>

    <div class="mt-8 text-center">
      <p class="text-gray-600">Your vote:</p>
      <p class="min-h-[48px] text-4xl font-bold text-blue-600">
        {{ selectedValue ?? '...' }}
      </p>
    </div>
  </div>
</template>
