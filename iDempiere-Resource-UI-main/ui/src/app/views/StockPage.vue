<script setup lang="ts">
import { onMounted, ref, computed } from 'vue'
import { useAuth } from '../../features/auth/store'
import { listProductStock, type ProductStock } from '../../features/stock/api'
import ErrorMessage from '../../components/ErrorMessage.vue'

const auth = useAuth()
const stocks = ref<ProductStock[]>([])
const loading = ref(false)
const error = ref<string | null>(null)
const searchQuery = ref('')

const fetchStocks = async () => {
  if (!auth.token.value) return
  loading.value = true
  error.value = null
  try {
    stocks.value = await listProductStock(auth.token.value)
  } catch (e: any) {
    error.value = e.message || '無法取得庫存資料'
  } finally {
    loading.value = false
  }
}

const filteredStocks = computed(() => {
  if (!searchQuery.value) return stocks.value
  return stocks.value.filter(s => 
    s.productName.toLowerCase().includes(searchQuery.value.toLowerCase()) ||
    s.productValue.toLowerCase().includes(searchQuery.value.toLowerCase())
  )
})

onMounted(() => fetchStocks())
</script>

<template>
  <div class="space-y-6">
    <div class="rounded-2xl border bg-white p-6 shadow-sm">
      <div class="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 class="text-lg font-bold">即時物資庫存</h1>
          <p class="text-xs text-slate-500">檢視當前已有的品項及其分庫數量</p>
        </div>
        <div class="flex items-center gap-3">
          <input 
            v-model="searchQuery" 
            type="text" 
            placeholder="搜尋商品名稱..." 
            class="rounded-lg border border-slate-200 px-4 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-blue-500 w-64"
          />
          <button 
            @click="fetchStocks" 
            :disabled="loading"
            class="rounded-lg bg-blue-600 px-4 py-2 text-xs text-white font-bold hover:bg-blue-700 transition-colors"
          >
            {{ loading ? '更新中...' : '重新整理' }}
          </button>
        </div>
      </div>
    </div>

    <ErrorMessage :message="error" />

    <div class="rounded-2xl border bg-white shadow-sm overflow-hidden">
      <table class="w-full text-sm text-left">
        <thead class="bg-slate-50 text-slate-500 uppercase text-[10px] font-black tracking-wider">
          <tr>
            <th class="px-6 py-4">商品名</th>
            <th class="px-6 py-4 text-center">分庫數量 (目前 / 最低)</th>
            <th class="px-6 py-4 text-center">日均消耗 (7日)</th>
            <th class="px-6 py-4 text-center">總計 / 總水位</th>
            <th class="px-6 py-4 text-center">狀態</th>
          </tr>
        </thead>
        <tbody class="divide-y divide-slate-100">
          <tr v-for="item in filteredStocks" :key="item.productId" class="hover:bg-slate-50 transition-colors" :class="{ 'bg-red-50/30': item.isBelowSafety }">
            <td class="px-6 py-4">
              <div class="font-bold text-slate-800">{{ item.productName }}</div>
              <div class="text-[10px] text-slate-400 font-mono">{{ item.productValue }}</div>
            </td>
            <td class="px-6 py-4">
              <div class="flex flex-wrap justify-center gap-2">
                <div v-for="wh in item.warehouseStocks" :key="wh.warehouseId" 
                  class="px-2 py-1 rounded text-[11px] font-bold border"
                  :class="wh.isBelowSafety ? 'bg-red-100 border-red-200 text-red-700' : 'bg-slate-100 border-slate-200 text-slate-600'"
                >
                  {{ wh.warehouseName }}: 
                  <span :class="wh.isBelowSafety ? 'text-red-600 font-black' : 'text-blue-600'">{{ wh.qtyOnHand }}</span> 
                  <span v-if="wh.safetyStock > 0" class="text-slate-400 font-normal ml-1">/ {{ wh.safetyStock }}</span>
                </div>
              </div>
            </td>
            <td class="px-6 py-4 text-center">
              <div v-if="item.avgConsumption7d > 0" class="flex flex-col items-center">
                <span class="font-bold text-slate-700">{{ item.avgConsumption7d.toFixed(1) }}</span>
                <span class="text-[9px] text-slate-400 uppercase tracking-tighter">單位/日</span>
              </div>
              <div v-else class="text-slate-300 italic text-xs">-</div>
            </td>
            <td class="px-6 py-4 text-center">
              <div class="flex flex-col items-center">
                <span class="text-lg font-black" :class="item.isBelowSafety ? 'text-red-600' : 'text-slate-800'">
                  {{ item.totalQty }}
                </span>
                <span v-if="item.totalSafetyStock > 0" class="text-[10px] text-slate-400 font-bold uppercase tracking-tighter">
                  水位: {{ item.totalSafetyStock }}
                </span>
              </div>
            </td>
            <td class="px-6 py-4 text-center">
              <span v-if="item.isBelowSafety" class="inline-flex items-center gap-1 text-red-600 font-bold animate-pulse">
                <span class="w-2 h-2 rounded-full bg-red-600"></span>
                庫存不足
              </span>
              <span v-else class="inline-flex items-center gap-1 text-emerald-600 font-bold">
                <span class="w-2 h-2 rounded-full bg-emerald-600"></span>
                供應充足
              </span>
            </td>
          </tr>
          <tr v-if="filteredStocks.length === 0 && !loading">
            <td colspan="4" class="px-6 py-12 text-center text-slate-400">
              <div class="text-3xl mb-2">📦</div>
              <div>目前無庫存資料</div>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  </div>
</template>
