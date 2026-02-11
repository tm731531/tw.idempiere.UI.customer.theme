<script setup lang="ts">
defineProps<{
  message: string | null
}>()
</script>

<template>
  <div
    v-if="message"
    class="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700"
  >
    {{ message }}
  </div>
</template>
