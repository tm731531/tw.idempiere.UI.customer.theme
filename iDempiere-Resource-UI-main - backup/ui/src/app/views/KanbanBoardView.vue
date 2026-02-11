<script setup lang="ts">
import type { Request, RequestStatus, RequestType } from '../../features/request/api'
import { computed, onMounted, ref } from 'vue'
import { useAuth } from '../../features/auth/store'
import {
  listRequests,
  listRequestStatuses,
  listRequestTypes,

  updateRequestStatus,
} from '../../features/request/api'
import RequestDetailModal from './RequestDetailModal.vue'

const auth = useAuth()

const requests = ref<Request[]>([])
const requestTypes = ref<RequestType[]>([])
const requestStatuses = ref<RequestStatus[]>([])
const loading = ref(false)
const error = ref<string | null>(null)

const searchQuery = ref('')
const filter = ref({
  requestTypeId: undefined as number | undefined,
})

const showDetailModal = ref(false)
const selectedRequestId = ref<number | undefined>(undefined)

// Drag and drop state
const draggingOver = ref<number | null>(null)
const draggedRequest = ref<Request | null>(null)

// Computed kanban statuses (filter out inactive ones and sort by sequence)
const kanbanStatuses = computed(() => {
  return requestStatuses.value
    .filter(status => status.isActive)
    .sort((a, b) => (a.seqNo || 0) - (b.seqNo || 0))
})

// Filter requests based on search query
const filteredRequests = computed(() => {
  if (!searchQuery.value)
    return requests.value

  const query = searchQuery.value.toLowerCase()
  return requests.value.filter(req =>
    (req.name?.toLowerCase().includes(query))
    || (req.bPartnerName?.toLowerCase().includes(query))
    || (req.salesRepName?.toLowerCase().includes(query)),
  )
})

// Group requests by status
function getRequestsByStatus(statusName: string): Request[] {
  return filteredRequests.value.filter(req => req.requestStatusName === statusName)
}

function formatDate(dateStr?: string): string {
  if (!dateStr)
    return '—'
  const d = new Date(dateStr)
  return `${d.getMonth() + 1}/${d.getDate()}`
}

// Debounce search
let searchTimeout: NodeJS.Timeout | null = null
function debouncedFilter() {
  if (searchTimeout)
    clearTimeout(searchTimeout)
  searchTimeout = setTimeout(() => {
    // Filter is reactive, no need to do anything
  }, 300)
}

// Drag and drop handlers
function onDragStart(event: DragEvent, request: Request) {
  draggedRequest.value = request
  if (event.dataTransfer) {
    event.dataTransfer.effectAllowed = 'move'
    event.dataTransfer.setData('text/plain', request.id.toString())
  }
}

function onDragEnter(statusId: number) {
  draggingOver.value = statusId
}

function onDragLeave(statusId: number) {
  if (draggingOver.value === statusId) {
    draggingOver.value = null
  }
}

async function onDrop(event: DragEvent, statusId: number) {
  event.preventDefault()
  draggingOver.value = null

  if (!draggedRequest.value || !auth.token.value)
    return

  const request = draggedRequest.value
  const newStatus = requestStatuses.value.find(s => s.id === statusId)

  if (!newStatus)
    return

  // Don't update if status hasn't changed
  if (request.requestStatusName === newStatus.name)
    return

  try {
    // Update request status
    await updateRequestStatus(auth.token.value, request.id, statusId)

    // Update local data
    request.requestStatusId = statusId
    request.requestStatusName = newStatus.name

    // Refresh data to ensure consistency
    await loadData()
  }
  catch (e: any) {
    error.value = e?.detail || e?.title || e?.message || '更新狀態失敗'
    console.error('Failed to update request status:', e)
  }
  finally {
    draggedRequest.value = null
  }
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
      },
      { top: 1000 }, // Load more for kanban view
    )

    requests.value = result.records
  }
  catch (e: any) {
    error.value = e?.detail || e?.title || e?.message || '載入失敗'
  }
  finally {
    loading.value = false
  }
}

function openDetail(req: Request) {
  selectedRequestId.value = req.id
  showDetailModal.value = true
}

function onRequestUpdated() {
  loadData()
}

function onRequestDeleted() {
  loadData()
}

onMounted(async () => {
  if (!auth.token.value)
    return

  try {
    requestTypes.value = await listRequestTypes(auth.token.value)
    requestStatuses.value = await listRequestStatuses(auth.token.value)
  }
  catch (e) {
    console.error('Failed to load request types/statuses:', e)
  }

  await loadData()
})
</script>

<template>
  <div class="space-y-4">
    <!-- Header with filters -->
    <div class="flex flex-wrap gap-4">
      <div class="flex-1 min-w-[200px]">
        <label class="text-sm font-medium text-slate-700">搜尋</label>
        <input
          v-model="searchQuery"
          type="text"
          class="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-brand-500 focus:ring-1 focus:ring-brand-500"
          placeholder="客戶名稱、諮詢單名稱..."
          @input="debouncedFilter"
        >
      </div>
      <div class="min-w-[150px]">
        <label class="text-sm font-medium text-slate-700">Request Type</label>
        <select
          v-model="filter.requestTypeId"
          class="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm focus:border-brand-500 focus:ring-1 focus:ring-brand-500"
          @change="loadData"
        >
          <option :value="undefined">
            全部
          </option>
          <option v-for="type in requestTypes" :key="type.id" :value="type.id">
            {{ type.name }}
          </option>
        </select>
      </div>
      <div class="flex items-end">
        <button
          class="rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-700"
          @click="loadData"
        >
          {{ loading ? '載入中…' : '重新整理' }}
        </button>
      </div>
    </div>

    <!-- Error -->
    <div v-if="error" class="rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
      {{ error }}
    </div>

    <!-- Kanban Board -->
    <div v-if="!loading && !error" class="flex gap-6 overflow-x-auto pb-4">
      <div
        v-for="status in kanbanStatuses"
        :key="status.id"
        class="flex-shrink-0 w-80"
      >
        <!-- Column Header -->
        <div class="mb-4 rounded-lg bg-slate-100 p-4">
          <div class="flex items-center justify-between">
            <h3 class="font-semibold text-slate-900">
              {{ status.name }}
            </h3>
            <span class="rounded-full bg-slate-200 px-2 py-1 text-xs font-medium text-slate-700">
              {{ getRequestsByStatus(status.name).length }}
            </span>
          </div>
        </div>

        <!-- Cards Container -->
        <div
          class="min-h-[400px] rounded-lg border-2 border-dashed border-slate-200 bg-slate-50 p-4 transition-colors"
          :class="{
            'border-brand-300 bg-brand-50': draggingOver === status.id,
          }"
          @dragover.prevent
          @dragenter="onDragEnter(status.id)"
          @dragleave="onDragLeave(status.id)"
          @drop="onDrop($event, status.id)"
        >
          <!-- Request Cards -->
          <div
            v-for="request in getRequestsByStatus(status.name)"
            :key="request.id"
            class="mb-3 cursor-move rounded-lg border border-slate-200 bg-white p-4 shadow-sm transition-shadow hover:shadow-md"
            draggable="true"
            @dragstart="onDragStart($event, request)"
          >
            <div class="space-y-2">
              <h4 class="font-medium text-slate-900">
                {{ request.name || '未命名' }}
              </h4>
              <p class="text-sm text-slate-600">
                {{ request.bPartnerName || '未指定客戶' }}
              </p>
              <div class="flex items-center justify-between">
                <span class="inline-flex rounded-full bg-blue-100 px-2 py-0.5 text-xs font-medium text-blue-700">
                  {{ request.requestTypeName || '—' }}
                </span>
                <span class="text-xs text-slate-500">{{ formatDate(request.startDate) }}</span>
              </div>
              <div class="flex items-center justify-between pt-2">
                <span class="text-xs text-slate-500">{{ request.salesRepName || '未分配' }}</span>
                <button
                  class="text-xs text-brand-600 hover:text-brand-800"
                  @click="openDetail(request)"
                >
                  詳細
                </button>
              </div>
            </div>
          </div>

          <!-- Empty State -->
          <div v-if="getRequestsByStatus(status.name).length === 0" class="text-center text-slate-400">
            <div class="text-sm">
              無{{ status.name }}的請求
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Loading State -->
    <div v-if="loading" class="flex justify-center py-12">
      <div class="text-slate-500">
        載入中...
      </div>
    </div>

    <!-- Request Detail Modal -->
    <RequestDetailModal
      v-model:show-modal="showDetailModal"
      :request-id="selectedRequestId"
      @updated="onRequestUpdated"
      @deleted="onRequestDeleted"
    />
  </div>
</template>
