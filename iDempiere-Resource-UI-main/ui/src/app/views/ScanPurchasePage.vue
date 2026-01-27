<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted, watch, nextTick } from 'vue'
import { Html5Qrcode, Html5QrcodeSupportedFormats } from 'html5-qrcode'
import { useAuth } from '../../features/auth/store'
import {
  getVendors,
  createVendor,
  getWarehouses,
  getProductByValue,
  getUOMName,
  createPurchaseOrder,
  parseQRCode,
  getUOMs,
  getProductCategories,
  createProduct,
  getPurchasePriceVersionId,
  getProductPrice
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

// 新產品
const showCreateProductModal = ref(false)
const uoms = ref<{ id: number; name: string }[]>([])
const categories = ref<{ id: number; name: string }[]>([])
const newProductForm = ref({ value: '', name: '', uomId: 0, categoryId: 0, price: 0 })
const creatingProduct = ref(false)

// 倉庫
const warehouses = ref<Warehouse[]>([])
const selectedWarehouseId = ref<number | null>(null)

// 價格表
const priceListVersionId = ref<number | null>(null)

// 日期 (預設今天)
const orderDate = ref(new Date().toISOString().split('T')[0])

// 掃描
const scanning = ref(false)
const scannerReady = ref(false)
const cameraError = ref('')
let html5QrCode: Html5Qrcode | null = null
const quickScan = ref(false) // 連續掃描模式

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

// 音效回饋
function playScanSound() {
  try {
    const AudioContext = window.AudioContext || (window as any).webkitAudioContext
    if (!AudioContext) return
    
    const ctx = new AudioContext()
    const osc = ctx.createOscillator()
    const gain = ctx.createGain()
    
    osc.connect(gain)
    gain.connect(ctx.destination)
    
    osc.type = 'sine'
    osc.frequency.value = 880 // A5
    gain.gain.setValueAtTime(0.1, ctx.currentTime)
    gain.gain.exponentialRampToValueAtTime(0.00001, ctx.currentTime + 0.1)
    
    osc.start()
    osc.stop(ctx.currentTime + 0.1)
  } catch (e) {
    console.warn('Audio play failed', e)
  }
}

// 震動回饋
function triggerHaptic() {
  if (navigator.vibrate) {
    navigator.vibrate(50)
  }
}

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
    const [vendorList, warehouseList, uomList, catList, plVerId] = await Promise.all([
      getVendors(token),
      getWarehouses(token),
      getUOMs(token),
      getProductCategories(token),
      getPurchasePriceVersionId(token)
    ])
    vendors.value = vendorList
    warehouses.value = warehouseList
    uoms.value = uomList
    categories.value = catList
    priceListVersionId.value = plVerId

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

// 建立新產品
async function handleCreateProduct() {
  if (!newProductForm.value.name) return
  creatingProduct.value = true
  try {
    const product = await createProduct(getToken(), newProductForm.value)
    
    // 直接加入購物清單
    scannedProduct.value = {
      id: product.id,
      value: product.value,
      name: product.name,
      uomName: uoms.value.find(u => u.id === product.uomId)?.name || '單位'
    }
    itemQty.value = 1
    itemPrice.value = newProductForm.value.price || 0
    
    // 如果有輸入價格，直接加入清單，不用再跳加入視窗
    addToList()
    
    showCreateProductModal.value = false
    // 提示成功 (Optional)
  } catch(e: any) {
    alert(e.message || '建立產品失敗')
  } finally {
    creatingProduct.value = false
  }
}

// 開始掃描
async function startScanner() {
  cameraError.value = ''
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
      experimentalFeatures: {
        useBarCodeDetectorIfSupported: true
      },
      verbose: false
    })
    await html5QrCode.start(
      { facingMode: 'environment' },
      {
        fps: 10,
        // 動態調整掃描框，使其適應寬條碼
        qrbox: (viewfinderWidth, viewfinderHeight) => {
          const minEdge = Math.min(viewfinderWidth, viewfinderHeight)
          return {
            width: Math.floor(minEdge * 0.8),
            height: Math.floor(minEdge * 0.6)
          }
        },
        aspectRatio: 1.0
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
  // 果不是連續掃描，先暫停
  if (!quickScan.value) {
    await stopScanner()
  }

  // 避免連續掃描觸發太快 (簡易防抖)
  if (loading.value) return 

  playScanSound()
  triggerHaptic()

  const parsed = parseQRCode(decodedText)
  if (!parsed) {
    // 只有在非連續模式下才顯示錯誤避免干擾
    if (!quickScan.value) error.value = '無效的 QR Code 格式'
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
      if (!quickScan.value) {
         // 找不到產品 -> 開啟建立產品視窗
         newProductForm.value = {
           value: productValue,
           name: '',
           uomId: uoms.value[0]?.id || 0,
           categoryId: categories.value[0]?.id || 0,
           price: 0
         }
         showCreateProductModal.value = true
      }
      return
    }

    const uomName = await getUOMName(token, product.uomId)
    
    // 查詢價格
    let price = 1
    if (priceListVersionId.value) {
      try {
        const p = await getProductPrice(token, priceListVersionId.value, product.id)
        if (p > 0) price = p
      } catch {}
    }

    const productData = {
      id: product.id,
      value: product.value,
      name: product.name,
      uomName
    }

    if (quickScan.value) {
      // 連續模式：直接加入
      purchaseItems.value.push({
        productId: productData.id,
        productValue: productData.value,
        productName: productData.name,
        uomId: 0,
        uomName: productData.uomName,
        qty: 1, // 預設 1
        price: price // 使用查到的價格
      })
      saveDraft()
      // 成功提示 (用 toast 更好，這裡暫用 console 或不打擾)
    } else {
      // 一般模式：開啟彈窗
      scannedProduct.value = productData
      itemQty.value = 1
      itemPrice.value = price // 使用查到的價格
      showAddItemModal.value = true
    }

  } catch (e: any) {
    if (!quickScan.value) error.value = e.message || '查詢產品失敗'
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
      dateOrdered: orderDate.value,
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
  <div class="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 pb-32">
    <!-- Sticky Header -->
    <div class="sticky top-0 z-30 bg-white/80 backdrop-blur-md border-b border-slate-200/50 shadow-sm px-4 py-3 flex justify-between items-center">
      <div>
        <h1 class="text-lg font-bold text-slate-800 tracking-tight">掃描採購</h1>
        <p class="text-xs text-slate-500 font-medium">iDempiere Mobile</p>
      </div>
      <div v-if="vendors.length > 0" class="flex items-center gap-2">
         <!-- 這裡可以放 User Avatar 或設定按鈕 -->
      </div>
    </div>

    <div class="p-4 space-y-4 max-w-lg mx-auto">
      <!-- 錯誤訊息 -->
      <transition 
        enter-active-class="transition duration-300 ease-out" 
        enter-from-class="transform -translate-y-2 opacity-0" 
        enter-to-class="transform translate-y-0 opacity-100"
        leave-active-class="transition duration-200 ease-in" 
        leave-from-class="opacity-100" 
        leave-to-class="opacity-0"
      >
        <div v-if="error" class="p-4 bg-red-50 border border-red-100 text-red-700 rounded-xl shadow-sm text-sm flex justify-between items-start">
          <div class="flex gap-2">
            <span>⚠️</span>
            <span>{{ error }}</span>
          </div>
          <button @click="error = ''" class="text-red-400 hover:text-red-700">✕</button>
        </div>
      </transition>

      <!-- 設定區塊 (Card) -->
      <div class="bg-white rounded-2xl shadow-sm border border-slate-100 p-5 space-y-4">
        <!-- 供應商 -->
        <div>
          <label class="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5 pl-1">
            供應商 <span class="text-red-500">*</span>
          </label>
          <div class="flex gap-2">
            <div class="relative flex-1">
              <select
                v-model="selectedVendorId"
                class="w-full appearance-none bg-slate-50 border border-slate-200 text-slate-700 rounded-xl px-4 py-3 pr-8 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:bg-white transition-colors text-sm font-medium"
              >
                <option :value="null">請選擇供應商</option>
                <option v-for="v in vendors" :key="v.id" :value="v.id">{{ v.name }}</option>
              </select>
              <div class="pointer-events-none absolute inset-y-0 right-0 flex items-center px-3 text-slate-500">
                <svg class="h-4 w-4 fill-current" viewBox="0 0 20 20"><path d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z"/></svg>
              </div>
            </div>
            <button
              @click="showAddVendor = true"
              class="px-4 bg-emerald-50 text-emerald-600 rounded-xl hover:bg-emerald-100 font-medium transition-colors"
            >
              +
            </button>
          </div>
        </div>

        <div class="grid grid-cols-2 gap-4">
          <!-- 倉庫 -->
          <div>
            <label class="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5 pl-1">入庫倉庫</label>
            <div class="relative">
              <select
                v-model="selectedWarehouseId"
                class="w-full appearance-none bg-slate-50 border border-slate-200 text-slate-700 rounded-xl px-3 py-2.5 pr-8 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:bg-white transition-colors text-sm"
              >
                <option v-for="w in warehouses" :key="w.id" :value="w.id">{{ w.name }}</option>
              </select>
              <div class="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2 text-slate-500">
                <svg class="h-3 w-3 fill-current" viewBox="0 0 20 20"><path d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z"/></svg>
              </div>
            </div>
          </div>

          <!-- 日期 -->
          <div>
            <label class="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5 pl-1">採購日期</label>
            <input
              v-model="orderDate"
              type="date"
              class="w-full bg-slate-50 border border-slate-200 text-slate-700 rounded-xl px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:bg-white transition-colors text-sm"
            />
          </div>
        </div>
      </div>

      <!-- 掃描區域 -->
      <div class="bg-white rounded-2xl shadow-lg shadow-slate-200/50 overflow-hidden border border-slate-100">
        <!-- 未掃描狀態 -->
        <div v-if="!scanning" class="p-8 text-center bg-slate-50/50">
          <div class="w-20 h-20 bg-emerald-100 text-emerald-500 rounded-full flex items-center justify-center mx-auto mb-4 text-4xl shadow-inner">
            📷
          </div>
          <h3 class="text-slate-800 font-bold text-lg mb-1">準備掃描</h3>
          <p class="text-slate-500 text-sm mb-6">點擊下方按鈕啟動相機<br>支援 QR Code 與條碼</p>
          <button
            @click="startScanner"
            class="w-full py-3.5 bg-gradient-to-r from-emerald-500 to-teal-500 text-white font-bold rounded-xl shadow-lg shadow-emerald-500/20 hover:shadow-emerald-500/30 active:scale-95 transition-all flex items-center justify-center gap-2"
          >
            開始掃描
          </button>
        </div>

        <!-- 掃描中狀態 -->
        <div v-else class="relative bg-black">
          <div id="qr-reader" class="w-full"></div>
          
          <!-- 掃描框 Overlay -->
          <div class="absolute inset-0 pointer-events-none border-[30px] border-black/50 flex items-center justify-center">
             <div class="w-64 h-64 border-2 border-white/80 rounded-lg relative">
               <div class="absolute top-0 left-0 w-4 h-4 border-t-4 border-l-4 border-emerald-400 -mt-1 -ml-1"></div>
               <div class="absolute top-0 right-0 w-4 h-4 border-t-4 border-r-4 border-emerald-400 -mt-1 -mr-1"></div>
               <div class="absolute bottom-0 left-0 w-4 h-4 border-b-4 border-l-4 border-emerald-400 -mb-1 -ml-1"></div>
               <div class="absolute bottom-0 right-0 w-4 h-4 border-b-4 border-r-4 border-emerald-400 -mb-1 -mr-1"></div>
             </div>
          </div>
          
          <!-- 控制列 -->
          <div class="absolute bottom-0 inset-x-0 bg-black/60 backdrop-blur-sm p-4 flex items-center justify-between">
            <button 
              @click="stopScanner" 
              class="text-white/90 hover:text-white text-sm bg-white/20 px-4 py-2 rounded-lg backdrop-blur-md"
            >
              關閉
            </button>
            
            <!-- Quick Scan Toggle -->
            <label class="flex items-center gap-2 cursor-pointer">
              <span class="text-white text-sm font-medium">連續掃描</span>
              <div class="relative">
                <input type="checkbox" v-model="quickScan" class="sr-only peer">
                <div class="w-11 h-6 bg-gray-500 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-emerald-500"></div>
              </div>
            </label>
          </div>
        </div>

        <!-- 相機錯誤 -->
        <div v-if="cameraError" class="p-4 bg-amber-50 text-amber-800 text-sm border-t border-amber-100">
          <p class="font-bold">📷 需要權限</p>
          <p>{{ cameraError }}</p>
        </div>

        <!-- 手動輸入 -->
        <div class="p-4 border-t border-slate-100 bg-white">
          <div class="flex gap-2">
            <input
              v-model="manualProductCode"
              type="text"
              placeholder="手動輸入條碼..."
              class="flex-1 bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
              @keyup.enter="handleManualInput"
            />
            <button
              @click="handleManualInput"
              :disabled="!manualProductCode.trim()"
              class="w-12 bg-slate-100 text-slate-600 rounded-xl hover:bg-slate-200 flex items-center justify-center disabled:opacity-50 transition-colors"
            >
              ➤
            </button>
          </div>
        </div>
      </div>

      <!-- 採購清單 -->
      <div class="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
        <div class="flex items-center justify-between p-4 border-b border-slate-50 bg-slate-50/50">
          <h3 class="font-bold text-slate-700 flex items-center gap-2">
            📦 採購項目 
            <span class="bg-emerald-100 text-emerald-700 text-xs px-2 py-0.5 rounded-full font-bold">{{ purchaseItems.length }}</span>
          </h3>
          <button
            v-if="purchaseItems.length > 0"
            @click="clearList"
            class="text-xs text-red-500 font-medium hover:bg-red-50 px-2 py-1 rounded transition-colors"
          >
            清空列表
          </button>
        </div>

        <div v-if="purchaseItems.length === 0" class="py-12 flex flex-col items-center justify-center text-slate-300">
          <div class="text-4xl mb-2">🛒</div>
          <p class="text-sm">尚未加入任何商品</p>
        </div>

        <transition-group 
          name="list" 
          tag="div" 
          class="divide-y divide-slate-50"
        >
          <div
            v-for="(item, index) in purchaseItems"
            :key="`${item.productId}-${index}`"
            class="p-4 hover:bg-slate-50 transition-colors group relative"
          >
            <div class="flex justify-between items-start mb-2">
              <span class="font-bold text-slate-800 text-base">{{ item.productName }}</span>
              <span class="font-mono text-emerald-600 font-bold">${{ (item.qty * item.price).toFixed(0) }}</span>
            </div>
            
            <div class="flex items-center justify-between">
              <div class="flex items-center gap-2">
                <div class="flex items-center border border-slate-200 rounded-lg bg-white shadow-sm overflow-hidden">
                   <button @click="item.qty > 1 ? item.qty-- : removeItem(index)" class="px-2 py-1 text-slate-400 hover:text-emerald-500 hover:bg-emerald-50 transition-colors">-</button>
                   <input 
                     v-model.number="item.qty" 
                     type="number" 
                     class="w-10 text-center text-sm font-bold text-slate-700 focus:outline-none py-1"
                   />
                   <button @click="item.qty++" class="px-2 py-1 text-slate-400 hover:text-emerald-500 hover:bg-emerald-50 transition-colors">+</button>
                </div>
                <span class="text-xs text-slate-400">{{ item.uomName }}</span>
              </div>
              
              <div class="flex items-center gap-1">
                <span class="text-xs text-slate-400">@</span>
                <input
                   v-model.number="item.price"
                   type="number"
                   class="w-16 bg-transparent border-b border-slate-200 text-right text-sm text-slate-500 focus:border-emerald-500 focus:outline-none"
                />
              </div>
            </div>

            <!-- 刪除按鈕 (Hover 顯示) -->
            <button 
              @click="removeItem(index)"
              class="absolute -right-2 -top-2 bg-red-500 text-white rounded-full w-6 h-6 flex items-center justify-center shadow-md opacity-0 group-hover:opacity-100 transition-opacity transform scale-75 group-hover:scale-100"
            >
              ✕
            </button>
          </div>
        </transition-group>
      </div>
    </div>

    <!-- Sticky Footer Summary & Action -->
    <div class="fixed bottom-0 inset-x-0 bg-white/90 backdrop-blur-md border-t border-slate-200 shadow-[0_-4px_20px_-5px_rgba(0,0,0,0.1)] p-4 pb-6 z-40 safe-area-bottom">
      <div class="max-w-lg mx-auto flex gap-4 items-center">
        <div class="flex-1">
          <div class="text-xs text-slate-500 mb-0.5">預估總計</div>
          <div class="flex items-baseline gap-1">
            <span class="font-bold text-slate-400 text-sm">$</span>
            <span class="text-2xl font-bold text-slate-800 tracking-tight">{{ totalAmount.toLocaleString() }}</span>
          </div>
        </div>
        
        <button
          @click="submitOrder"
          :disabled="!canSubmit || loading"
          class="flex-[2] bg-gradient-to-r from-emerald-500 to-teal-600 text-white font-bold py-3.5 rounded-xl shadow-lg shadow-emerald-500/30 active:scale-95 transition-all disabled:opacity-50 disabled:shadow-none flex items-center justify-center gap-2"
        >
          <span v-if="loading" class="loading loading-spinner loading-sm"></span>
          <span v-else>確認送出 ({{ totalQty }})</span>
        </button>
      </div>
    </div>

    <!-- 新增供應商 Modal -->
    <transition enter-active-class="duration-200 ease-out" enter-from-class="opacity-0 scale-95" enter-to-class="opacity-100 scale-100" leave-active-class="duration-200 ease-in" leave-from-class="opacity-100 scale-100" leave-to-class="opacity-0 scale-95">
      <div v-if="showAddVendor" class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm" @click.self="showAddVendor = false">
        <div class="bg-white rounded-2xl p-6 w-full max-w-sm shadow-2xl">
          <h3 class="font-bold text-lg mb-4 text-slate-800">新增供應商</h3>
          <input
            v-model="newVendorName"
            type="text"
            placeholder="請輸入名稱"
            class="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 mb-4 focus:ring-2 focus:ring-emerald-500 outline-none"
            @keyup.enter="handleAddVendor"
          />
          <div class="flex gap-2">
            <button @click="showAddVendor = false" class="flex-1 py-3 text-slate-500 font-medium hover:bg-slate-50 rounded-xl transition-colors">取消</button>
            <button @click="handleAddVendor" class="flex-1 py-3 bg-emerald-500 text-white font-bold rounded-xl shadow-lg shadow-emerald-500/20 hover:bg-emerald-600 transition-colors">建立</button>
          </div>
        </div>
      </div>
    </transition>

    <!-- 加入商品 Modal (標準模式) -->
    <transition enter-active-class="duration-200 ease-out" enter-from-class="opacity-0 translate-y-10" enter-to-class="opacity-100 translate-y-0" leave-active-class="duration-200 ease-in" leave-from-class="opacity-100 translate-y-0" leave-to-class="opacity-0 translate-y-10">
      <div v-if="showAddItemModal" class="fixed inset-0 z-50 flex items-end sm:items-center justify-center sm:p-4" @click.self="showAddItemModal = false">
        <div class="fixed inset-0 bg-black/40 backdrop-blur-sm" @click="showAddItemModal = false"></div>
        <div class="bg-white rounded-t-3xl sm:rounded-3xl p-6 w-full max-w-sm relative z-10 shadow-2xl">
          <div class="w-12 h-1 bg-slate-200 rounded-full mx-auto mb-6 sm:hidden"></div>
          
          <div class="text-center mb-6">
            <h3 class="font-bold text-xl text-slate-800 leading-tight mb-1">{{ scannedProduct?.name }}</h3>
            <p class="text-sm text-slate-400 font-mono">{{ scannedProduct?.value }}</p>
          </div>

          <div class="flex items-center justify-center gap-4 mb-8">
            <button @click="itemQty > 1 ? itemQty-- : null" class="w-12 h-12 rounded-full bg-slate-100 text-slate-600 text-xl font-bold flex items-center justify-center hover:bg-slate-200 transition-colors">-</button>
            <div class="flex flex-col items-center w-24">
              <input v-model.number="itemQty" type="number" class="w-full text-center text-3xl font-bold text-slate-800 bg-transparent outline-none p-0" />
              <span class="text-xs text-slate-400">{{ scannedProduct?.uomName }}</span>
            </div>
            <button @click="itemQty++" class="w-12 h-12 rounded-full bg-slate-100 text-slate-600 text-xl font-bold flex items-center justify-center hover:bg-slate-200 transition-colors">+</button>
          </div>
          
          <div class="mb-6">
             <label class="block text-xs font-bold text-slate-400 text-center mb-2 uppercase">單價</label>
             <input v-model.number="itemPrice" type="number" class="w-full text-center bg-slate-50 rounded-xl py-3 border border-slate-200 focus:ring-2 focus:ring-emerald-500 outline-none" />
          </div>

          <div class="flex gap-2">
            <button @click="showAddItemModal = false" class="flex-1 py-3.5 text-slate-500 font-bold hover:bg-slate-50 rounded-xl transition-colors">取消</button>
            <button @click="addToList" class="flex-[2] py-3.5 bg-emerald-500 text-white font-bold rounded-xl shadow-lg shadow-emerald-500/30 hover:bg-emerald-600 transition-colors">加入清單</button>
          </div>
        </div>
      </div>
    </transition>

    <!-- 建立新產品 Modal -->
    <transition enter-active-class="duration-200 ease-out" enter-from-class="opacity-0 scale-95" enter-to-class="opacity-100 scale-100" leave-active-class="duration-200 ease-in" leave-from-class="opacity-100 scale-100" leave-to-class="opacity-0 scale-95">
      <div v-if="showCreateProductModal" class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm" @click.self="showCreateProductModal = false">
        <div class="bg-white rounded-2xl p-6 w-full max-w-sm shadow-2xl overflow-y-auto max-h-[90vh]">
          <h3 class="font-bold text-lg mb-4 text-slate-800">✨ 發現新商品</h3>
          
          <div class="space-y-4">
             <div>
               <label class="block text-xs font-bold text-slate-500 uppercase mb-1">條碼 (Barcode)</label>
               <input v-model="newProductForm.value" type="text" disabled class="w-full bg-slate-100 border border-slate-200 rounded-xl px-4 py-3 text-slate-500 font-mono" />
             </div>
             
             <div>
               <label class="block text-xs font-bold text-slate-500 uppercase mb-1">商品名稱 <span class="text-red-500">*</span></label>
               <input v-model="newProductForm.name" type="text" placeholder="例如: 舒潔衛生紙 110抽" class="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 focus:ring-2 focus:ring-emerald-500 outline-none" />
             </div>

             <div class="grid grid-cols-2 gap-4">
               <div>
                  <label class="block text-xs font-bold text-slate-500 uppercase mb-1">分類 <span class="text-red-500">*</span></label>
                  <select v-model="newProductForm.categoryId" class="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-3 focus:ring-2 focus:ring-emerald-500 outline-none text-sm">
                    <option v-for="c in categories" :key="c.id" :value="c.id">{{ c.name }}</option>
                  </select>
               </div>
               <div>
                  <label class="block text-xs font-bold text-slate-500 uppercase mb-1">單位 <span class="text-red-500">*</span></label>
                  <select v-model="newProductForm.uomId" class="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-3 focus:ring-2 focus:ring-emerald-500 outline-none text-sm">
                    <option v-for="u in uoms" :key="u.id" :value="u.id">{{ u.name }}</option>
                  </select>
               </div>
             </div>

             <div>
               <label class="block text-xs font-bold text-slate-500 uppercase mb-1">參考價格</label>
               <input v-model.number="newProductForm.price" type="number" class="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 focus:ring-2 focus:ring-emerald-500 outline-none" />
             </div>
          </div>

          <div class="flex gap-2 mt-6">
            <button @click="showCreateProductModal = false" class="flex-1 py-3 text-slate-500 font-medium hover:bg-slate-50 rounded-xl transition-colors">取消</button>
            <button 
              @click="handleCreateProduct" 
              :disabled="creatingProduct || !newProductForm.name"
              class="flex-1 py-3 bg-emerald-500 text-white font-bold rounded-xl shadow-lg shadow-emerald-500/20 hover:bg-emerald-600 transition-colors disabled:opacity-50"
            >
              {{ creatingProduct ? '建立中...' : '建立並加入' }}
            </button>
          </div>
        </div>
      </div>
    </transition>

    <!-- 成功 Modal -->
    <transition enter-active-class="duration-300 ease-out" enter-from-class="opacity-0 scale-90" enter-to-class="opacity-100 scale-100">
      <div v-if="showSuccessModal" class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-white/90 backdrop-blur-xl">
        <div class="text-center max-w-xs w-full">
          <div class="w-24 h-24 bg-emerald-100 text-emerald-500 rounded-full flex items-center justify-center mx-auto mb-6 shadow-emerald-200/50 shadow-xl">
            <svg class="w-12 h-12 stroke-current" fill="none" viewBox="0 0 24 24" stroke-width="3" stroke-linecap="round" stroke-linejoin="round">
              <path d="M20 6L9 17l-5-5" />
            </svg>
          </div>
          <h2 class="text-2xl font-bold text-slate-800 mb-2">採購單建立成功!</h2>
          <p class="text-slate-500 mb-8">單號: <span class="font-mono font-bold text-slate-700">{{ orderResult?.documentNo }}</span></p>
          
          <button @click="continueScan" class="w-full py-4 bg-slate-900 text-white font-bold rounded-2xl shadow-xl hover:scale-105 transition-transform">
            繼續掃描
          </button>
        </div>
      </div>
    </transition>

    <!-- Loading Overlay -->
    <div v-if="loading" class="fixed inset-0 z-50 flex items-center justify-center bg-black/20 backdrop-blur-sm">
      <div class="bg-white p-4 rounded-full shadow-xl">
        <span class="loading loading-spinner loading-md text-emerald-500"></span>
      </div>
    </div>

  </div>
</template>

<style scoped>
/* List Transitions */
.list-enter-active,
.list-leave-active {
  transition: all 0.3s ease;
}
.list-enter-from,
.list-leave-to {
  opacity: 0;
  transform: translateX(-20px);
}
</style>
