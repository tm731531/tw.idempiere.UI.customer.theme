<script setup lang="ts">
import { computed } from 'vue'
import { getDocStatusClass, getDocStatusText, getRequestStatusClass } from '../shared/utils/format'

const props = defineProps<{
  status: string | null | undefined
  type?: 'doc' | 'request'
  customText?: string
}>()

const statusClass = computed(() => {
  if (props.type === 'request') {
    return getRequestStatusClass(props.status || undefined)
  }
  return getDocStatusClass(props.status)
})

const statusText = computed(() => {
  if (props.customText)
    return props.customText
  if (props.type === 'request')
    return props.status || '—'
  return getDocStatusText(props.status)
})
</script>

<template>
  <span
    :class="statusClass"
    class="inline-flex rounded-full px-2 py-0.5 text-xs font-medium"
  >
    {{ statusText }}
  </span>
</template>
