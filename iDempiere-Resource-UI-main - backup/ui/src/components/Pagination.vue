<script setup lang="ts">
import { computed } from 'vue'

const props = defineProps<{
  currentPage: number
  totalCount: number
  pageSize: number
}>()

const emit = defineEmits<{
  'update:currentPage': [page: number]
}>()

const hasNextPage = computed(() => {
  return props.currentPage * props.pageSize < props.totalCount
})

function prevPage() {
  if (props.currentPage > 1) {
    emit('update:currentPage', props.currentPage - 1)
  }
}

function nextPage() {
  if (hasNextPage.value) {
    emit('update:currentPage', props.currentPage + 1)
  }
}
</script>

<template>
  <div class="flex items-center justify-between border-t border-slate-200 px-4 py-3">
    <div class="text-sm text-slate-600">
      共 {{ totalCount }} 筆
    </div>
    <div class="flex gap-2">
      <button
        type="button"
        :disabled="currentPage <= 1"
        class="rounded-lg border border-slate-200 px-3 py-1 text-sm disabled:opacity-50 disabled:cursor-not-allowed"
        @click="prevPage"
      >
        上一頁
      </button>
      <span class="px-3 py-1 text-sm text-slate-600">第 {{ currentPage }} 頁</span>
      <button
        type="button"
        :disabled="!hasNextPage"
        class="rounded-lg border border-slate-200 px-3 py-1 text-sm disabled:opacity-50 disabled:cursor-not-allowed"
        @click="nextPage"
      >
        下一頁
      </button>
    </div>
  </div>
</template>
