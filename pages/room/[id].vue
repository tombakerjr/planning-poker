<script setup lang="ts">
const route = useRoute()
</script>

<template>
  <div class="flex min-h-screen flex-col bg-gray-100">
    <header class="border-b border-gray-200 bg-white shadow-sm">
      <div class="mx-auto max-w-screen-xl px-4 py-4 sm:px-6 lg:px-8">
        <h1 class="text-2xl font-bold text-gray-900">Planning Poker</h1>
      </div>
    </header>

    <main class="flex-grow p-4 sm:p-6 lg:p-8">
      <div
        class="mx-auto grid max-w-screen-xl grid-cols-1 items-start gap-8 lg:grid-cols-3"
      >
        <!-- Main voting area -->
        <div class="lg:col-span-2">
          <VotingArea />
        </div>

        <!-- Participant list sidebar -->
        <div class="lg:col-span-1">
          <ParticipantList />
        </div>
      </div>
    </main>

    <footer class="py-4 text-center text-sm text-gray-500">
      <p>Room ID: {{ route.params.id }}</p>
    </footer>
  </div>
</template>
