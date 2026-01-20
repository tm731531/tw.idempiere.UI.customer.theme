<script setup lang="ts">
import type { Request } from '../../features/request/api'
import { onMounted, ref } from 'vue'
import ErrorMessage from '../../components/ErrorMessage.vue'
import StatusBadge from '../../components/StatusBadge.vue'
import { useAuth } from '../../features/auth/store'
import {
  getRequestsByCustomer,

} from '../../features/request/api'
import { formatDate } from '../../shared/utils/format'

const auth = useAuth()

const customers = ref<{ id: number, name: string }[]>([])
const selectedBPartnerId = ref<number | undefined>()
const requests = ref<Request[]>([])
const loading = ref(false)
const error = ref<string | null>(null)

async function loadCustomers() {
  if (!auth.token.value)
    return

  try {
    const res = await fetch('/api/v1/models/C_BPartner?$select=C_BPartner_ID,Name&$filter=IsCustomer eq true&$orderby=Name', {
      headers: {
        Authorization: `Bearer ${auth.token.value}`,
      },
    })

    if (!res.ok)
      throw new Error('Failed to load customers')

    const data = await res.json()
    customers.value = (data.records || []).map((r: any) => ({
      id: Number(r.id),
      name: String(r.Name || ''),
    }))
  }
  catch (e: any) {
    console.error('Failed to load customers:', e)
  }
}

async function loadCustomerRequests() {
  if (!auth.token.value || !selectedBPartnerId.value)
    return

  loading.value = true
  error.value = null

  try {
    requests.value = await getRequestsByCustomer(auth.token.value, selectedBPartnerId.value)
  }
  catch (e: any) {
    error.value = e?.detail || e?.title || e?.message || '載入失敗'
  }
  finally {
    loading.value = false
  }
}

onMounted(loadCustomers)
</script>

<template>
  <div class="space-y-4">
    <h2 class="text-base font-semibold text-slate-900">
      客戶維度查詢
    </h2>

    <!-- Customer Selection -->
    <div>
      <label class="text-sm font-medium text-slate-700">選擇客戶</label>
      <select
        v-model="selectedBPartnerId"
        class="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm focus:border-brand-500 focus:ring-1 focus:ring-brand-500"
        @change="loadCustomerRequests"
      >
        <option :value="undefined">
          請選擇客戶
        </option>
        <option v-for="customer in customers" :key="customer.id" :value="customer.id">
          {{ customer.name }}
        </option>
      </select>
    </div>

    <ErrorMessage :message="error" />

    <!-- Customer Requests -->
    <div v-if="selectedBPartnerId && !loading && requests.length > 0" class="space-y-2">
      <h3 class="text-sm font-medium text-slate-700">
        諮詢歷史記錄（{{ requests.length }} 筆）
      </h3>

      <div class="overflow-x-auto border border-slate-200 rounded-lg">
        <table class="w-full text-sm">
          <thead class="bg-slate-50 text-left text-xs font-medium uppercase text-slate-500">
            <tr>
              <th class="px-4 py-3">
                諮詢單
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
                建立日期
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
            <tr
              v-for="req in requests"
              :key="req.id"
              class="hover:bg-slate-50"
            >
              <td class="px-4 py-3 font-medium text-slate-900">
                {{ req.name || '—' }}
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
                <StatusBadge :status="req.requestStatusName" type="request" />
              </td>
              <td class="px-4 py-3 text-slate-600">
                {{ formatDate(req.created) }}
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

    <!-- Empty State -->
    <div v-if="selectedBPartnerId && !loading && requests.length === 0" class="rounded-lg border border-slate-200 bg-slate-50 p-8 text-center">
      <p class="text-sm text-slate-600">
        此客戶尚無諮詢記錄
      </p>
    </div>

    <!-- Loading -->
    <div v-if="loading" class="rounded-lg border border-slate-200 bg-slate-50 p-8 text-center">
      <p class="text-sm text-slate-600">
        載入中...
      </p>
    </div>
  </div>
</template>
