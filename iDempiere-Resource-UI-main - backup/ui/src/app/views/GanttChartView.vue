<script setup lang="ts">
import type { Request, RequestStatus, RequestType } from '../../features/request/api'
import { computed, onMounted, ref } from 'vue'
import { useAuth } from '../../features/auth/store'
import {
  listRequests,
  listRequestStatuses,
  listRequestTypes,

} from '../../features/request/api'
import { apiFetch } from '../../shared/api/http'

const auth = useAuth()

const requests = ref<Request[]>([])
const requestTypes = ref<RequestType[]>([])
const requestStatuses = ref<RequestStatus[]>([])
const groupBy = ref<'customer' | 'salesRep'>('customer')
const loading = ref(false)
const error = ref<string | null>(null)

const userNames = ref<Map<number, string>>(new Map())
const customerNames = ref<Map<number, string>>(new Map())

// Enhanced features
const zoomLevel = ref<'week' | 'month' | 'quarter'>('month')
const filter = ref({
  statusId: undefined as number | undefined,
  typeId: undefined as number | undefined,
})
const currentDate = ref(new Date())

// Time range helpers
const timeRange = computed(() => {
  const baseDate = new Date(currentDate.value)
  let daysCount = 30

  if (zoomLevel.value === 'week') {
    daysCount = 14
  }
  else if (zoomLevel.value === 'quarter') {
    daysCount = 90
  }

  const startOffset = zoomLevel.value === 'week' ? -7 : -Math.floor(daysCount / 2)
  const startDate = new Date(baseDate)
  startDate.setDate(startDate.getDate() + startOffset)
  startDate.setHours(0, 0, 0, 0)

  const endDate = new Date(startDate)
  endDate.setDate(endDate.getDate() + daysCount)
  endDate.setHours(0, 0, 0, 0)

  return { startDate, endDate, daysCount }
})

const timelineDays = computed(() => {
  const days: Array<{ key: string, day: string, date: string, isToday?: boolean }> = []
  const { startDate, endDate } = timeRange.value
  const today = new Date()
  today.setHours(0, 0, 0, 0)

  const current = new Date(startDate)
  while (current <= endDate) {
    const isToday = current.getTime() === today.getTime()

    let dayLabel, dateLabel
    if (zoomLevel.value === 'quarter') {
      dayLabel = `${current.getMonth() + 1}月`
      dateLabel = `${current.getDate()}日`
    }
    else {
      const dayNames = ['日', '一', '二', '三', '四', '五', '六']
      dayLabel = `週${dayNames[current.getDay()]}`
      dateLabel = `${current.getMonth() + 1}/${current.getDate()}`
    }

    days.push({
      key: `d${current.getTime()}`,
      day: dayLabel,
      date: dateLabel,
      isToday,
    })

    current.setDate(current.getDate() + 1)
  }

  return days
})

const todayLinePosition = computed(() => {
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const { startDate, endDate } = timeRange.value

  if (today < startDate || today > endDate)
    return null

  const totalDays = (endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24)
  const todayOffset = (today.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24)

  return (todayOffset / totalDays) * 100
})

const totalRequests = computed(() => requests.value.length)

const activeRequests = computed(() =>
  requests.value.filter(req =>
    req.requestStatusName === '開啟' || req.requestStatusName === '進行中',
  ).length,
)

function getStatusColor(statusName?: string): string {
  const statusColors: Record<string, string> = {
    開啟: '#10b981',
    進行中: '#3b82f6',
    已關閉: '#6b7280',
    待處理: '#f59e0b',
  }
  return statusColors[statusName || ''] || '#3b82f6'
}

const groupedRequests = computed(() => {
  const groups = new Map<number, Request[]>()

  for (const req of requests.value) {
    if (!req.startDate)
      continue

    const key = groupBy.value === 'customer' ? req.bPartnerId : (req.salesRepId || 0)

    if (!groups.has(key)) {
      groups.set(key, [])
    }

    groups.get(key)!.push(req)
  }

  return groups
})

function getGroupName(groupId: number): string {
  if (groupId === 0)
    return '未指派'

  if (groupBy.value === 'customer') {
    return customerNames.value.get(groupId) || `客戶 #${groupId}`
  }
  else {
    return userNames.value.get(groupId) || `諮詢師 #${groupId}`
  }
}

function getRequestStyle(req: Request): Record<string, string> {
  if (!req.startDate || !req.closeDate) {
    return {
      left: '0%',
      width: '0%',
      backgroundColor: '#94a3b8',
      borderColor: '#64748b',
    }
  }

  const startDate = new Date(req.startDate)
  startDate.setHours(0, 0, 0, 0)

  const endDate = new Date(req.closeDate)
  endDate.setHours(0, 0, 0, 0)

  const { startDate: rangeStart, endDate: rangeEnd } = timeRange.value
  const totalDays = (rangeEnd.getTime() - rangeStart.getTime()) / (1000 * 60 * 60 * 24)

  // Calculate position within the visible range
  const startOffset = Math.max(0, (startDate.getTime() - rangeStart.getTime()) / (1000 * 60 * 60 * 24))
  const endOffset = Math.min(totalDays, (endDate.getTime() - rangeStart.getTime()) / (1000 * 60 * 60 * 24))

  const left = (startOffset / totalDays) * 100
  const width = Math.max(2, (endOffset - startOffset) / totalDays * 100)

  const statusColors: Record<string, string> = {
    開啟: '#10b981',
    進行中: '#3b82f6',
    已關閉: '#6b7280',
    待處理: '#f59e0b',
  }

  const color = statusColors[req.requestStatusName || ''] || '#3b82f6'

  return {
    left: `${left}%`,
    width: `${width}%`,
    backgroundColor: `${color}90`,
    borderColor: color,
  }
}

function formatDate(dateStr?: string): string {
  if (!dateStr)
    return '—'
  const d = new Date(dateStr)
  return `${d.getMonth() + 1}/${d.getDate()}`
}

function getProgressPercentage(req: Request): number {
  // For now, we'll simulate progress based on status
  // In a real implementation, this would come from a progress field
  const statusProgress: Record<string, number> = {
    待處理: 0,
    開啟: 25,
    進行中: 60,
    已關閉: 100,
  }
  return statusProgress[req.requestStatusName || ''] || 0
}

function onRequestClick(req: Request) {
  // Emit event to parent or open modal
  // For now, just log the request
  console.log('Request clicked:', req)
}

// Navigation functions
function setZoomLevel(level: 'week' | 'month' | 'quarter') {
  zoomLevel.value = level
}

function goToToday() {
  currentDate.value = new Date()
}

function goToPrevious() {
  const date = new Date(currentDate.value)
  if (zoomLevel.value === 'week') {
    date.setDate(date.getDate() - 7)
  }
  else if (zoomLevel.value === 'month') {
    date.setMonth(date.getMonth() - 1)
  }
  else {
    date.setMonth(date.getMonth() - 3)
  }
  currentDate.value = date
}

function goToNext() {
  const date = new Date(currentDate.value)
  if (zoomLevel.value === 'week') {
    date.setDate(date.getDate() + 7)
  }
  else if (zoomLevel.value === 'month') {
    date.setMonth(date.getMonth() + 1)
  }
  else {
    date.setMonth(date.getMonth() + 3)
  }
  currentDate.value = date
}

async function loadData() {
  if (!auth.token.value)
    return

  loading.value = true
  error.value = null

  try {
    const result = await listRequests(auth.token.value, {
      hasStartDate: true,
      requestStatusId: filter.value.statusId,
      requestTypeId: filter.value.typeId,
    })
    requests.value = result.records.filter(r => r.startDate && r.closeDate)

    // Load group names
    const ids = Array.from(
      new Set([
        ...requests.value.map(r => r.bPartnerId),
        ...requests.value.map(r => r.salesRepId || 0),
      ]),
    ).filter(id => id > 0)

    if (ids.length > 0) {
      // Load user names (sales reps)
      try {
        const userFilter = ids.map(id => `AD_User_ID eq ${id}`).join(' or ')
        const userRes = await apiFetch<{ records: any[] }>(
          '/api/v1/models/AD_User',
          {
            token: auth.token.value,
            searchParams: {
              $select: 'AD_User_ID,Name',
              $filter: userFilter,
            },
          },
        )

        for (const r of userRes.records || []) {
          userNames.value.set(Number(r.id), String(r.Name || ''))
        }
      }
      catch (e) {
        console.warn('Failed to load user names:', e)
      }

      // Load business partner names (customers)
      try {
        const bpFilter = ids.map(id => `C_BPartner_ID eq ${id}`).join(' or ')
        const bpRes = await apiFetch<{ records: any[] }>(
          '/api/v1/models/C_BPartner',
          {
            token: auth.token.value,
            searchParams: {
              $select: 'C_BPartner_ID,Name',
              $filter: bpFilter,
            },
          },
        )

        for (const r of bpRes.records || []) {
          customerNames.value.set(Number(r.id), String(r.Name || ''))
        }
      }
      catch (e) {
        console.warn('Failed to load business partner names:', e)
      }
    }
  }
  catch (e: any) {
    error.value = e?.detail || e?.title || e?.message || '載入失敗'
  }
  finally {
    loading.value = false
  }
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
    <div class="space-y-4">
      <div class="flex items-center justify-between">
        <h2 class="text-base font-semibold text-slate-900">
          諮詢甘特圖
        </h2>
        <div class="flex items-center gap-2">
          <button
            class="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
            :class="{ 'bg-slate-100': zoomLevel === 'week' }"
            @click="setZoomLevel('week')"
          >
            週
          </button>
          <button
            class="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
            :class="{ 'bg-slate-100': zoomLevel === 'month' }"
            @click="setZoomLevel('month')"
          >
            月
          </button>
          <button
            class="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
            :class="{ 'bg-slate-100': zoomLevel === 'quarter' }"
            @click="setZoomLevel('quarter')"
          >
            季
          </button>
        </div>
      </div>

      <!-- Filters and Controls -->
      <div class="flex flex-wrap gap-4">
        <div class="flex items-center gap-2">
          <label class="text-sm font-medium text-slate-700">分組：</label>
          <select
            v-model="groupBy"
            class="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm focus:border-brand-500 focus:ring-1 focus:ring-brand-500"
            @change="loadData"
          >
            <option value="customer">
              依客戶
            </option>
            <option value="salesRep">
              依諮詢師
            </option>
          </select>
        </div>

        <div class="flex items-center gap-2">
          <label class="text-sm font-medium text-slate-700">狀態：</label>
          <select
            v-model="filter.statusId"
            class="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm focus:border-brand-500 focus:ring-1 focus:ring-brand-500"
            @change="loadData"
          >
            <option :value="undefined">
              全部狀態
            </option>
            <option v-for="status in requestStatuses" :key="status.id" :value="status.id">
              {{ status.name }}
            </option>
          </select>
        </div>

        <div class="flex items-center gap-2">
          <label class="text-sm font-medium text-slate-700">類型：</label>
          <select
            v-model="filter.typeId"
            class="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm focus:border-brand-500 focus:ring-1 focus:ring-brand-500"
            @change="loadData"
          >
            <option :value="undefined">
              全部類型
            </option>
            <option v-for="type in requestTypes" :key="type.id" :value="type.id">
              {{ type.name }}
            </option>
          </select>
        </div>

        <div class="flex items-center gap-2">
          <button
            class="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
            @click="goToToday"
          >
            今天
          </button>
          <button
            class="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
            @click="goToPrevious"
          >
            ◀
          </button>
          <button
            class="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
            @click="goToNext"
          >
            ▶
          </button>
        </div>
      </div>
    </div>

    <!-- Error -->
    <div v-if="error" class="rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
      {{ error }}
    </div>

    <!-- Gantt Chart -->
    <div v-if="!loading && groupedRequests.size > 0" class="overflow-x-auto">
      <div class="min-w-[800px]">
        <!-- Timeline Header -->
        <div class="flex border-b border-slate-200 bg-slate-50">
          <div class="w-48 flex-shrink-0 px-4 py-2 text-xs font-medium text-slate-500">
            {{ groupBy === 'customer' ? '客戶' : '諮詢師' }}
          </div>
          <div class="flex-1 flex relative">
            <!-- Today line -->
            <div
              v-if="todayLinePosition !== null"
              class="absolute top-0 bottom-0 w-0.5 bg-red-500 z-10"
              :style="{ left: `${todayLinePosition}%` }"
            >
              <div class="absolute -top-2 -left-2 w-4 h-4 bg-red-500 rounded-full" />
            </div>
            <div
              v-for="day in timelineDays"
              :key="day.key"
              class="flex-1 border-l border-slate-200 px-2 py-2 text-center text-xs"
              :class="day.isToday ? 'bg-red-50 text-red-700 font-semibold' : 'text-slate-600'"
            >
              <div>{{ day.day }}</div>
              <div class="text-slate-400">
                {{ day.date }}
              </div>
            </div>
          </div>
        </div>

        <!-- Request Rows -->
        <div
          v-for="([groupKey, requests], idx) in Array.from(groupedRequests.entries())"
          :key="idx"
          class="flex border-b border-slate-100"
        >
          <div class="w-48 flex-shrink-0 px-4 py-3 text-sm text-slate-900">
            {{ getGroupName(groupKey) }}
          </div>
          <div class="flex-1 relative h-12">
            <!-- Request Bars -->
            <div
              v-for="req in requests"
              :key="req.id"
              class="absolute top-2 h-8 rounded border cursor-pointer hover:shadow-lg transition-all duration-200 group"
              :style="getRequestStyle(req)"
              @click="onRequestClick(req)"
            >
              <!-- Progress bar overlay -->
              <div
                v-if="getProgressPercentage(req) > 0"
                class="absolute inset-0 bg-white bg-opacity-30 rounded"
                :style="{ width: `${getProgressPercentage(req)}%` }"
              />

              <!-- Request content -->
              <div class="relative h-full px-2 py-1 text-xs font-medium text-white truncate flex items-center justify-between">
                <span>{{ req.name || '—' }}</span>
                <span v-if="getProgressPercentage(req) > 0" class="text-xs opacity-90">
                  {{ getProgressPercentage(req) }}%
                </span>
              </div>

              <!-- Enhanced tooltip -->
              <div class="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 px-3 py-2 bg-gray-900 text-white text-xs rounded-lg opacity-0 group-hover:opacity-100 transition-opacity duration-200 whitespace-nowrap z-10 pointer-events-none">
                <div class="font-semibold">
                  {{ req.name || '未命名' }}
                </div>
                <div>客戶：{{ req.bPartnerName || '未指定' }}</div>
                <div>諮詢師：{{ req.salesRepName || '未分配' }}</div>
                <div>期間：{{ formatDate(req.startDate) }} - {{ formatDate(req.closeDate) }}</div>
                <div>狀態：{{ req.requestStatusName || '未設定' }}</div>
                <div v-if="getProgressPercentage(req) > 0">
                  進度：{{ getProgressPercentage(req) }}%
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Legend -->
    <div v-if="!loading && groupedRequests.size > 0" class="flex items-center justify-between bg-slate-50 p-4 rounded-lg">
      <div class="flex items-center gap-6">
        <span class="text-sm font-medium text-slate-700">狀態圖例：</span>
        <div class="flex items-center gap-4">
          <div v-for="status in requestStatuses.slice(0, 4)" :key="status.id" class="flex items-center gap-2">
            <div
              class="w-3 h-3 rounded border"
              :style="{ backgroundColor: `${getStatusColor(status.name)}90`, borderColor: getStatusColor(status.name) }"
            />
            <span class="text-xs text-slate-600">{{ status.name }}</span>
          </div>
        </div>
      </div>

      <div class="flex items-center gap-4 text-sm text-slate-600">
        <span>總計：{{ totalRequests }} 個請求</span>
        <span>活躍：{{ activeRequests }} 個</span>
      </div>
    </div>

    <!-- Empty State -->
    <div v-if="!loading && groupedRequests.size === 0" class="rounded-lg border border-slate-200 bg-slate-50 p-8 text-center">
      <p class="text-sm text-slate-600">
        尚無諮詢記錄
      </p>
    </div>

    <!-- Loading -->
    <div v-if="loading" class="rounded-lg border border-slate-200 bg-slate-50 p-8 text-center">
      <div class="flex items-center justify-center space-x-2">
        <div class="animate-spin rounded-full h-4 w-4 border-b-2 border-brand-500" />
        <p class="text-sm text-slate-600">
          載入甘特圖中...
        </p>
      </div>
    </div>
  </div>
</template>
