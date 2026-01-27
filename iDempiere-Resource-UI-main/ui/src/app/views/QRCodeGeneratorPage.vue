<script setup lang="ts">
import { ref, computed, onMounted, nextTick } from 'vue'
// @ts-ignore
import QRCode from 'qrcode'
import { useAuth } from '../../features/auth/store'
import { getPurchasableProducts, getUOMName, getUOMs, getProductCategories, updateProduct, getProductPriceHistory } from '../../features/qrpurchase/api'
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

// 編輯 Modal
const showEditModal = ref(false)
const editingProduct = ref<any>(null)
const uoms = ref<{ id: number; name: string }[]>([])
const categories = ref<{ id: number; name: string }[]>([])
const priceHistory = ref<{ vendorName: string; price: number; date?: string }[]>([])
const savingProduct = ref(false)

// 篩選後的產品
const filteredProducts = computed(() => {
  if (!searchKeyword.value.trim()) {
    return products.value
  }
  const kw = searchKeyword.value.toLowerCase()
  return products.value.filter(p =>
    p.name.toLowerCase().includes(kw) ||
    p.value.toLowerCase().includes(kw) ||
    (p.upc && p.upc.toLowerCase().includes(kw))
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

// 顯示編輯 Modal
async function openEditModal(product: Product & { uomName: string }) {
  editingProduct.value = { ...product }
  showEditModal.value = true
  
  // 異步載入後設資料與歷史價格
  const token = auth.token.value
  if (!token) return

  // 平行載入
  Promise.all([
    getUOMs(token).then(res => {
      console.log('[QR] 載入單位列表:', res)
      uoms.value = res
    }),
    getProductCategories(token).then(res => {
      console.log('[QR] 載入分類列表:', res)
      categories.value = res
    }),
    getProductPriceHistory(token, product.id).then(res => {
      console.log('[QR] 載入價格歷史:', res)
      priceHistory.value = res
    })
  ])
}

// 儲存編輯
async function handleUpdateProduct() {
  if (!editingProduct.value) return
  savingProduct.value = true
  try {
    const token = auth.token.value
    if (!token) return
    
    await updateProduct(token, editingProduct.value.id, {
      name: editingProduct.value.name,
      uomId: editingProduct.value.uomId,
      categoryId: editingProduct.value.categoryId,
      upc: editingProduct.value.upc
    })
    
    // 更新本地清單
    const target = products.value.find(p => p.id === editingProduct.value.id)
    if (target) {
      target.name = editingProduct.value.name
      target.upc = editingProduct.value.upc
      target.uomId = editingProduct.value.uomId
      target.uomName = uoms.value.find(u => u.id === editingProduct.value.uomId)?.name || target.uomName
    }
    
    showEditModal.value = false
  } catch (e: any) {
    alert(e.message || '更新失敗')
  } finally {
    savingProduct.value = false
  }
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
      <h1 class="text-xl font-bold text-slate-800">📦 商品管理中心</h1>
      <p class="text-sm text-slate-500">管理商品資訊、條碼與查看歷史廠商價格</p>
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
          placeholder="搜尋品名、編碼或條碼..." 
          class="flex-1 px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 shadow-sm"
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
            <span class="font-medium text-slate-800 truncate">{{ product.name }}</span>
            <span v-if="product.upc" class="text-[10px] bg-emerald-50 text-emerald-600 px-1.5 py-0.5 rounded-md font-mono border border-emerald-100">UPC: {{ product.upc }}</span>
          </div>
          <div class="flex items-center gap-3 text-xs text-slate-400 mt-0.5">
            <span>編碼: <span class="font-mono">{{ product.value }}</span></span>
            <span>單位: {{ product.uomName }}</span>
          </div>
        </div>
        <div class="flex gap-2">
          <button
            @click="openEditModal(product)"
            class="px-3 py-1.5 text-xs bg-slate-100 text-slate-600 rounded-lg hover:bg-slate-200 transition-colors"
          >
            編輯
          </button>
          <button
            @click="showSinglePreview(product)"
            class="px-3 py-1.5 text-xs bg-blue-500 text-white rounded-lg hover:bg-blue-600 shadow-sm transition-colors"
          >
            掃描碼
          </button>
        </div>
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

    <!-- 編輯商品 Modal -->
    <div
      v-if="showEditModal"
      class="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4"
      @click.self="showEditModal = false"
    >
      <div class="bg-white rounded-2xl p-6 max-w-lg w-full shadow-2xl overflow-y-auto max-h-[90vh]">
        <div class="flex justify-between items-center mb-6">
          <h2 class="text-xl font-black text-slate-800">編輯商品資訊</h2>
          <button @click="showEditModal = false" class="text-slate-400 hover:text-slate-600 text-2xl">&times;</button>
        </div>

        <div v-if="editingProduct" class="space-y-4">
          <!-- 基本資料 -->
          <div class="grid grid-cols-2 gap-4">
            <div class="col-span-2">
              <label class="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">商品名稱</label>
              <input v-model="editingProduct.name" type="text" class="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 focus:ring-2 focus:ring-blue-500 outline-none" />
            </div>
            <div>
              <label class="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">物品編碼 (不可改)</label>
              <input :value="editingProduct.value" disabled type="text" class="w-full bg-slate-100 border border-slate-200 rounded-xl px-4 py-3 text-slate-400 font-mono" />
            </div>
            <div>
              <label class="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">國際條碼 (UPC/EAN)</label>
              <input v-model="editingProduct.upc" type="text" class="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 focus:ring-2 focus:ring-blue-500 outline-none font-mono" placeholder="掃描或輸入條碼" />
            </div>
            <div>
              <label class="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">單位</label>
              <select v-model="editingProduct.uomId" class="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-3 focus:ring-2 focus:ring-blue-500 outline-none">
                <option v-for="u in uoms" :key="u.id" :value="u.id">{{ u.name }}</option>
              </select>
            </div>
            <div>
              <label class="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">分類</label>
              <select v-model="editingProduct.categoryId" class="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-3 focus:ring-2 focus:ring-blue-500 outline-none">
                <option v-for="c in categories" :key="c.id" :value="c.id">{{ c.name }}</option>
              </select>
            </div>
          </div>

          <!-- 各家廠商價格 (使用者回憶功能) -->
          <div class="mt-8">
            <label class="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3 flex items-center gap-2">
              <span>💡 各家廠商成交價 (回憶)</span>
              <span class="h-[1px] flex-1 bg-slate-100"></span>
            </label>
            <div v-if="priceHistory.length > 0" class="bg-slate-50 rounded-xl overflow-hidden border border-slate-100">
              <table class="w-full text-xs text-left">
                <thead class="bg-slate-100 text-slate-500 font-bold">
                  <tr>
                    <th class="px-4 py-2">廠商名稱</th>
                    <th class="px-4 py-2 text-right">上次成交價</th>
                  </tr>
                </thead>
                <tbody class="divide-y divide-slate-100">
                  <tr v-for="h in priceHistory" :key="h.vendorName + h.date" class="hover:bg-white transition-colors">
                    <td class="px-4 py-3 font-medium text-slate-700">
                      <div>{{ h.vendorName }}</div>
                      <div v-if="h.date" class="text-[9px] text-slate-400 font-normal mt-0.5">{{ h.date }}</div>
                    </td>
                    <td class="px-4 py-3 text-right font-black text-blue-600">${{ h.price }}</td>
                  </tr>
                </tbody>
              </table>
            </div>
            <div v-else class="text-center py-6 bg-slate-50 rounded-xl border border-dashed border-slate-200 text-slate-400 text-xs text-center">
              尚無該商品的歷史採購紀錄
            </div>
          </div>
        </div>

        <div class="flex gap-3 mt-8">
          <button
            @click="showEditModal = false"
            class="flex-1 py-3 text-slate-500 font-bold hover:bg-slate-100 rounded-xl transition-colors"
          >
            取消
          </button>
          <button
            @click="handleUpdateProduct"
            :disabled="savingProduct"
            class="flex-1 py-3 bg-slate-900 text-white font-bold rounded-xl shadow-lg hover:bg-black transition-transform active:scale-95 disabled:opacity-50"
          >
            {{ savingProduct ? '儲存中...' : '確認修改' }}
          </button>
        </div>
      </div>
    </div>

    <!-- 單張預覽 Modal (QR Code) -->
    <div
      v-if="showPreview"
      class="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4"
      @click.self="showPreview = false"
    >
      <div class="bg-white rounded-2xl p-8 max-w-sm w-full shadow-2xl text-center">
        <img :src="previewQRDataUrl" alt="QR Code" class="mx-auto mb-6 w-48 h-48" />
        <div class="font-black text-xl text-slate-800 mb-1">{{ previewProduct?.name }}</div>
        <div class="font-mono text-sm text-slate-400 mb-6">{{ previewProduct?.value }}</div>
        
        <div class="flex gap-3">
          <button
            @click="showPreview = false"
            class="flex-1 py-3 bg-slate-100 text-slate-600 font-bold rounded-xl hover:bg-slate-200 transition-colors"
          >
            關閉
          </button>
          <button
            @click="downloadSingleImage"
            class="flex-1 py-3 bg-blue-600 text-white font-bold rounded-xl shadow-lg hover:bg-blue-700 transition-transform active:scale-95"
          >
            下載
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
