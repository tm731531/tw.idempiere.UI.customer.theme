<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import QRCode from 'qrcode'
import { useAuth } from '../../features/auth/store'
import { getPurchasableProducts, getUOMName } from '../../features/qrpurchase/api'
import type { Product } from '../../features/qrpurchase/types'

const auth = useAuth()

// 狀態
const products = ref<(Product & { uomName: string; selected: boolean })[]>([])
const loading = ref(false)
const searchKeyword = ref('')
const error = ref('')

// 單張預覽
const previewProduct = ref<(Product & { uomName: string }) | null>(null)
const previewQRDataUrl = ref('')
const showPreview = ref(false)

// 批量列印
const showBatchPrint = ref(false)
const batchQRCodes = ref<{ product: Product & { uomName: string }; dataUrl: string }[]>([])

// 篩選後的產品
const filteredProducts = computed(() => {
  if (!searchKeyword.value.trim()) {
    return products.value
  }
  const kw = searchKeyword.value.toLowerCase()
  return products.value.filter(p =>
    p.name.toLowerCase().includes(kw) ||
    p.value.toLowerCase().includes(kw)
  )
})

// 已選數量
const selectedCount = computed(() => products.value.filter(p => p.selected).length)

// 載入產品
async function loadProducts() {
  loading.value = true
  error.value = ''
  try {
    const token = auth.token.value
    if (!token) {
      error.value = '請先登入'
      return
    }

    const list = await getPurchasableProducts(token)

    // 取得每個產品的 UOM 名稱
    const uomCache: Record<number, string> = {}
    for (const p of list) {
      if (!uomCache[p.uomId]) {
        uomCache[p.uomId] = await getUOMName(token, p.uomId)
      }
    }

    products.value = list.map(p => ({
      ...p,
      uomName: uomCache[p.uomId] || '單位',
      selected: false
    }))
  } catch (e: any) {
    error.value = e.message || '載入產品失敗'
  } finally {
    loading.value = false
  }
}

// 產生 QR Code 內容
function generateQRContent(productValue: string): string {
  return JSON.stringify({ product: productValue })
}

// 產生 QR Code DataURL
async function generateQRDataUrl(content: string): Promise<string> {
  return QRCode.toDataURL(content, {
    width: 200,
    margin: 2,
    errorCorrectionLevel: 'M'
  })
}

// 顯示單張預覽
async function showSinglePreview(product: Product & { uomName: string }) {
  const content = generateQRContent(product.value)
  previewQRDataUrl.value = await generateQRDataUrl(content)
  previewProduct.value = product
  showPreview.value = true
}

// 下載單張圖片
function downloadSingleImage() {
  if (!previewProduct.value || !previewQRDataUrl.value) return

  const link = document.createElement('a')
  link.download = `QR-${previewProduct.value.value}.png`
  link.href = previewQRDataUrl.value
  link.click()
}

// 全選/取消全選
function toggleSelectAll(selectAll: boolean) {
  filteredProducts.value.forEach(p => {
    p.selected = selectAll
  })
}

// 批量產生 PDF
async function generateBatchPDF() {
  const selectedProducts = products.value.filter(p => p.selected)
  if (selectedProducts.length === 0) {
    alert('請先勾選要產生的產品')
    return
  }

  loading.value = true
  try {
    // 產生所有 QR Code
    const codes: { product: Product & { uomName: string }; dataUrl: string }[] = []
    for (const p of selectedProducts) {
      const content = generateQRContent(p.value)
      const dataUrl = await generateQRDataUrl(content)
      codes.push({ product: p, dataUrl })
    }
    batchQRCodes.value = codes
    showBatchPrint.value = true
  } finally {
    loading.value = false
  }
}

// 列印
function printBatch() {
  window.print()
}

onMounted(() => {
  loadProducts()
})
</script>

<template>
  <div class="min-h-screen bg-slate-50 p-4">
    <!-- 標題 -->
    <div class="mb-4">
      <h1 class="text-xl font-bold text-slate-800">QR Code 產生器</h1>
      <p class="text-sm text-slate-500">為產品產生 QR Code，可批量列印</p>
    </div>

    <!-- 錯誤訊息 -->
    <div v-if="error" class="mb-4 p-3 bg-red-100 text-red-700 rounded-lg text-sm">
      {{ error }}
    </div>

    <!-- 搜尋與操作 -->
    <div class="mb-4 bg-white rounded-lg shadow p-4">
      <div class="flex gap-2 mb-3">
        <input
          v-model="searchKeyword"
          type="text"
          placeholder="搜尋品名或編碼..."
          class="flex-1 px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      </div>
      <div class="flex items-center justify-between">
        <div class="flex gap-2">
          <button
            @click="toggleSelectAll(true)"
            class="px-3 py-1 text-xs bg-slate-100 hover:bg-slate-200 rounded"
          >
            全選
          </button>
          <button
            @click="toggleSelectAll(false)"
            class="px-3 py-1 text-xs bg-slate-100 hover:bg-slate-200 rounded"
          >
            取消全選
          </button>
        </div>
        <span class="text-sm text-slate-600">已選: {{ selectedCount }} 項</span>
      </div>
    </div>

    <!-- 載入中 -->
    <div v-if="loading" class="flex justify-center py-8">
      <span class="loading loading-spinner loading-md"></span>
    </div>

    <!-- 產品列表 -->
    <div v-else class="bg-white rounded-lg shadow divide-y divide-slate-100 mb-4">
      <div
        v-for="product in filteredProducts"
        :key="product.id"
        class="flex items-center p-3 hover:bg-slate-50"
      >
        <input
          type="checkbox"
          v-model="product.selected"
          class="checkbox checkbox-sm checkbox-primary mr-3"
        />
        <div class="flex-1 min-w-0">
          <div class="flex items-center gap-2">
            <span class="font-mono text-xs text-slate-500">{{ product.value }}</span>
            <span class="font-medium text-slate-800 truncate">{{ product.name }}</span>
          </div>
          <div class="text-xs text-slate-400">單位: {{ product.uomName }}</div>
        </div>
        <button
          @click="showSinglePreview(product)"
          class="px-3 py-1 text-xs bg-blue-500 text-white rounded hover:bg-blue-600"
        >
          預覽
        </button>
      </div>
      <div v-if="filteredProducts.length === 0" class="p-8 text-center text-slate-400">
        沒有符合的產品
      </div>
    </div>

    <!-- 底部按鈕 -->
    <div class="flex gap-2">
      <button
        @click="generateBatchPDF"
        :disabled="selectedCount === 0"
        class="flex-1 py-3 bg-emerald-500 text-white font-bold rounded-lg hover:bg-emerald-600 disabled:opacity-50 disabled:cursor-not-allowed"
      >
        批量列印 PDF ({{ selectedCount }})
      </button>
    </div>

    <!-- 單張預覽 Modal -->
    <div
      v-if="showPreview"
      class="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
      @click.self="showPreview = false"
    >
      <div class="bg-white rounded-xl p-6 max-w-sm w-full">
        <div class="text-center">
          <img :src="previewQRDataUrl" alt="QR Code" class="mx-auto mb-4" />
          <div class="font-bold text-lg text-slate-800">{{ previewProduct?.name }}</div>
          <div class="font-mono text-sm text-slate-500">{{ previewProduct?.value }}</div>
          <div class="text-xs text-slate-400">單位: {{ previewProduct?.uomName }}</div>
        </div>
        <div class="flex gap-2 mt-6">
          <button
            @click="showPreview = false"
            class="flex-1 py-2 bg-slate-100 text-slate-700 rounded-lg hover:bg-slate-200"
          >
            關閉
          </button>
          <button
            @click="downloadSingleImage"
            class="flex-1 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600"
          >
            下載圖片
          </button>
        </div>
      </div>
    </div>

    <!-- 批量列印 Modal -->
    <div
      v-if="showBatchPrint"
      class="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
      @click.self="showBatchPrint = false"
    >
      <div class="bg-white rounded-xl p-4 max-w-4xl w-full max-h-[90vh] overflow-auto">
        <div class="flex justify-between items-center mb-4 no-print">
          <h2 class="font-bold text-lg">列印預覽</h2>
          <div class="flex gap-2">
            <button
              @click="printBatch"
              class="px-4 py-2 bg-emerald-500 text-white rounded-lg hover:bg-emerald-600"
            >
              列印
            </button>
            <button
              @click="showBatchPrint = false"
              class="px-4 py-2 bg-slate-100 text-slate-700 rounded-lg hover:bg-slate-200"
            >
              關閉
            </button>
          </div>
        </div>

        <!-- 列印內容 -->
        <div class="print-area grid grid-cols-3 gap-4">
          <div
            v-for="item in batchQRCodes"
            :key="item.product.id"
            class="border border-slate-200 rounded-lg p-3 text-center"
          >
            <img :src="item.dataUrl" alt="QR Code" class="mx-auto w-32 h-32" />
            <div class="font-bold text-sm mt-2">{{ item.product.name }}</div>
            <div class="font-mono text-xs text-slate-500">{{ item.product.value }}</div>
            <div class="text-xs text-slate-400">{{ item.product.uomName }}</div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style>
@media print {
  .no-print {
    display: none !important;
  }
  .print-area {
    display: grid !important;
    grid-template-columns: repeat(3, 1fr) !important;
    gap: 1rem !important;
  }
}
</style>
