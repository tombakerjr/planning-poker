<template>
  <div
    v-if="shouldShow"
    class="fixed top-4 right-4 z-50 flex items-center gap-2 px-3 py-2 rounded-lg shadow-lg transition-all duration-300"
    :class="containerClass"
  >
    <div class="relative">
      <div
        class="w-3 h-3 rounded-full"
        :class="dotClass"
      ></div>
      <div
        v-if="quality !== 'disconnected' && quality !== 'poor'"
        class="absolute inset-0 w-3 h-3 rounded-full animate-ping opacity-20"
        :class="dotClass"
      ></div>
    </div>

    <div class="flex flex-col">
      <span
        class="text-sm font-medium"
        :class="textClass"
      >
        {{ statusText }}
      </span>
      <span
        v-if="showLatency"
        class="text-xs opacity-75"
        :class="textClass"
      >
        {{ latencyText }}
      </span>
    </div>

    <div
      v-if="queuedCount > 0"
      class="ml-2 px-2 py-0.5 bg-white/20 rounded text-xs font-medium"
      :class="textClass"
    >
      {{ queuedCount }} queued
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';

import type { ConnectionQuality } from '~/composables/usePokerRoom';

const props = defineProps<{
  quality: ConnectionQuality
  status: string
  latency: number | null
  jitter: number | null
  queuedCount: number
}>();

const shouldShow = computed(() => {
  // Always show if disconnected, reconnecting, offline, or poor quality
  return props.quality === 'disconnected' ||
         props.quality === 'poor' ||
         props.status === 'RECONNECTING' ||
         props.status === 'CONNECTING' ||
         props.status === 'OFFLINE' ||
         props.queuedCount > 0;
});

const containerClass = computed(() => {
  if (props.quality === 'disconnected' || props.status === 'OFFLINE') {
    return 'bg-gray-700 dark:bg-gray-800';
  }
  if (props.quality === 'poor' || props.status === 'RECONNECTING') {
    return 'bg-red-600 dark:bg-red-700';
  }
  if (props.quality === 'fair') {
    return 'bg-yellow-600 dark:bg-yellow-700';
  }
  return 'bg-green-600 dark:bg-green-700';
});

const dotClass = computed(() => {
  if (props.quality === 'disconnected') return 'bg-gray-400';
  if (props.quality === 'poor') return 'bg-red-300';
  if (props.quality === 'fair') return 'bg-yellow-300';
  return 'bg-green-300';
});

const textClass = computed(() => 'text-white');

const statusText = computed(() => {
  if (props.status === 'RECONNECTING') return 'Reconnecting...';
  if (props.status === 'CONNECTING') return 'Connecting...';
  if (props.status === 'OFFLINE') return 'Offline';
  if (props.quality === 'disconnected') return 'Disconnected';
  if (props.quality === 'poor') return 'Poor Connection';
  if (props.quality === 'fair') return 'Fair Connection';
  return 'Connected';
});

const showLatency = computed(() =>
  props.quality !== 'disconnected' &&
  props.status !== 'OFFLINE' &&
  props.latency !== null,
);

const latencyText = computed(() => {
  if (!props.latency) return '';
  const jitterText = props.jitter ? ` ±${props.jitter}ms` : '';
  return `${Math.round(props.latency)}ms${jitterText}`;
});
</script>
