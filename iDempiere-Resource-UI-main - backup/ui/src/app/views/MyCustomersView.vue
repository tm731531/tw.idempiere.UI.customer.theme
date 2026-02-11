<script setup lang="ts">
import type { Request } from '../../features/request/api'
import { onMounted, ref } from 'vue'
import ErrorMessage from '../../components/ErrorMessage.vue'
import StatusBadge from '../../components/StatusBadge.vue'
import { useAuth } from '../../features/auth/store'
import {
  getMyCustomersRequests,

} from '../../features/request/api'
import { formatDate } from '../../shared/utils/format'

const auth = useAuth()

const requests = ref<Request[]>([])
const loading = ref(false)
const error = ref<string | null>(null)

async function loadData() {
  if (!auth.token.value || !auth.userId.value)
    return

  loading.value = true
  error.value = null

  try {
    requests.value = await getMyCustomersRequests(auth.token.value, auth.userId.value)
  }
  catch (e: any) {
    error.value = e?.detail || e?.title || e?.message || '載入失敗'
  }
  finally {
    loading.value = false
  }
}

onMounted(loadData)
</script>

<template>
  <div class="space-y-4">
    <div class="flex items-center justify-between">
      <h2 class="text-base font-semibold text-slate-900">
        我的客戶
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
              Type
            </th>
            <th class="px-4 py-3">
              Status
            </th>
            <th class="px-4 py-3">
              開始日期
            </th>
            <th class="px-4 py-3">
              結束日期
            </th>
          </tr>
        </thead>
        <tbody class="divide-y divide-slate-200">
          <tr v-if="loading">
            <td colspan="6" class="px-4 py-8 text-center text-slate-500">
              載入中...
            </td>
          </tr>
          <tr v-else-if="requests.length === 0">
            <td colspan="6" class="px-4 py-8 text-center text-slate-500">
              尚未接應任何客戶
            </td>
          </tr>
          <tr
            v-for="req in requests"
            :key="req.id"
            class="hover:bg-slate-50 cursor-pointer"
          >
            <td class="px-4 py-3 font-medium text-slate-900">
              {{ req.name || '—' }}
            </td>
            <td class="px-4 py-3 text-slate-600">
              {{ req.bPartnerName || '—' }}
            </td>
            <td class="px-4 py-3">
              <span class="inline-flex rounded-full bg-blue-100 px-2 py-0.5 text-xs font-medium text-blue-700">
                {{ req.requestTypeName || '—' }}
              </span>
            </td>
            <td class="px-4 py-3">
              <StatusBadge :status="req.requestStatusName" type="request" />
            </td>
            <td class="px-4 py-3 text-slate-600">
              {{ formatDate(req.startDate) }}
            </td>
            <td class="px-4 py-3 text-slate-600">
              {{ formatDate(req.closeDate) }}
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  </div>
</template>
