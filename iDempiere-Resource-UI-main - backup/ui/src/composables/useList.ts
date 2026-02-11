/**
 * 列表管理 Composable
 * 提供通用的列表加载、分页、搜索等功能
 */

import { computed, ref } from 'vue'
import { getErrorMessage } from '../shared/utils/error'

export interface ListOptions<T> {
  loadFn: (params: {
    top: number
    skip: number
    filter?: string
    [key: string]: unknown
  }) => Promise<{ records: T[], totalCount?: number }>
  pageSize?: number
  initialFilter?: Record<string, unknown>
}

export function useList<T>(options: ListOptions<T>) {
  const { loadFn, pageSize = 20, initialFilter = {} } = options

  const records = ref<T[]>([])
  const loading = ref(false)
  const error = ref<string | null>(null)
  const currentPage = ref(1)
  const totalCount = ref(0)
  const searchQuery = ref('')
  const filter = ref<Record<string, unknown>>({ ...initialFilter })

  const hasNextPage = computed(() => {
    return currentPage.value * pageSize < totalCount.value
  })

  async function loadList() {
    loading.value = true
    error.value = null

    try {
      const searchParams: Record<string, unknown> = {
        top: pageSize,
        skip: (currentPage.value - 1) * pageSize,
        ...filter.value,
      }

      // 添加文本搜索
      if (searchQuery.value.trim()) {
        searchParams.filter = searchQuery.value.trim()
      }

      const result = await loadFn(searchParams)
      records.value = result.records
      totalCount.value = result.totalCount ?? result.records.length
    }
    catch (e: unknown) {
      error.value = getErrorMessage(e, '載入列表失敗')
    }
    finally {
      loading.value = false
    }
  }

  function prevPage() {
    if (currentPage.value > 1) {
      currentPage.value--
      loadList()
    }
  }

  function nextPage() {
    if (hasNextPage.value) {
      currentPage.value++
      loadList()
    }
  }

  function resetPage() {
    currentPage.value = 1
  }

  function clearFilters() {
    filter.value = { ...initialFilter }
    searchQuery.value = ''
    resetPage()
    loadList()
  }

  return {
    records,
    loading,
    error,
    currentPage,
    totalCount,
    searchQuery,
    filter,
    hasNextPage,
    loadList,
    prevPage,
    nextPage,
    resetPage,
    clearFilters,
  }
}
