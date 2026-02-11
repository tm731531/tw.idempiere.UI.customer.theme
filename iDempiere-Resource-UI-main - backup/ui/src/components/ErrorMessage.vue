<script setup lang="ts">
defineProps<{
  message: string | null
}>()
</script>

<template>
  <div
    v-if="message"
    class="rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700 whitespace-pre-line"
  >
    {{ message }}
  </div>
</template>
