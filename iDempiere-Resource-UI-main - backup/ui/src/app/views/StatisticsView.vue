<script setup lang="ts">
import type { RequestStatus, RequestType } from '../../features/request/api'
import { onMounted, ref } from 'vue'
import ErrorMessage from '../../components/ErrorMessage.vue'
import { useAuth } from '../../features/auth/store'
import {
  getRequestStatistics,
  listRequestStatuses,
  listRequestTypes,

} from '../../features/request/api'

const auth = useAuth()

const statistics = ref<Map<number, { total: number, byType: Map<number, number>, byStatus: Map<number, number> }>>(new Map())
const requestTypes = ref<RequestType[]>([])
const requestStatuses = ref<RequestStatus[]>([])
const salesReps = ref<Map<number, string>>(new Map())
const loading = ref(false)
const error = ref<string | null>(null)

function getSalesRepName(salesRepId: number): string {
  if (salesRepId === 0)
    return '未指派'
  return salesReps.value.get(salesRepId) || `SalesRep #${salesRepId}`
}

function getRequestTypeName(typeId: number): string {
  const type = requestTypes.value.find(t => t.id === typeId)
  return type?.name || `Type #${typeId}`
}

function getRequestStatusName(statusId: number): string {
  const status = requestStatuses.value.find(s => s.id === statusId)
  return status?.name || `Status #${statusId}`
}

function getStatusColorClass(statusId: number): string {
  const statusName = getRequestStatusName(statusId)
  const map: Record<string, string> = {
    開啟: 'bg-emerald-100 text-emerald-700',
    進行中: 'bg-blue-100 text-blue-700',
    已關閉: 'bg-slate-100 text-slate-700',
    待處理: 'bg-amber-100 text-amber-700',
  }
  return map[statusName] || 'bg-slate-100 text-slate-700'
}

async function loadData() {
  if (!auth.token.value)
    return

  loading.value = true
  error.value = null

  try {
    const stats = await getRequestStatistics(auth.token.value)

    // Ensure all stat objects have the required properties
    const validatedStats = new Map()
    for (const [salesRepId, stat] of stats.entries()) {
      validatedStats.set(salesRepId, {
        total: stat.total || 0,
        byType: stat.byType || new Map(),
        byStatus: stat.byStatus || new Map(),
      })
    }

    statistics.value = validatedStats

    // Load sales rep names
    const salesRepIds = Array.from(statistics.value.keys()).filter(id => id > 0)
    if (salesRepIds.length > 0) {
      const filter = salesRepIds.map(id => `AD_User_ID eq ${id}`).join(' or ')
      const res = await fetch(`/api/v1/models/AD_User?$select=AD_User_ID,Name&$filter=${filter}`, {
        headers: {
          Authorization: `Bearer ${auth.token.value}`,
        },
      })

      if (res.ok) {
        const data = await res.json()
        salesReps.value = new Map(
          (data.records || []).map((r: any) => [Number(r.id), String(r.Name || '')]),
        )
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
    <div class="flex items-center justify-between">
      <h2 class="text-base font-semibold text-slate-900">
        員工諮詢統計
      </h2>
      <button
        class="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
        :disabled="loading"
        @click="loadData"
      >
        {{ loading ? '載入中…' : '重新整理' }}
      </button>
    </div>

    <ErrorMessage :message="error" />

    <!-- Statistics Grid -->
    <div class="grid grid-cols-1 gap-4 lg:grid-cols-2">
      <template v-for="[salesRepId, stat] in Array.from(statistics.entries())" :key="salesRepId">
        <div
          v-if="stat && stat.byType && stat.byStatus"
          class="rounded-lg border border-slate-200 bg-white p-4 shadow-sm"
        >
          <div class="flex items-center justify-between">
            <h3 class="font-medium text-slate-900">
              {{ getSalesRepName(salesRepId) }}
            </h3>
            <span class="text-2xl font-bold text-brand-600">{{ stat.total }}</span>
          </div>
          <div class="mt-4 space-y-2">
            <!-- By Type -->
            <div v-if="stat.byType && stat.byType.size > 0">
              <h4 class="text-xs font-medium text-slate-600">
                依類型
              </h4>
              <div class="mt-1 flex flex-wrap gap-1">
                <span
                  v-for="([typeId, count], idx) in Array.from(stat.byType.entries())"
                  :key="idx"
                  class="inline-flex rounded-full bg-blue-100 px-2 py-0.5 text-xs font-medium text-blue-700"
                >
                  {{ getRequestTypeName(typeId) }}: {{ count }}
                </span>
              </div>
            </div>

            <!-- By Status -->
            <div v-if="stat.byStatus && stat.byStatus.size > 0">
              <h4 class="text-xs font-medium text-slate-600">
                依狀態
              </h4>
              <div class="mt-1 flex flex-wrap gap-1">
                <span
                  v-for="([statusId, count], idx) in Array.from(stat.byStatus.entries())"
                  :key="idx"
                  class="inline-flex rounded-full px-2 py-0.5 text-xs font-medium"
                  :class="getStatusColorClass(statusId)"
                >
                  {{ getRequestStatusName(statusId) }}: {{ count }}
                </span>
              </div>
            </div>
          </div>
        </div>
      </template>
    </div>

    <!-- Empty State -->
    <div v-if="!loading && (!statistics || statistics.size === 0)" class="rounded-lg border border-slate-200 bg-slate-50 p-8 text-center">
      <p class="text-sm text-slate-600">
        尚無諮詢統計資料
      </p>
    </div>
  </div>
</template>
