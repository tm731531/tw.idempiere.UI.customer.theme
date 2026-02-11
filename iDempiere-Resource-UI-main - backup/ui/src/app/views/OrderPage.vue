<script setup lang="ts">
import type { BPartnerLocation } from '../../features/bpartner/api'
import { computed, onMounted, ref, watch } from 'vue'
import { useRoute } from 'vue-router'
import ErrorMessage from '../../components/ErrorMessage.vue'
import Pagination from '../../components/Pagination.vue'
import StatusBadge from '../../components/StatusBadge.vue'
import SuccessMessage from '../../components/SuccessMessage.vue'
import { useAuth } from '../../features/auth/store'
import { listBPartnerLocations, listBPartners } from '../../features/bpartner/api'
import { createOrder, getOrderLines, listOrders, listProducts, listWarehouses } from '../../features/order/api'
import { formatDate, formatMoney } from '../../shared/utils/format'

const route = useRoute()
const auth = useAuth()

const orderType = computed(() => {
  // Determine order type from route path instead of query params
  return route.path === '/sales-order' ? 'sales' : 'purchase'
})

const isPurchase = computed(() => orderType.value === 'purchase')
const title = computed(() => isPurchase.value ? '採購訂單' : '銷售訂單')
const subtitle = computed(() => isPurchase.value ? '採購單' : '銷售單')

const mode = ref<'list' | 'form'>('list')
const editingId = ref<number | null>(null)

const listRecords = ref<any[]>([])
const listLoading = ref(false)
const totalCount = ref(0)
const currentPage = ref(1)
const pageSize = 20
const searchQuery = ref('')

const error = ref<string | null>(null)
const successMessage = ref<string | null>(null)
const submitting = ref(false)

const bpartners = ref<any[]>([])
const products = ref<any[]>([])
const warehouses = ref<any[]>([])
const bpartnerLocations = ref<BPartnerLocation[]>([])
const loadingLocations = ref(false)

const formData = ref({
  bpartnerId: 0,
  bpartnerLocationId: 0,
  warehouseId: 0,
  dateOrdered: new Date().toISOString().split('T')[0],
})

const orderLines = ref<Array<{ productId: number, qtyEntered: number, priceEntered: number, taxId?: number }>>([])
const orderLinesLoading = ref(false)

const totalAmount = computed(() => {
  return orderLines.value.reduce((sum, line) => sum + (line.qtyEntered * line.priceEntered), 0)
})

const hasNextPage = computed(() => {
  return currentPage.value * pageSize < totalCount.value
})

async function loadList() {
  if (!auth.token.value)
    return

  listLoading.value = true
  error.value = null

  try {
    const searchParams: { isSOTrx: boolean, filter?: string, top?: number, skip?: number } = {
      isSOTrx: !isPurchase.value,
      top: pageSize,
      skip: (currentPage.value - 1) * pageSize,
    }

    if (searchQuery.value.trim()) {
      searchParams.filter = `contains(DocumentNo,'${searchQuery.value.trim()}') or contains(C_BPartner_ID/identifier,'${searchQuery.value.trim()}')`
    }

    const result = await listOrders(auth.token.value, searchParams)
    listRecords.value = result.records
    totalCount.value = result.totalCount
  }
  catch (e: any) {
    error.value = e?.detail || e?.title || e?.message || '載入列表失敗'
  }
  finally {
    listLoading.value = false
  }
}

async function loadDropdownData() {
  if (!auth.token.value)
    return

  try {
    const [bpData, prodData, whData] = await Promise.all([
      listBPartners(auth.token.value),
      listProducts(auth.token.value, { top: 100 }),
      listWarehouses(auth.token.value),
    ])

    bpartners.value = bpData.filter(bp => isPurchase.value ? bp.isVendor : bp.isCustomer)
    products.value = prodData
    warehouses.value = whData
  }
  catch (e: any) {
    console.error('Failed to load dropdown data:', e)
  }
}

async function loadBPartnerLocations(bpartnerId: number) {
  if (!auth.token.value || !bpartnerId) {
    bpartnerLocations.value = []
    return
  }

  loadingLocations.value = true
  try {
    const locations = await listBPartnerLocations(auth.token.value, bpartnerId)
    bpartnerLocations.value = locations

    // 如果只有一个地址，自动选择
    if (locations.length === 1 && !formData.value.bpartnerLocationId) {
      formData.value.bpartnerLocationId = locations[0].id
    }
  }
  catch (e: any) {
    console.error('Failed to load bpartner locations:', e)
    bpartnerLocations.value = []
  }
  finally {
    loadingLocations.value = false
  }
}

async function onBPartnerChange() {
  formData.value.bpartnerLocationId = 0
  bpartnerLocations.value = []
  if (formData.value.bpartnerId) {
    await loadBPartnerLocations(formData.value.bpartnerId)
  }
}

function formatLocation(loc: BPartnerLocation): string {
  const parts: string[] = []
  if (loc.address1)
    parts.push(loc.address1)
  if (loc.city)
    parts.push(loc.city)
  if (loc.postalCode)
    parts.push(loc.postalCode)
  return parts.length > 0 ? parts.join(', ') : `地址 #${loc.id}`
}

async function loadOrderLines(orderId: number) {
  if (!auth.token.value)
    return

  orderLinesLoading.value = true
  try {
    const lines = await getOrderLines(auth.token.value, orderId)
    orderLines.value = lines.map(l => ({
      productId: l.productId,
      qtyEntered: l.qtyEntered,
      priceEntered: l.priceEntered,
      taxId: l.taxId,
    }))
  }
  catch (e: any) {
    console.error('Failed to load order lines:', e)
  }
  finally {
    orderLinesLoading.value = false
  }
}

function _prevPage() {
  if (currentPage.value > 1) {
    currentPage.value--
    loadList()
  }
}

function _nextPage() {
  if (hasNextPage.value) {
    currentPage.value++
    loadList()
  }
}

function startCreate() {
  editingId.value = null
  error.value = null
  successMessage.value = null
  orderLines.value = []
  bpartnerLocations.value = []
  formData.value = {
    bpartnerId: 0,
    bpartnerLocationId: 0,
    warehouseId: 0,
    dateOrdered: new Date().toISOString().split('T')[0],
  }
  mode.value = 'form'
}

async function startEdit(record: any) {
  editingId.value = record.id
  error.value = null
  successMessage.value = null

  // 确保下拉数据已加载
  if (bpartners.value.length === 0) {
    await loadDropdownData()
  }

  formData.value = {
    bpartnerId: record.bpartnerId || 0,
    bpartnerLocationId: 0, // 编辑时暂不加载，因为订单已创建
    warehouseId: record.warehouseId || 0,
    dateOrdered: record.dateOrdered?.split('T')[0] || new Date().toISOString().split('T')[0],
  }

  // 如果有业务伙伴ID，加载其地址列表
  if (formData.value.bpartnerId) {
    await loadBPartnerLocations(formData.value.bpartnerId)
  }

  await loadOrderLines(record.id)
  mode.value = 'form'
}

function backToList() {
  mode.value = 'list'
  editingId.value = null
  error.value = null
  loadList()
}

function addLine() {
  orderLines.value.push({
    productId: 0,
    qtyEntered: 1,
    priceEntered: 0,
  })
}

function removeLine(index: number) {
  orderLines.value.splice(index, 1)
}

function updateLineTotal(_index: number) {
}

async function handleSubmit() {
  if (!auth.token.value) {
    error.value = '尚未登入'
    return
  }

  if (!formData.value.bpartnerId) {
    error.value = isPurchase.value ? '請選擇供應商' : '請選擇客戶'
    return
  }

  if (!formData.value.bpartnerLocationId) {
    error.value = isPurchase.value ? '請選擇供應商地址' : '請選擇客戶地址'
    return
  }

  if (!formData.value.warehouseId) {
    error.value = isPurchase.value ? '請選擇入庫倉' : '請選擇出庫倉'
    return
  }

  if (orderLines.value.length === 0) {
    error.value = '請至少新增一筆商品明細'
    return
  }

  for (let i = 0; i < orderLines.value.length; i++) {
    const line = orderLines.value[i]
    if (!line.productId) {
      error.value = `第 ${i + 1} 筆明細：請選擇商品`
      return
    }
    if (line.qtyEntered <= 0) {
      error.value = `第 ${i + 1} 筆明細：數量必須大於 0`
      return
    }
    if (line.priceEntered < 0) {
      error.value = `第 ${i + 1} 筆明細：單價不能為負數`
      return
    }
  }

  error.value = null
  submitting.value = true

  try {
    // 确保所有ID和数值字段都是数字类型
    // 使用严格的数值转换，移除任何非数字字符
    const parseId = (val: any): number => {
      if (!val)
        return 0
      if (typeof val === 'number')
        return Number.isNaN(val) ? 0 : Math.floor(Math.abs(val))
      if (typeof val === 'string') {
        const cleaned = val.replace(/\D/g, '')
        const num = cleaned ? Number.parseInt(cleaned, 10) : 0
        return Number.isNaN(num) ? 0 : num
      }
      return 0
    }

    const parseNumber = (val: any): number => {
      if (val === undefined || val === null || val === '')
        return 0
      if (typeof val === 'number')
        return Number.isNaN(val) ? 0 : val
      if (typeof val === 'string') {
        const cleaned = val.replace(/[^\d.-]/g, '')
        const num = cleaned ? Number.parseFloat(cleaned) : 0
        return Number.isNaN(num) ? 0 : num
      }
      return 0
    }

    const bpartnerId = parseId(formData.value.bpartnerId)
    const warehouseId = parseId(formData.value.warehouseId)

    if (!bpartnerId || bpartnerId <= 0) {
      error.value = isPurchase.value ? '請選擇有效的供應商' : '請選擇有效的客戶'
      submitting.value = false
      return
    }

    if (!warehouseId || warehouseId <= 0) {
      error.value = isPurchase.value ? '請選擇有效的入庫倉' : '請選擇有效的出庫倉'
      submitting.value = false
      return
    }

    // 清理订单行数据，确保所有数值都是正确的类型
    const cleanedLines = orderLines.value.map(line => ({
      productId: parseId(line.productId),
      qtyEntered: parseNumber(line.qtyEntered),
      priceEntered: parseNumber(line.priceEntered),
      taxId: line.taxId ? parseId(line.taxId) : undefined,
    }))

    const bpartnerLocationId = parseId(formData.value.bpartnerLocationId)
    if (!bpartnerLocationId || bpartnerLocationId <= 0) {
      error.value = isPurchase.value ? '請選擇有效的供應商地址' : '請選擇有效的客戶地址'
      submitting.value = false
      return
    }

    // 获取组织ID：优先使用用户的组织，如果是0则从仓库获取
    let orgId = auth.organizationId.value ?? 0
    if (!orgId || orgId <= 0) {
      // 从选中的仓库获取组织ID
      const selectedWarehouse = warehouses.value.find(w => w.id === warehouseId)
      orgId = selectedWarehouse?.orgId ?? 0
    }

    await createOrder(auth.token.value, {
      bpartnerId,
      isSOTrx: !isPurchase.value,
      dateOrdered: formData.value.dateOrdered,
      warehouseId, // 销售订单和采购订单都需要仓库
      bpartnerLocationId, // 业务伙伴收货地点
      orgId, // AD_Org_ID 组织ID (从用户或仓库获取)
    }, cleanedLines)

    successMessage.value = isPurchase.value ? '採購訂單已建立' : '銷售訂單已建立'

    setTimeout(() => {
      backToList()
    }, 1000)
  }
  catch (e: any) {
    error.value = e?.detail || e?.title || e?.message || '開單失敗'
  }
  finally {
    submitting.value = false
  }
}

watch(() => route.path, () => {
  loadList()
  loadDropdownData()
})

onMounted(() => {
  loadList()
  loadDropdownData()
})
</script>

<template>
  <div class="space-y-6">
    <div class="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
      <div class="flex items-center justify-between">
        <div>
          <h1 class="text-lg font-semibold">
            {{ title }}
          </h1>
          <p class="mt-1 text-sm text-slate-600">
            {{ mode === 'list' ? `查看和管理${subtitle}` : (editingId ? '編輯訂單' : `建立${subtitle}`) }}
          </p>
        </div>
        <div class="flex gap-2">
          <button
            v-if="mode === 'form'"
            type="button"
            class="rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
            @click="backToList"
          >
            返回列表
          </button>
          <button
            v-if="mode === 'list'"
            type="button"
            class="rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-700"
            @click="startCreate"
          >
            新增
          </button>
        </div>
      </div>
    </div>

    <ErrorMessage :message="error" />
    <SuccessMessage :message="successMessage" />

    <div v-if="mode === 'list'" class="rounded-2xl border border-slate-200 bg-white shadow-sm">
      <div class="border-b border-slate-200 p-4">
        <div class="flex gap-2">
          <input
            v-model="searchQuery"
            type="text"
            placeholder="搜尋單號或客戶/供應商..."
            class="flex-1 rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-brand-500 focus:ring-1 focus:ring-brand-500"
            @keyup.enter="loadList"
          >
          <button
            type="button"
            class="rounded-lg bg-slate-100 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-200"
            @click="loadList"
          >
            搜尋
          </button>
        </div>
      </div>

      <div class="overflow-x-auto">
        <table class="w-full text-sm">
          <thead class="bg-slate-50 text-left text-xs font-medium uppercase text-slate-500">
            <tr>
              <th class="px-4 py-3">
                單號
              </th>
              <th class="px-4 py-3">
                {{ isPurchase ? '供應商' : '客戶' }}
              </th>
              <th class="px-4 py-3">
                日期
              </th>
              <th class="px-4 py-3">
                金額
              </th>
              <th class="px-4 py-3">
                狀態
              </th>
              <th class="px-4 py-3">
                操作
              </th>
            </tr>
          </thead>
          <tbody class="divide-y divide-slate-200">
            <tr v-if="listLoading">
              <td :colspan="isPurchase ? 6 : 5" class="px-4 py-8 text-center text-slate-500">
                載入中...
              </td>
            </tr>
            <tr v-else-if="listRecords.length === 0">
              <td :colspan="isPurchase ? 6 : 5" class="px-4 py-8 text-center text-slate-500">
                無資料
              </td>
            </tr>
            <tr
              v-for="record in listRecords"
              :key="record.id"
              class="hover:bg-slate-50 cursor-pointer"
              @click="startEdit(record)"
            >
              <td class="px-4 py-3 font-medium text-slate-900">
                {{ record.documentNo }}
              </td>
              <td class="px-4 py-3 text-slate-600">
                {{ record.bpartnerName }}
              </td>
              <td class="px-4 py-3 text-slate-600">
                {{ formatDate(record.dateOrdered) }}
              </td>
              <td class="px-4 py-3 text-slate-600">
                {{ formatMoney(record.grandTotal) }}
              </td>
              <td class="px-4 py-3">
                <StatusBadge :status="record.docStatus" type="doc" />
              </td>
              <td class="px-4 py-3">
                <button
                  type="button"
                  class="text-brand-600 hover:text-brand-700 font-medium"
                  @click.stop="startEdit(record)"
                >
                  查看詳情
                </button>
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <Pagination
        :current-page="currentPage"
        :total-count="totalCount"
        :page-size="pageSize"
        @update:current-page="currentPage = $event; loadList()"
      />
    </div>

    <div v-if="mode === 'form'" class="space-y-6">
      <div class="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <h2 class="text-base font-semibold mb-4">
          訂單資訊
        </h2>
        <div class="grid grid-cols-2 gap-4">
          <div>
            <label class="block text-sm font-medium text-slate-700 mb-1">{{ isPurchase ? '供應商' : '客戶' }} <span class="text-rose-500">*</span></label>
            <select
              v-model="formData.bpartnerId"
              class="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-brand-500 focus:ring-1 focus:ring-brand-500"
              :disabled="!!editingId"
              @change="onBPartnerChange"
            >
              <option value="">
                請選擇...
              </option>
              <option v-for="bp in bpartners" :key="bp.id" :value="bp.id">
                {{ bp.name }}
              </option>
            </select>
          </div>
          <div v-if="formData.bpartnerId">
            <label class="block text-sm font-medium text-slate-700 mb-1">{{ isPurchase ? '供應商地址' : '客戶地址' }} <span class="text-rose-500">*</span></label>
            <select
              v-model="formData.bpartnerLocationId"
              class="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-brand-500 focus:ring-1 focus:ring-brand-500"
              :disabled="!!editingId || loadingLocations"
            >
              <option value="">
                {{ loadingLocations ? '載入中...' : '請選擇...' }}
              </option>
              <option v-for="loc in bpartnerLocations" :key="loc.id" :value="loc.id">
                {{ formatLocation(loc) }}
              </option>
            </select>
            <p v-if="bpartnerLocations.length === 0 && !loadingLocations && formData.bpartnerId" class="mt-1 text-xs text-amber-600">
              此{{ isPurchase ? '供應商' : '客戶' }}沒有設定地址，請先在業務夥伴管理中新增地址
            </p>
          </div>
          <div>
            <label class="block text-sm font-medium text-slate-700 mb-1">{{ isPurchase ? '入庫倉' : '出庫倉' }} <span class="text-rose-500">*</span></label>
            <select
              v-model="formData.warehouseId"
              class="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-brand-500 focus:ring-1 focus:ring-brand-500"
            >
              <option value="">
                請選擇...
              </option>
              <option v-for="wh in warehouses" :key="wh.id" :value="wh.id">
                {{ wh.name }}
              </option>
            </select>
          </div>
          <div>
            <label class="block text-sm font-medium text-slate-700 mb-1">訂單日期 <span class="text-rose-500">*</span></label>
            <input
              v-model="formData.dateOrdered"
              type="date"
              class="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-brand-500 focus:ring-1 focus:ring-brand-500"
            >
          </div>
        </div>
      </div>

      <div class="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <div class="flex items-center justify-between mb-4">
          <h2 class="text-base font-semibold">
            商品明細
          </h2>
          <button
            v-if="!editingId"
            type="button"
            class="rounded-lg bg-brand-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-brand-700"
            @click="addLine"
          >
            新增明細
          </button>
        </div>

        <div v-if="editingId && orderLinesLoading" class="py-8 text-center text-slate-500">
          載入明細中...
        </div>
        <div v-else-if="orderLines.length === 0" class="py-8 text-center text-slate-500">
          無明細
        </div>
        <div v-else class="space-y-3">
          <div v-for="(line, index) in orderLines" :key="index" class="border border-slate-200 rounded-lg p-4">
            <div class="grid grid-cols-12 gap-3 items-center">
              <div class="col-span-4">
                <label class="block text-xs font-medium text-slate-700 mb-1">商品</label>
                <select
                  v-model="line.productId"
                  class="w-full rounded-lg border border-slate-300 px-3 py-1.5 text-sm focus:border-brand-500 focus:ring-1 focus:ring-brand-500"
                  :disabled="!!editingId"
                  @change="updateLineTotal(index)"
                >
                  <option value="">
                    請選擇...
                  </option>
                  <option v-for="p in products" :key="p.id" :value="p.id">
                    {{ p.name }}
                  </option>
                </select>
              </div>
              <div class="col-span-2">
                <label class="block text-xs font-medium text-slate-700 mb-1">數量</label>
                <input
                  v-model.number="line.qtyEntered"
                  type="number"
                  min="1"
                  step="1"
                  class="w-full rounded-lg border border-slate-300 px-3 py-1.5 text-sm focus:border-brand-500 focus:ring-1 focus:ring-brand-500"
                  :disabled="!!editingId"
                  @input="updateLineTotal(index)"
                >
              </div>
              <div class="col-span-3">
                <label class="block text-xs font-medium text-slate-700 mb-1">單價</label>
                <input
                  v-model.number="line.priceEntered"
                  type="number"
                  min="0"
                  step="0.01"
                  class="w-full rounded-lg border border-slate-300 px-3 py-1.5 text-sm focus:border-brand-500 focus:ring-1 focus:ring-brand-500"
                  :disabled="!!editingId"
                  @input="updateLineTotal(index)"
                >
              </div>
              <div class="col-span-2">
                <label class="block text-xs font-medium text-slate-700 mb-1">小計</label>
                <input
                  :value="formatMoney(line.qtyEntered * line.priceEntered)"
                  type="text"
                  class="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-1.5 text-sm text-slate-600"
                  readonly
                >
              </div>
              <div class="col-span-1 text-center">
                <button
                  v-if="!editingId"
                  type="button"
                  class="text-rose-600 hover:text-rose-700"
                  @click="removeLine(index)"
                >
                  刪除
                </button>
              </div>
            </div>
          </div>
        </div>

        <div v-if="!editingId" class="mt-4 flex justify-between items-center text-sm">
          <div />
          <div class="space-y-1 text-right">
            <div class="text-slate-600">
              總計：{{ formatMoney(totalAmount) }}
            </div>
          </div>
        </div>
      </div>

      <div v-if="!editingId" class="flex justify-end gap-2">
        <button
          type="button"
          class="rounded-lg border border-slate-200 bg-white px-6 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
          @click="backToList"
        >
          取消
        </button>
        <button
          type="button"
          class="rounded-lg bg-brand-600 px-6 py-2 text-sm font-medium text-white hover:bg-brand-700"
          :disabled="submitting"
          @click="handleSubmit"
        >
          {{ submitting ? '儲存中...' : '完成開單' }}
        </button>
      </div>
    </div>
  </div>
</template>
