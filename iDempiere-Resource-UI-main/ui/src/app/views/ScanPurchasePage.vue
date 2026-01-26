<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted, watch, nextTick } from 'vue'
import { Html5Qrcode } from 'html5-qrcode'
import { useAuth } from '../../features/auth/store'
import {
  getVendors,
  createVendor,
  getWarehouses,
  getProductByValue,
  getUOMName,
  createPurchaseOrder,
  parseQRCode
} from '../../features/qrpurchase/api'
import type { Vendor, Warehouse, PurchaseItem, CreateOrderResult } from '../../features/qrpurchase/types'

const auth = useAuth()

// 基本狀態
const loading = ref(false)
const error = ref('')
const successMessage = ref('')

// 供應商
const vendors = ref<Vendor[]>([])
const selectedVendorId = ref<number | null>(null)
const showAddVendor = ref(false)
const newVendorName = ref('')
const addingVendor = ref(false)

// 倉庫
const warehouses = ref<Warehouse[]>([])
const selectedWarehouseId = ref<number | null>(null)

// 掃描
const scanning = ref(false)
const scannerReady = ref(false)
const cameraError = ref('')
let html5QrCode: Html5Qrcode | null = null

// 手動輸入
const manualProductCode = ref('')

// 掃描後彈窗
const showAddItemModal = ref(false)
const scannedProduct = ref<{ id: number; value: string; name: string; uomName: string } | null>(null)
const itemQty = ref(1)
const itemPrice = ref(1)

// 採購清單
const purchaseItems = ref<PurchaseItem[]>([])

// 成功結果
const showSuccessModal = ref(false)
const orderResult = ref<CreateOrderResult | null>(null)

// 計算
const totalQty = computed(() => purchaseItems.value.reduce((sum, i) => sum + i.qty, 0))
const totalAmount = computed(() => purchaseItems.value.reduce((sum, i) => sum + i.qty * i.price, 0))
const canSubmit = computed(() =>
  selectedVendorId.value !== null &&
  selectedWarehouseId.value !== null &&
  purchaseItems.value.length > 0
)

// 取得 token (確保非 null)
function getToken(): string {
  const token = auth.token.value
  if (!token) throw new Error('請先登入')
  return token
}

// 載入初始資料
async function loadInitialData() {
  loading.value = true
  try {
    const token = getToken()
    const [vendorList, warehouseList] = await Promise.all([
      getVendors(token),
      getWarehouses(token)
    ])
    vendors.value = vendorList
    warehouses.value = warehouseList

    // 預設選第一個倉庫
    if (warehouseList.length > 0) {
      selectedWarehouseId.value = warehouseList[0].id
    }
  } catch (e: any) {
    error.value = e.message || '載入資料失敗'
  } finally {
    loading.value = false
  }
}

// 新增供應商
async function handleAddVendor() {
  if (!newVendorName.value.trim()) {
    alert('請輸入供應商名稱')
    return
  }

  addingVendor.value = true
  try {
    const vendor = await createVendor(getToken(), { name: newVendorName.value.trim() })
    vendors.value.push(vendor)
    selectedVendorId.value = vendor.id
    showAddVendor.value = false
    newVendorName.value = ''
  } catch (e: any) {
    alert(e.message || '新增供應商失敗')
  } finally {
    addingVendor.value = false
  }
}

// 開始掃描
async function startScanner() {
  cameraError.value = ''
  scanning.value = true
  await nextTick()

  try {
    html5QrCode = new Html5Qrcode('qr-reader')
    await html5QrCode.start(
      { facingMode: 'environment' },
      {
        fps: 10,
        qrbox: { width: 250, height: 250 }
      },
      onScanSuccess,
      () => {} // ignore scan failure
    )
    scannerReady.value = true
  } catch (e: any) {
    cameraError.value = '無法存取相機，請確認已授予權限'
    scanning.value = false
  }
}

// 停止掃描
async function stopScanner() {
  if (html5QrCode) {
    try {
      await html5QrCode.stop()
    } catch {}
    html5QrCode = null
  }
  scanning.value = false
  scannerReady.value = false
}

// 掃描成功
async function onScanSuccess(decodedText: string) {
  // 暫停掃描避免重複
  await stopScanner()

  const parsed = parseQRCode(decodedText)
  if (!parsed) {
    error.value = '無效的 QR Code 格式'
    return
  }

  await lookupProduct(parsed.product)
}

// 手動輸入產品
async function handleManualInput() {
  if (!manualProductCode.value.trim()) return
  await lookupProduct(manualProductCode.value.trim())
  manualProductCode.value = ''
}

// 查詢產品
async function lookupProduct(productValue: string) {
  loading.value = true
  error.value = ''

  try {
    const token = getToken()
    const product = await getProductByValue(token, productValue)
    if (!product) {
      error.value = `找不到產品: ${productValue}`
      return
    }

    const uomName = await getUOMName(token, product.uomId)

    scannedProduct.value = {
      id: product.id,
      value: product.value,
      name: product.name,
      uomName
    }
    itemQty.value = 1
    itemPrice.value = 1
    showAddItemModal.value = true
  } catch (e: any) {
    error.value = e.message || '查詢產品失敗'
  } finally {
    loading.value = false
  }
}

// 加入清單
function addToList() {
  if (!scannedProduct.value) return

  purchaseItems.value.push({
    productId: scannedProduct.value.id,
    productValue: scannedProduct.value.value,
    productName: scannedProduct.value.name,
    uomId: 0,
    uomName: scannedProduct.value.uomName,
    qty: itemQty.value,
    price: itemPrice.value
  })

  showAddItemModal.value = false
  scannedProduct.value = null

  // 儲存到 localStorage
  saveDraft()
}

// 刪除項目
function removeItem(index: number) {
  purchaseItems.value.splice(index, 1)
  saveDraft()
}

// 清空清單
function clearList() {
  if (confirm('確定要清空採購清單嗎？')) {
    purchaseItems.value = []
    localStorage.removeItem('purchase_draft')
  }
}

// 更新項目
function updateItem() {
  saveDraft()
}

// 儲存草稿
function saveDraft() {
  localStorage.setItem('purchase_draft', JSON.stringify({
    vendorId: selectedVendorId.value,
    warehouseId: selectedWarehouseId.value,
    items: purchaseItems.value,
    savedAt: Date.now()
  }))
}

// 恢復草稿
function restoreDraft() {
  const draft = localStorage.getItem('purchase_draft')
  if (draft) {
    try {
      const data = JSON.parse(draft)
      // 檢查是否超過 24 小時
      if (Date.now() - data.savedAt > 24 * 60 * 60 * 1000) {
        localStorage.removeItem('purchase_draft')
        return
      }

      if (data.items?.length > 0) {
        if (confirm(`發現未完成的採購清單 (${data.items.length} 項)，是否恢復？`)) {
          purchaseItems.value = data.items
          if (data.vendorId) selectedVendorId.value = data.vendorId
          if (data.warehouseId) selectedWarehouseId.value = data.warehouseId
        } else {
          localStorage.removeItem('purchase_draft')
        }
      }
    } catch {}
  }
}

// 提交採購單
async function submitOrder() {
  if (!canSubmit.value) return

  loading.value = true
  error.value = ''

  try {
    const warehouse = warehouses.value.find(w => w.id === selectedWarehouseId.value)
    
    const result = await createPurchaseOrder(getToken(), {
      vendorId: selectedVendorId.value!,
      warehouseId: selectedWarehouseId.value!,
      orgId: warehouse?.orgId,
      items: purchaseItems.value
    })

    orderResult.value = result
    showSuccessModal.value = true

    // 清空清單
    purchaseItems.value = []
    localStorage.removeItem('purchase_draft')
  } catch (e: any) {
    error.value = e.message || '建立採購單失敗'
  } finally {
    loading.value = false
  }
}

// 繼續掃描
function continueScan() {
  showSuccessModal.value = false
  orderResult.value = null
}

// 監聽清單變化
watch(purchaseItems, () => {
  saveDraft()
}, { deep: true })

onMounted(() => {
  loadInitialData()
  restoreDraft()
})

onUnmounted(() => {
  stopScanner()
})
</script>

<template>
  <div class="min-h-screen bg-slate-50 p-4">
    <!-- 標題 -->
    <div class="mb-4">
      <h1 class="text-xl font-bold text-slate-800">掃描採購</h1>
      <p class="text-sm text-slate-500">掃描產品 QR Code 快速建立採購單</p>
    </div>

    <!-- 錯誤訊息 -->
    <div v-if="error" class="mb-4 p-3 bg-red-100 text-red-700 rounded-lg text-sm">
      {{ error }}
      <button @click="error = ''" class="ml-2 text-red-500 hover:underline">關閉</button>
    </div>

    <!-- 供應商與倉庫 -->
    <div class="bg-white rounded-lg shadow p-4 mb-4">
      <!-- 供應商 -->
      <div class="mb-3">
        <label class="block text-sm font-medium text-slate-700 mb-1">
          供應商 <span class="text-red-500">*</span>
        </label>
        <div class="flex gap-2">
          <select
            v-model="selectedVendorId"
            class="flex-1 px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option :value="null">請選擇供應商</option>
            <option v-for="v in vendors" :key="v.id" :value="v.id">{{ v.name }}</option>
          </select>
          <button
            @click="showAddVendor = true"
            class="px-3 py-2 bg-slate-100 text-slate-700 rounded-lg hover:bg-slate-200 text-sm whitespace-nowrap"
          >
            + 新增
          </button>
        </div>
      </div>

      <!-- 倉庫 -->
      <div>
        <label class="block text-sm font-medium text-slate-700 mb-1">入庫倉庫</label>
        <select
          v-model="selectedWarehouseId"
          class="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          <option v-for="w in warehouses" :key="w.id" :value="w.id">{{ w.name }}</option>
        </select>
      </div>
    </div>

    <!-- 掃描區域 -->
    <div class="bg-white rounded-lg shadow p-4 mb-4">
      <div v-if="!scanning" class="text-center">
        <button
          @click="startScanner"
          class="w-full py-4 bg-blue-500 text-white font-bold rounded-lg hover:bg-blue-600 flex items-center justify-center gap-2"
        >
          <span class="text-2xl">📷</span>
          點擊開始掃描
        </button>
      </div>

      <div v-else>
        <div id="qr-reader" class="w-full rounded-lg overflow-hidden"></div>
        <button
          @click="stopScanner"
          class="w-full mt-2 py-2 bg-slate-200 text-slate-700 rounded-lg hover:bg-slate-300"
        >
          停止掃描
        </button>
      </div>

      <!-- 相機錯誤 -->
      <div v-if="cameraError" class="mt-3 p-3 bg-amber-50 border border-amber-200 rounded-lg text-sm">
        <div class="font-medium text-amber-800 mb-1">📷 需要相機權限</div>
        <p class="text-amber-700 text-xs">{{ cameraError }}</p>
        <p class="text-amber-600 text-xs mt-1">請在瀏覽器設定中允許相機存取，或使用下方手動輸入。</p>
      </div>

      <!-- 手動輸入 -->
      <div class="mt-3 pt-3 border-t border-slate-100">
        <div class="text-xs text-slate-400 text-center mb-2">或手動輸入</div>
        <div class="flex gap-2">
          <input
            v-model="manualProductCode"
            type="text"
            placeholder="產品編碼"
            class="flex-1 px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            @keyup.enter="handleManualInput"
          />
          <button
            @click="handleManualInput"
            :disabled="!manualProductCode.trim()"
            class="px-4 py-2 bg-slate-100 text-slate-700 rounded-lg hover:bg-slate-200 disabled:opacity-50"
          >
            +
          </button>
        </div>
      </div>
    </div>

    <!-- 採購清單 -->
    <div class="bg-white rounded-lg shadow mb-4">
      <div class="flex items-center justify-between p-3 border-b border-slate-100">
        <span class="font-medium text-slate-800">📋 採購清單 ({{ purchaseItems.length }} 項)</span>
        <button
          v-if="purchaseItems.length > 0"
          @click="clearList"
          class="text-xs text-red-500 hover:underline"
        >
          清空
        </button>
      </div>

      <div v-if="purchaseItems.length === 0" class="p-8 text-center text-slate-400">
        尚無商品，請開始掃描
      </div>

      <div v-else class="divide-y divide-slate-100">
        <div
          v-for="(item, index) in purchaseItems"
          :key="index"
          class="p-3"
        >
          <div class="flex items-start justify-between mb-2">
            <div class="font-medium text-slate-800">{{ item.productName }}</div>
            <button
              @click="removeItem(index)"
              class="text-red-400 hover:text-red-600 text-lg leading-none"
            >
              ✕
            </button>
          </div>
          <div class="flex items-center gap-3 text-sm">
            <div class="flex items-center gap-1">
              <span class="text-slate-500">數量:</span>
              <input
                v-model.number="item.qty"
                type="number"
                min="1"
                class="w-16 px-2 py-1 border border-slate-300 rounded text-center"
                @change="updateItem"
              />
              <span class="text-slate-400">{{ item.uomName }}</span>
            </div>
            <div class="flex items-center gap-1">
              <span class="text-slate-500">單價:</span>
              <input
                v-model.number="item.price"
                type="number"
                min="0"
                step="0.01"
                class="w-20 px-2 py-1 border border-slate-300 rounded text-center"
                @change="updateItem"
              />
            </div>
          </div>
          <div class="text-right text-sm text-slate-600 mt-1">
            小計: ${{ (item.qty * item.price).toFixed(0) }}
          </div>
        </div>
      </div>

      <!-- 合計 -->
      <div v-if="purchaseItems.length > 0" class="p-3 border-t border-slate-200 bg-slate-50">
        <div class="flex justify-between text-sm">
          <span class="text-slate-600">合計: {{ purchaseItems.length }} 種 / {{ totalQty }} 項</span>
          <span class="font-bold text-slate-800">總計: ${{ totalAmount.toFixed(0) }}</span>
        </div>
      </div>
    </div>

    <!-- 提交按鈕 -->
    <button
      @click="submitOrder"
      :disabled="!canSubmit || loading"
      class="w-full py-4 bg-emerald-500 text-white font-bold rounded-lg hover:bg-emerald-600 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
    >
      <span v-if="loading" class="loading loading-spinner loading-sm"></span>
      <span>✓ 完成採購單</span>
    </button>

    <!-- 新增供應商 Modal -->
    <div
      v-if="showAddVendor"
      class="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
      @click.self="showAddVendor = false"
    >
      <div class="bg-white rounded-xl p-6 max-w-sm w-full">
        <h3 class="font-bold text-lg mb-4">新增供應商</h3>
        <div class="mb-4">
          <label class="block text-sm font-medium text-slate-700 mb-1">名稱 *</label>
          <input
            v-model="newVendorName"
            type="text"
            placeholder="例: 水果攤阿姨"
            class="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            @keyup.enter="handleAddVendor"
          />
        </div>
        <div class="flex gap-2">
          <button
            @click="showAddVendor = false"
            class="flex-1 py-2 bg-slate-100 text-slate-700 rounded-lg hover:bg-slate-200"
          >
            取消
          </button>
          <button
            @click="handleAddVendor"
            :disabled="addingVendor || !newVendorName.trim()"
            class="flex-1 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 disabled:opacity-50"
          >
            <span v-if="addingVendor">建立中...</span>
            <span v-else>建立</span>
          </button>
        </div>
      </div>
    </div>

    <!-- 加入清單 Modal -->
    <div
      v-if="showAddItemModal"
      class="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
      @click.self="showAddItemModal = false"
    >
      <div class="bg-white rounded-xl p-6 max-w-sm w-full">
        <div class="text-center mb-4">
          <div class="text-emerald-500 text-3xl mb-2">✓</div>
          <div class="font-bold text-lg">{{ scannedProduct?.name }}</div>
          <div class="text-sm text-slate-500">({{ scannedProduct?.value }})</div>
          <div class="text-xs text-slate-400">單位: {{ scannedProduct?.uomName }}</div>
        </div>

        <div class="space-y-3 mb-4">
          <div>
            <label class="block text-sm font-medium text-slate-700 mb-1">數量 *</label>
            <input
              v-model.number="itemQty"
              type="number"
              min="1"
              class="w-full px-3 py-2 border border-slate-300 rounded-lg text-center text-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div>
            <label class="block text-sm font-medium text-slate-700 mb-1">單價 (選填，預設 1)</label>
            <input
              v-model.number="itemPrice"
              type="number"
              min="0"
              step="0.01"
              class="w-full px-3 py-2 border border-slate-300 rounded-lg text-center text-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </div>

        <div class="flex gap-2">
          <button
            @click="showAddItemModal = false"
            class="flex-1 py-2 bg-slate-100 text-slate-700 rounded-lg hover:bg-slate-200"
          >
            取消
          </button>
          <button
            @click="addToList"
            class="flex-1 py-2 bg-emerald-500 text-white rounded-lg hover:bg-emerald-600"
          >
            加入清單
          </button>
        </div>
      </div>
    </div>

    <!-- 成功 Modal -->
    <div
      v-if="showSuccessModal"
      class="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
    >
      <div class="bg-white rounded-xl p-6 max-w-sm w-full text-center">
        <div class="text-emerald-500 text-5xl mb-4">✓</div>
        <h3 class="font-bold text-xl mb-2">採購單建立成功</h3>
        <div class="text-slate-600 mb-4">
          <p>單號: <span class="font-mono font-bold">{{ orderResult?.documentNo }}</span></p>
          <p class="text-sm text-slate-400 mt-2">系統將自動產生收貨單及發票</p>
        </div>
        <button
          @click="continueScan"
          class="w-full py-3 bg-blue-500 text-white font-bold rounded-lg hover:bg-blue-600"
        >
          繼續掃描
        </button>
      </div>
    </div>

    <!-- Loading Overlay -->
    <div
      v-if="loading"
      class="fixed inset-0 bg-black/30 flex items-center justify-center z-40"
    >
      <div class="bg-white rounded-lg p-4 flex items-center gap-3">
        <span class="loading loading-spinner loading-md"></span>
        <span>處理中...</span>
      </div>
    </div>
  </div>
</template>
