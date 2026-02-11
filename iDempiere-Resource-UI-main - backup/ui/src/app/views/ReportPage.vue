<script setup lang="ts">
import { onMounted, ref } from 'vue'
import ErrorMessage from '../../components/ErrorMessage.vue'
import { useAuth } from '../../features/auth/store'
import { apiFetch } from '../../shared/api/http'
import { formatMoney } from '../../shared/utils/format'

const auth = useAuth()

const loading = ref(true)
const error = ref('')
const customerCount = ref(0)
const todayPayment = ref(0)
const inventoryCount = ref(0)

async function loadStats() {
  if (!auth.token.value)
    return

  loading.value = true
  error.value = ''

  try {
    // Load customer count
    const bpRes = await apiFetch<{ 'row-count': number }>('/api/v1/models/C_BPartner', {
      token: auth.token.value,
      searchParams: {
        $select: 'C_BPartner_ID',
        $filter: 'IsCustomer eq true',
        $top: 1,
      },
    })
    customerCount.value = bpRes['row-count'] ?? 0

    // Load today's payment total
    const today = new Date().toISOString().split('T')[0]
    const payRes = await apiFetch<{ records: any[] }>('/api/v1/models/C_Payment', {
      token: auth.token.value,
      searchParams: {
        $select: 'PayAmt',
        $filter: `IsReceipt eq true and DateTrx ge '${today}'`,
      },
    })
    todayPayment.value = (payRes.records ?? []).reduce((sum, r) => sum + Number(r.PayAmt ?? 0), 0)

    // Load inventory item count
    const invRes = await apiFetch<{ 'row-count': number }>('/api/v1/models/M_Product', {
      token: auth.token.value,
      searchParams: {
        $select: 'M_Product_ID',
        $filter: 'IsActive eq true',
        $top: 1,
      },
    })
    inventoryCount.value = invRes['row-count'] ?? 0
  }
  catch (e: any) {
    error.value = e?.detail || e?.message || '載入統計資料失敗'
  }
  finally {
    loading.value = false
  }
}

onMounted(() => {
  loadStats()
})
</script>

<template>
  <div class="space-y-6">
    <div class="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
      <div class="flex items-center justify-between">
        <div>
          <h1 class="text-lg font-semibold">
            報表
          </h1>
          <p class="mt-1 text-sm text-slate-600">
            系統統計與報表
          </p>
        </div>
      </div>
    </div>

    <ErrorMessage :message="error" />

    <div class="grid gap-6 md:grid-cols-3">
      <div class="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <div class="text-sm font-medium text-slate-500">
          總客戶數
        </div>
        <div class="mt-2 text-3xl font-bold text-slate-900">
          <span v-if="loading">...</span>
          <span v-else>{{ customerCount }}</span>
        </div>
      </div>

      <div class="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <div class="text-sm font-medium text-slate-500">
          今日收款
        </div>
        <div class="mt-2 text-3xl font-bold text-emerald-600">
          <span v-if="loading">...</span>
          <span v-else>${{ formatMoney(todayPayment) }}</span>
        </div>
      </div>

      <div class="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <div class="text-sm font-medium text-slate-500">
          庫存品項數
        </div>
        <div class="mt-2 text-3xl font-bold text-slate-900">
          <span v-if="loading">...</span>
          <span v-else>{{ inventoryCount }}</span>
        </div>
      </div>
    </div>

    <div class="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
      <h2 class="text-base font-semibold mb-4">
        報表功能
      </h2>
      <p class="text-sm text-slate-600">
        詳細報表功能開發中...
      </p>
    </div>
  </div>
</template>
