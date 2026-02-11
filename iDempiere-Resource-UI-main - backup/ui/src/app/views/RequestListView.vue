<script setup lang="ts">
import type { Request, RequestStatus, RequestType } from '../../features/request/api'
import { onMounted, ref } from 'vue'
import { useAuth } from '../../features/auth/store'
import {
  deleteRequest,
  getStatusesForRequestType,
  listRequests,
  listRequestStatuses,
  listRequestTypes,

} from '../../features/request/api'
import RequestDetailModal from './RequestDetailModal.vue'

const auth = useAuth()

const requests = ref<Request[]>([])
const requestTypes = ref<RequestType[]>([])
const requestStatuses = ref<RequestStatus[]>([])
const availableStatuses = ref<RequestStatus[]>([]) // 狀態選項根據類別變化
const loading = ref(false)
const loadingStatuses = ref(false)
const error = ref<string | null>(null)

const searchQuery = ref('')
const filter = ref({
  requestTypeId: undefined as number | undefined,
  requestStatusId: undefined as number | undefined,
  hasDates: undefined as boolean | undefined,
})

const currentPage = ref(1)
const pageSize = 20
const totalCount = ref(0)

const hasNextPage = ref(false)
const showDetailModal = ref(false)
const selectedRequestId = ref<number | undefined>(undefined)
const expandedRows = ref(new Set<number>())
const showDeleteConfirm = ref(false)
const deletingRequestId = ref<number | undefined>(undefined)
const deleting = ref(false)

function getStatusClass(statusName?: string): string {
  const map: Record<string, string> = {
    開啟: 'bg-emerald-100 text-emerald-700',
    進行中: 'bg-blue-100 text-blue-700',
    已關閉: 'bg-slate-100 text-slate-700',
    待處理: 'bg-amber-100 text-amber-700',
  }
  return map[statusName || ''] || 'bg-slate-100 text-slate-700'
}

function formatDate(dateStr?: string): string {
  if (!dateStr)
    return '—'
  try {
    const d = new Date(dateStr)
    if (Number.isNaN(d.getTime()))
      return '無效日期'
    return `${d.getFullYear()}/${d.getMonth() + 1}/${d.getDate()}`
  }
  catch (e) {
    console.error('Date parsing error:', dateStr, e)
    return '格式錯誤'
  }
}

// 處理 Request Type 變化，更新可用狀態
async function onRequestTypeChange() {
  if (!auth.token.value)
    return

  // 清除當前狀態選擇
  filter.value.requestStatusId = undefined

  if (!filter.value.requestTypeId) {
    // 如果沒有選擇類別，顯示所有狀態
    availableStatuses.value = requestStatuses.value
    await loadData()
    return
  }

  loadingStatuses.value = true
  try {
    // 獲取該類別的特定狀態
    const statuses = await getStatusesForRequestType(auth.token.value, filter.value.requestTypeId)
    availableStatuses.value = statuses
  }
  catch (e) {
    console.error('Failed to load statuses for request type:', e)
    // 如果載入失敗，回退到所有狀態
    availableStatuses.value = requestStatuses.value
  }
  finally {
    loadingStatuses.value = false
  }

  await loadData()
}

async function loadData() {
  if (!auth.token.value)
    return

  loading.value = true
  error.value = null

  try {
    const result = await listRequests(
      auth.token.value,
      {
        requestTypeId: filter.value.requestTypeId,
        requestStatusId: filter.value.requestStatusId,
        hasStartDate: filter.value.hasDates,
        hasCloseDate: filter.value.hasDates,
      },
      { top: pageSize, skip: (currentPage.value - 1) * pageSize },
    )

    // 客户端搜索过滤（按客户名称或咨询单名称）
    let filteredRecords = result.records
    if (searchQuery.value.trim()) {
      const query = searchQuery.value.trim().toLowerCase()
      filteredRecords = result.records.filter((req) => {
        const nameMatch = req.name?.toLowerCase().includes(query) ?? false
        const customerMatch = req.bPartnerName?.toLowerCase().includes(query) ?? false
        return nameMatch || customerMatch
      })
    }

    requests.value = filteredRecords
    totalCount.value = searchQuery.value.trim() ? filteredRecords.length : (result.totalCount || 0)
    hasNextPage.value = currentPage.value * pageSize < totalCount.value
  }
  catch (e: any) {
    error.value = e?.detail || e?.title || e?.message || '載入失敗'
  }
  finally {
    loading.value = false
  }
}

function prevPage() {
  if (currentPage.value > 1) {
    currentPage.value--
    loadData()
  }
}

function nextPage() {
  if (hasNextPage.value) {
    currentPage.value++
    loadData()
  }
}

function toggleExpand(requestId: number) {
  if (expandedRows.value.has(requestId)) {
    expandedRows.value.delete(requestId)
  }
  else {
    expandedRows.value.add(requestId)
  }
}

function openEdit(req: Request) {
  selectedRequestId.value = req.id
  showDetailModal.value = true
}

function onRequestUpdated() {
  loadData()
}

function onRequestDeleted() {
  currentPage.value = 1
  loadData()
}

function confirmDelete(requestId: number) {
  deletingRequestId.value = requestId
  showDeleteConfirm.value = true
}

function cancelDelete() {
  showDeleteConfirm.value = false
  deletingRequestId.value = undefined
}

async function handleDelete() {
  if (!auth.token.value || !deletingRequestId.value)
    return

  deleting.value = true
  try {
    await deleteRequest(auth.token.value, deletingRequestId.value)
    showDeleteConfirm.value = false
    deletingRequestId.value = undefined
    // 如果删除后当前页没有数据了，回到上一页
    if (requests.value.length === 1 && currentPage.value > 1) {
      currentPage.value--
    }
    await loadData()
  }
  catch (e: any) {
    error.value = e?.detail || e?.title || e?.message || '刪除失敗'
    console.error('Failed to delete request:', e)
  }
  finally {
    deleting.value = false
  }
}

onMounted(async () => {
  if (!auth.token.value)
    return

  try {
    requestTypes.value = await listRequestTypes(auth.token.value)
    requestStatuses.value = await listRequestStatuses(auth.token.value)
    // 初始化可用狀態為所有狀態
    availableStatuses.value = requestStatuses.value
  }
  catch (e) {
    console.error('Failed to load request types/statuses:', e)
  }

  await loadData()
})
</script>

<template>
  <div class="space-y-4">
    <!-- Filter -->
    <div class="flex flex-wrap gap-4">
      <div class="flex-1 min-w-[200px]">
        <label class="text-sm font-medium text-slate-700">搜尋</label>
        <input
          v-model="searchQuery"
          type="text"
          class="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-brand-500 focus:ring-1 focus:ring-brand-500"
          placeholder="客戶名稱、諮詢單名稱..."
          @keyup.enter="loadData"
        >
      </div>
      <div class="min-w-[150px]">
        <label class="text-sm font-medium text-slate-700">Request Type</label>
        <select
          v-model="filter.requestTypeId"
          class="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm focus:border-brand-500 focus:ring-1 focus:ring-brand-500"
          @change="onRequestTypeChange"
        >
          <option :value="undefined">
            全部
          </option>
          <option v-for="type in requestTypes" :key="type.id" :value="type.id">
            {{ type.name }}
          </option>
        </select>
      </div>
      <div class="min-w-[150px]">
        <label class="text-sm font-medium text-slate-700">Status</label>
        <select
          v-model="filter.requestStatusId"
          class="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm focus:border-brand-500 focus:ring-1 focus:ring-brand-500"
          :disabled="loadingStatuses"
          @change="loadData"
        >
          <option :value="undefined">
            {{ loadingStatuses ? '載入中…' : '全部' }}
          </option>
          <option v-for="status in availableStatuses" :key="status.id" :value="status.id">
            {{ status.name }}
          </option>
        </select>
      </div>
      <div class="min-w-[150px]">
        <label class="text-sm font-medium text-slate-700">預約時間</label>
        <select
          v-model="filter.hasDates"
          class="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm focus:border-brand-500 focus:ring-1 focus:ring-brand-500"
          @change="loadData"
        >
          <option :value="undefined">
            全部
          </option>
          <option :value="true">
            有預約時間
          </option>
          <option :value="false">
            無預約時間
          </option>
        </select>
      </div>
      <div class="flex items-end">
        <button
          class="rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-700"
          @click="loadData"
        >
          {{ loading ? '載入中…' : '搜尋' }}
        </button>
      </div>
    </div>

    <!-- Error -->
    <div v-if="error" class="rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
      {{ error }}
    </div>

    <!-- Table -->
    <div class="overflow-x-auto border border-slate-200 rounded-lg">
      <table class="w-full text-sm">
        <thead class="bg-slate-50 text-left text-xs font-medium uppercase text-slate-500">
          <tr>
            <th class="px-4 py-3">
              諮詢單
            </th>
            <th class="px-4 py-3">
              客戶
            </th>
            <th class="px-4 py-3">
              最後聯繫
            </th>
            <th class="px-4 py-3">
              諮詢師
            </th>
            <th class="px-4 py-3">
              Type
            </th>
            <th class="px-4 py-3">
              Status
            </th>
            <th class="px-4 py-3">
              諮詢開始
            </th>
            <th class="px-4 py-3">
              諮詢結束
            </th>
            <th class="px-4 py-3 text-right">
              操作
            </th>
          </tr>
        </thead>
        <tbody class="divide-y divide-slate-200">
          <tr v-if="loading">
            <td colspan="8" class="px-4 py-8 text-center text-slate-500">
              載入中...
            </td>
          </tr>
          <tr v-else-if="requests.length === 0">
            <td colspan="8" class="px-4 py-8 text-center text-slate-500">
              無資料
            </td>
          </tr>
          <template v-for="req in requests" :key="req.id">
            <tr
              class="hover:bg-slate-50 cursor-pointer"
              @click="toggleExpand(req.id)"
            >
              <td class="px-4 py-3">
                <div class="flex items-center gap-2">
                  <svg
                    class="h-4 w-4 text-slate-400 transition-transform"
                    :class="{ 'rotate-90': expandedRows.has(req.id) }"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7" />
                  </svg>
                  <span class="font-medium text-slate-900">{{ req.name || '—' }}</span>
                </div>
              </td>
              <td class="px-4 py-3 text-slate-600">
                {{ req.bPartnerName || '—' }}
              </td>
              <td class="px-4 py-3">
                <span class="text-slate-600" title="最後聯絡客戶的日期">
                  {{ req.lastContactDate ? formatDate(req.lastContactDate) : '—' }}
                </span>
              </td>
              <td class="px-4 py-3 text-slate-600">
                {{ req.salesRepName || '—' }}
              </td>
              <td class="px-4 py-3">
                <span class="inline-flex rounded-full bg-blue-100 px-2 py-0.5 text-xs font-medium text-blue-700">
                  {{ req.requestTypeName || '—' }}
                </span>
              </td>
              <td class="px-4 py-3">
                <span
                  :class="getStatusClass(req.requestStatusName)"
                  class="inline-flex rounded-full px-2 py-0.5 text-xs font-medium"
                >
                  {{ req.requestStatusName || '—' }}
                </span>
              </td>
              <td class="px-4 py-3 text-slate-600">
                {{ formatDate(req.startDate) }}
              </td>
              <td class="px-4 py-3 text-slate-600">
                {{ formatDate(req.closeDate) }}
              </td>
              <td class="px-4 py-3 text-right" @click.stop>
                <div class="flex items-center justify-end gap-2">
                  <button
                    class="text-brand-600 hover:text-brand-700 font-medium"
                    @click="openEdit(req)"
                  >
                    編輯
                  </button>
                  <button
                    class="text-rose-600 hover:text-rose-700 font-medium"
                    @click="confirmDelete(req.id)"
                  >
                    刪除
                  </button>
                </div>
              </td>
            </tr>
            <tr v-if="expandedRows.has(req.id)" class="bg-slate-50">
              <td colspan="8" class="px-4 py-4">
                <div class="space-y-2">
                  <div class="flex items-start gap-2">
                    <span class="text-xs font-medium text-slate-500 min-w-[60px]">說明：</span>
                    <p class="text-sm text-slate-700 flex-1 whitespace-pre-wrap">
                      {{ req.description || '無說明' }}
                    </p>
                  </div>
                </div>
              </td>
            </tr>
          </template>
        </tbody>
      </table>
    </div>

    <!-- Pagination -->
    <div class="flex items-center justify-between">
      <div class="text-sm text-slate-600">
        共 {{ totalCount }} 筆
      </div>
      <div class="flex gap-2">
        <button
          :disabled="currentPage <= 1"
          class="rounded-lg border border-slate-200 px-3 py-1 text-sm disabled:opacity-50"
          @click="prevPage"
        >
          上一頁
        </button>
        <span class="px-3 py-1 text-sm text-slate-600">第 {{ currentPage }} 頁</span>
        <button
          :disabled="!hasNextPage"
          class="rounded-lg border border-slate-200 px-3 py-1 text-sm disabled:opacity-50"
          @click="nextPage"
        >
          下一頁
        </button>
      </div>
    </div>

    <!-- Request Detail Modal -->
    <RequestDetailModal
      v-model:show-modal="showDetailModal"
      :request-id="selectedRequestId"
      @updated="onRequestUpdated"
      @deleted="onRequestDeleted"
    />

    <!-- Delete Confirm Dialog -->
    <Teleport to="body">
      <div
        v-if="showDeleteConfirm"
        class="fixed inset-0 z-[60] flex items-center justify-center bg-black/40"
        @click.self="cancelDelete"
      >
        <div class="w-full max-w-sm rounded-2xl bg-white p-6 shadow-xl">
          <h3 class="text-lg font-semibold text-slate-900">
            確認刪除
          </h3>
          <p class="mt-2 text-sm text-slate-600">
            確定要刪除此諮詢單嗎？此操作無法復原。
          </p>
          <div class="mt-6 flex gap-3">
            <button
              class="flex-1 rounded-lg bg-rose-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-rose-700 disabled:opacity-60"
              :disabled="deleting"
              @click="handleDelete"
            >
              {{ deleting ? '刪除中…' : '確認刪除' }}
            </button>
            <button
              class="rounded-lg border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50"
              @click="cancelDelete"
            >
              取消
            </button>
          </div>
        </div>
      </div>
    </Teleport>
  </div>
</template>
