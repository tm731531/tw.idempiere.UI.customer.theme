<script setup lang="ts">
import { onMounted, ref, computed } from 'vue'
import { useAuth } from '../../features/auth/store'
import { listProductStock, type ProductStock } from '../../features/stock/api'
import { parseQRCode } from '../../features/qrpurchase/api'
import { Html5Qrcode, Html5QrcodeSupportedFormats } from 'html5-qrcode'
import ErrorMessage from '../../components/ErrorMessage.vue'
import { nextTick, onUnmounted } from 'vue'

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
  let result = stocks.value
  if (searchQuery.value) {
    result = result.filter(s => 
      s.productName.toLowerCase().includes(searchQuery.value.toLowerCase()) ||
      s.productValue.toLowerCase().includes(searchQuery.value.toLowerCase()) ||
      (s.upc && s.upc.toLowerCase().includes(searchQuery.value.toLowerCase()))
    )
  }
  // Sort: prioritize expired > expiring soon > below safety > others
  return [...result].sort((a, b) => {
    // 1. Expired first
    if (a.isExpired && !b.isExpired) return -1
    if (!a.isExpired && b.isExpired) return 1
    // 2. Expiring soon second
    if (a.isExpiringSoon && !b.isExpiringSoon) return -1
    if (!a.isExpiringSoon && b.isExpiringSoon) return 1
    // 3. Below safety third
    if (a.isBelowSafety && !b.isBelowSafety) return -1
    if (!a.isBelowSafety && b.isBelowSafety) return 1
    return 0
  })
})

// 掃描功能
const scanning = ref(false)
const scannerReady = ref(false)
let html5QrCode: Html5Qrcode | null = null

async function startScanner() {
  scanning.value = true
  await nextTick()

  try {
    html5QrCode = new Html5Qrcode('qr-reader', {
      formatsToSupport: [
        Html5QrcodeSupportedFormats.QR_CODE,
        Html5QrcodeSupportedFormats.EAN_13,
        Html5QrcodeSupportedFormats.EAN_8,
        Html5QrcodeSupportedFormats.CODE_128,
        Html5QrcodeSupportedFormats.CODE_39,
        Html5QrcodeSupportedFormats.UPC_A,
        Html5QrcodeSupportedFormats.UPC_E,
        Html5QrcodeSupportedFormats.UPC_EAN_EXTENSION
      ],
      verbose: false
    })
    await html5QrCode.start(
      { facingMode: 'environment' },
      {
        fps: 10,
        qrbox: (viewfinderWidth: number, viewfinderHeight: number) => {
          const minEdge = Math.min(viewfinderWidth, viewfinderHeight)
          return { width: Math.floor(minEdge * 0.8), height: Math.floor(minEdge * 0.6) }
        },
        aspectRatio: 1.0
      },
      onScanSuccess,
      () => {}
    )
    scannerReady.value = true
  } catch (e) {
    console.error('Scanner start error', e)
    scanning.value = false
  }
}

async function stopScanner() {
  if (html5QrCode) {
    try { await html5QrCode.stop() } catch {}
    html5QrCode = null
  }
  scanning.value = false
  scannerReady.value = false
}

function onScanSuccess(decodedText: string) {
  stopScanner()
  const parsed = parseQRCode(decodedText)
  if (parsed) {
    searchQuery.value = parsed.product
  }
}

onUnmounted(() => stopScanner())

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
          <div class="relative w-64">
            <input 
              v-model="searchQuery" 
              type="text" 
              placeholder="搜尋名稱、編碼或條碼..." 
              class="w-full rounded-lg border border-slate-200 pl-4 pr-10 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <button 
              @click="startScanner" 
              class="absolute inset-y-0 right-0 px-3 text-slate-400 hover:text-blue-500"
            >
              📷
            </button>
          </div>
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

    <div v-show="scanning" class="rounded-2xl border bg-black overflow-hidden relative mb-6">
      <div id="qr-reader" class="w-full"></div>
      <button 
        @click="stopScanner" 
        class="absolute bottom-4 right-4 bg-white/20 backdrop-blur-md text-white px-4 py-2 rounded-lg text-xs"
      >
        關閉掃描
      </button>
    </div>

    <ErrorMessage :message="error" />

    <div class="rounded-2xl border bg-white shadow-sm overflow-hidden">
      <table class="w-full text-sm text-left">
        <thead class="bg-slate-50 text-slate-500 uppercase text-[10px] font-black tracking-wider">
          <tr>
            <th class="px-6 py-4">商品名</th>
            <th class="px-6 py-4 text-center">分庫數量 (目前 / 最低)</th>
            <th class="px-6 py-4 text-center">最近效期</th>
            <th class="px-6 py-4 text-center">日均消耗 (7日)</th>
            <th class="px-6 py-4 text-center">總計 / 總水位</th>
            <th class="px-6 py-4 text-center">狀態</th>
          </tr>
        </thead>
        <tbody class="divide-y divide-slate-100">
          <tr v-for="item in filteredStocks" :key="item.productId" class="hover:bg-slate-50 transition-colors" :class="{ 'bg-red-50/30': item.isBelowSafety || item.isExpired, 'bg-orange-50/30': item.isExpiringSoon && !item.isExpired }">
            <td class="px-6 py-4">
              <div class="font-bold text-slate-800">{{ item.productName }}</div>
              <div class="flex items-center gap-2">
                <span class="text-[10px] text-slate-400 font-mono">{{ item.productValue }}</span>
                <span v-if="item.upc" class="text-[10px] bg-slate-100 px-1.5 py-0.25 rounded text-slate-500 font-mono">EAN: {{ item.upc }}</span>
              </div>
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
              <div v-if="item.nearestExpiryDate" class="flex flex-col items-center">
                <span class="font-bold" :class="{
                  'text-red-600 animate-pulse': item.isExpired,
                  'text-orange-600': item.isExpiringSoon && !item.isExpired,
                  'text-slate-700': !item.isExpired && !item.isExpiringSoon
                }">{{ item.nearestExpiryDate }}</span>
                <span v-if="item.isExpired" class="text-[9px] text-red-500 font-bold uppercase">已過期</span>
                <span v-else-if="item.isExpiringSoon" class="text-[9px] text-orange-500 font-bold uppercase">即將過期</span>
              </div>
              <div v-else class="text-slate-300 italic text-xs">-</div>
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
