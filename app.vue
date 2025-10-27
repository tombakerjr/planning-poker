<script setup lang="ts">
import { useColorMode } from '~/composables/useColorMode'

// Initialize color mode on app mount (needed for side effects)
useColorMode()
</script>

<template>
  <div class="transition-colors duration-200">
    <NuxtRouteAnnouncer />
    <NuxtPage />
  </div>
</template>
