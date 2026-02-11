<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import ErrorMessage from '../../components/ErrorMessage.vue'
import StatusBadge from '../../components/StatusBadge.vue'
import SuccessMessage from '../../components/SuccessMessage.vue'
import { useAuth } from '../../features/auth/store'
import { getOrderLines } from '../../features/order/api'
import { createProduction, getOrdersForProduction, getProductionLines, listProductions, updateProduction } from '../../features/production/api'
import { formatDate, formatMoney } from '../../shared/utils/format'

const auth = useAuth()

const mode = ref<'list' | 'create' | 'detail'>('list')
const activeTab = ref<'pending' | 'created'>('pending')

const pendingOrders = ref<any[]>([])
const createdProductions = ref<any[]>([])
const listLoading = ref(false)
const totalCount = ref(0)
const currentPage = ref(1)
const pageSize = 20
const searchQuery = ref('')

const error = ref<string | null>(null)
const successMessage = ref<string | null>(null)
const submitting = ref(false)
const completing = ref(false)

const selectedOrder = ref<any>(null)
const orderLines = ref<any[]>([])
const orderLinesLoading = ref(false)
const selectedLineIndices = ref<number[]>([])
const datePromised = ref(new Date().toISOString().split('T')[0])

const currentProduction = ref<any>(null)
const productionLines = ref<any[]>([])
const productionLinesLoading = ref(false)

const hasNextPage = computed(() => {
  return currentPage.value * pageSize < totalCount.value
})

async function loadList() {
  if (!auth.token.value)
    return

  listLoading.value = true
  error.value = null

  try {
    if (activeTab.value === 'pending') {
      const filter = searchQuery.value.trim()
        ? `contains(DocumentNo,'${searchQuery.value.trim()}') or contains(C_BPartner_ID/identifier,'${searchQuery.value.trim()}')`
        : undefined

      const orders = await getOrdersForProduction(auth.token.value, {
        filter,
        top: pageSize,
        skip: (currentPage.value - 1) * pageSize,
      })

      pendingOrders.value = orders
      totalCount.value = orders.length
    }
    else {
      const filter = searchQuery.value.trim()
        ? `contains(DocumentNo,'${searchQuery.value.trim()}') or contains(C_BPartner_ID/identifier,'${searchQuery.value.trim()}')`
        : undefined

      const result = await listProductions(auth.token.value, {
        filter,
        top: pageSize,
        skip: (currentPage.value - 1) * pageSize,
      })

      createdProductions.value = result.records
      totalCount.value = result.totalCount
    }
  }
  catch (e: any) {
    error.value = e?.detail || e?.title || e?.message || '載入列表失敗'
  }
  finally {
    listLoading.value = false
  }
}

function prevPage() {
  if (currentPage.value > 1) {
    currentPage.value--
    loadList()
  }
}

function nextPage() {
  if (hasNextPage.value) {
    currentPage.value++
    loadList()
  }
}

async function startCreateFromOrder(order: any) {
  selectedOrder.value = order
  selectedLineIndices.value = []
  datePromised.value = new Date().toISOString().split('T')[0]
  error.value = null
  successMessage.value = null

  orderLinesLoading.value = true
  mode.value = 'create'

  try {
    const lines = await getOrderLines(auth.token.value, order.id)
    orderLines.value = lines
  }
  catch (e: any) {
    error.value = e?.detail || e?.title || e?.message || '載入訂單明細失敗'
  }
  finally {
    orderLinesLoading.value = false
  }
}

async function handleCreateProduction() {
  if (!auth.token.value || !selectedOrder.value)
    return

  if (selectedLineIndices.value.length === 0) {
    error.value = '請至少選擇一筆明細'
    return
  }

  if (!datePromised.value) {
    error.value = '請選擇預計執行日期'
    return
  }

  error.value = null
  submitting.value = true

  try {
    for (const index of selectedLineIndices.value) {
      const line = orderLines.value[index]

      await createProduction(
        auth.token.value,
        {
          orderId: selectedOrder.value.id,
          orderLineId: line.id,
          bpartnerId: selectedOrder.value.C_BPartner_ID.id,
          productId: line.M_Product_ID.id,
          productionQty: line.QtyEntered,
          datePromised: datePromised.value,
        },
        [
          {
            productId: line.M_Product_ID.id,
            movementQty: line.QtyEntered,
            isEndProduct: true,
          },
        ],
      )
    }

    successMessage.value = '療程單已建立'

    setTimeout(() => {
      backToList()
    }, 1000)
  }
  catch (e: any) {
    error.value = e?.detail || e?.title || e?.message || '建立療程單失敗'
  }
  finally {
    submitting.value = false
  }
}

async function viewProductionDetail(production: any) {
  currentProduction.value = production
  productionLines.value = []
  error.value = null
  successMessage.value = null

  productionLinesLoading.value = true
  mode.value = 'detail'

  try {
    const lines = await getProductionLines(auth.token.value, production.id)
    productionLines.value = lines
  }
  catch (e: any) {
    error.value = e?.detail || e?.title || e?.message || '載入療程明細失敗'
  }
  finally {
    productionLinesLoading.value = false
  }
}

async function handleCompleteProduction() {
  if (!auth.token.value || !currentProduction.value)
    return

  error.value = null
  completing.value = true

  try {
    await updateProduction(auth.token.value, currentProduction.value.id, {
      processed: true,
    })

    successMessage.value = '療程已完成'

    currentProduction.value.processed = true

    setTimeout(() => {
      backToList()
    }, 1000)
  }
  catch (e: any) {
    error.value = e?.detail || e?.title || e?.message || '完成療程失敗'
  }
  finally {
    completing.value = false
  }
}

function backToList() {
  mode.value = 'list'
  selectedOrder.value = null
  selectedLineIndices.value = []
  currentProduction.value = null
  error.value = null
  successMessage.value = null
  loadList()
}

function getDocStatus(order: any): string {
  return order.DocStatus?.id ?? order.DocStatus ?? ''
}

watch(activeTab, () => {
  currentPage.value = 1
  loadList()
})

onMounted(() => {
  loadList()
})
</script>

<template>
  <div class="space-y-6">
    <div class="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
      <div class="flex items-center justify-between">
        <div>
          <h1 class="text-lg font-semibold">
            療程單
          </h1>
          <p class="mt-1 text-sm text-slate-600">
            管理療程執行紀錄
          </p>
        </div>
      </div>
    </div>

    <ErrorMessage :message="error" />
    <SuccessMessage :message="successMessage" />

    <div v-if="mode === 'list'" class="rounded-2xl border border-slate-200 bg-white shadow-sm">
      <div class="border-b border-slate-200 p-4">
        <div class="flex items-center gap-4 mb-4">
          <button
            type="button"
            :class="activeTab === 'pending' ? 'text-brand-600 border-brand-600' : 'text-slate-600 border-transparent hover:border-slate-300'"
            class="border-b-2 px-1 py-2 text-sm font-medium transition-colors"
            @click="activeTab = 'pending'"
          >
            待轉療程
          </button>
          <button
            type="button"
            :class="activeTab === 'created' ? 'text-brand-600 border-brand-600' : 'text-slate-600 border-transparent hover:border-slate-300'"
            class="border-b-2 px-1 py-2 text-sm font-medium transition-colors"
            @click="activeTab = 'created'"
          >
            已創建療程
          </button>
        </div>

        <div class="flex gap-2">
          <input
            v-model="searchQuery"
            type="text"
            :placeholder="activeTab === 'pending' ? '搜尋單號或客戶...' : '搜尋療程單號或客戶...'"
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
        <table v-if="activeTab === 'pending'" class="w-full text-sm">
          <thead class="bg-slate-50 text-left text-xs font-medium uppercase text-slate-500">
            <tr>
              <th class="px-4 py-3">
                銷售單號
              </th>
              <th class="px-4 py-3">
                客戶
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
              <td colspan="6" class="px-4 py-8 text-center text-slate-500">
                載入中...
              </td>
            </tr>
            <tr v-else-if="pendingOrders.length === 0">
              <td colspan="6" class="px-4 py-8 text-center text-slate-500">
                無待轉療程
              </td>
            </tr>
            <tr
              v-for="order in pendingOrders"
              :key="order.id"
              class="hover:bg-slate-50 cursor-pointer"
            >
              <td class="px-4 py-3 font-medium text-slate-900">
                {{ order.DocumentNo }}
              </td>
              <td class="px-4 py-3 text-slate-600">
                {{ order.C_BPartner_ID?.identifier || order.bpartnerName }}
              </td>
              <td class="px-4 py-3 text-slate-600">
                {{ formatDate(order.DateOrdered) }}
              </td>
              <td class="px-4 py-3 text-slate-600">
                {{ formatMoney(order.GrandTotal) }}
              </td>
              <td class="px-4 py-3">
                <StatusBadge :status="getDocStatus(order)" type="doc" />
              </td>
              <td class="px-4 py-3">
                <button
                  type="button"
                  class="text-brand-600 hover:text-brand-700 font-medium"
                  @click="startCreateFromOrder(order)"
                >
                  轉療程
                </button>
              </td>
            </tr>
          </tbody>
        </table>

        <table v-else class="w-full text-sm">
          <thead class="bg-slate-50 text-left text-xs font-medium uppercase text-slate-500">
            <tr>
              <th class="px-4 py-3">
                療程單號
              </th>
              <th class="px-4 py-3">
                客戶
              </th>
              <th class="px-4 py-3">
                商品
              </th>
              <th class="px-4 py-3">
                數量
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
              <td colspan="6" class="px-4 py-8 text-center text-slate-500">
                載入中...
              </td>
            </tr>
            <tr v-else-if="createdProductions.length === 0">
              <td colspan="6" class="px-4 py-8 text-center text-slate-500">
                無療程單
              </td>
            </tr>
            <tr
              v-for="prod in createdProductions"
              :key="prod.id"
              class="hover:bg-slate-50 cursor-pointer"
              @click="viewProductionDetail(prod)"
            >
              <td class="px-4 py-3 font-medium text-slate-900">
                {{ prod.documentNo }}
              </td>
              <td class="px-4 py-3 text-slate-600">
                {{ prod.bpartnerName }}
              </td>
              <td class="px-4 py-3 text-slate-600">
                {{ prod.productName }}
              </td>
              <td class="px-4 py-3 text-slate-600">
                {{ prod.productionQty }}
              </td>
              <td class="px-4 py-3">
                <span
                  :class="prod.processed ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'"
                  class="inline-flex rounded-full px-2 py-0.5 text-xs font-medium"
                >
                  {{ prod.processed ? '已完成' : '執行中' }}
                </span>
              </td>
              <td class="px-4 py-3">
                <button
                  type="button"
                  class="text-brand-600 hover:text-brand-700 font-medium"
                  @click.stop="viewProductionDetail(prod)"
                >
                  查看詳情
                </button>
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <div class="flex items-center justify-between border-t border-slate-200 px-4 py-3">
        <div class="text-sm text-slate-600">
          共 {{ totalCount }} 筆
        </div>
        <div class="flex gap-2">
          <button
            type="button"
            :disabled="currentPage <= 1"
            class="rounded-lg border border-slate-200 px-3 py-1 text-sm disabled:opacity-50"
            @click="prevPage"
          >
            上一頁
          </button>
          <span class="px-3 py-1 text-sm text-slate-600">第 {{ currentPage }} 頁</span>
          <button
            type="button"
            :disabled="!hasNextPage"
            class="rounded-lg border border-slate-200 px-3 py-1 text-sm disabled:opacity-50"
            @click="nextPage"
          >
            下一頁
          </button>
        </div>
      </div>
    </div>

    <div v-if="mode === 'create'" class="space-y-6">
      <div class="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <div class="flex items-center justify-between mb-4">
          <h2 class="text-base font-semibold">
            從銷售訂單創建療程單
          </h2>
          <button
            type="button"
            class="rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
            @click="backToList"
          >
            返回列表
          </button>
        </div>

        <div class="border border-slate-200 rounded-lg p-4 mb-4">
          <h3 class="text-sm font-medium text-slate-700 mb-3">
            銷售訂單資訊
          </h3>
          <div class="grid grid-cols-3 gap-4 text-sm">
            <div>
              <span class="text-slate-500">單號：</span>
              <span class="font-medium text-slate-900">{{ selectedOrder?.DocumentNo }}</span>
            </div>
            <div>
              <span class="text-slate-500">客戶：</span>
              <span class="font-medium text-slate-900">{{ selectedOrder?.C_BPartner_ID?.identifier }}</span>
            </div>
            <div>
              <span class="text-slate-500">日期：</span>
              <span class="font-medium text-slate-900">{{ formatDate(selectedOrder?.DateOrdered) }}</span>
            </div>
          </div>
        </div>

        <div v-if="orderLinesLoading" class="py-8 text-center text-slate-500">
          載入訂單明細中...
        </div>
        <div v-else-if="orderLines.length === 0" class="py-8 text-center text-slate-500">
          無訂單明細
        </div>
        <div v-else class="space-y-3">
          <h3 class="text-sm font-medium text-slate-700">
            選擇要轉療程的明細
          </h3>
          <div v-for="(line, index) in orderLines" :key="index" class="border border-slate-200 rounded-lg p-4">
            <div class="flex items-center gap-4">
              <input
                :id="`line-${index}`"
                v-model="selectedLineIndices"
                :value="index"
                type="checkbox"
                class="h-4 w-4 rounded border-slate-300 text-brand-600 focus:ring-brand-500"
              >
              <label :for="`line-${index}`" class="flex-1 cursor-pointer">
                <div class="text-sm font-medium text-slate-900">{{ line.M_Product_ID?.identifier || line.productName }}</div>
                <div class="text-xs text-slate-500 mt-1">
                  數量：{{ line.QtyEntered || line.qtyEntered }} | 單價：{{ formatMoney(line.PriceEntered || line.priceEntered) }}
                </div>
              </label>
            </div>
          </div>
        </div>

        <div v-if="selectedLineIndices.length > 0" class="mt-6">
          <h3 class="text-sm font-medium text-slate-700 mb-3">
            預計執行日期
          </h3>
          <input
            v-model="datePromised"
            type="date"
            class="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-brand-500 focus:ring-1 focus:ring-brand-500"
          >
        </div>

        <div v-if="selectedLineIndices.length > 0" class="mt-6 flex justify-end gap-2">
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
            @click="handleCreateProduction"
          >
            {{ submitting ? '建立中...' : '建立療程單' }}
          </button>
        </div>
      </div>
    </div>

    <div v-if="mode === 'detail'" class="space-y-6">
      <div class="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <div class="flex items-center justify-between mb-4">
          <h2 class="text-base font-semibold">
            療程單詳情
          </h2>
          <button
            type="button"
            class="rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
            @click="backToList"
          >
            返回列表
          </button>
        </div>

        <div class="border border-slate-200 rounded-lg p-4 mb-4">
          <h3 class="text-sm font-medium text-slate-700 mb-3">
            療程單資訊
          </h3>
          <div class="grid grid-cols-4 gap-4 text-sm">
            <div>
              <span class="text-slate-500">療程單號：</span>
              <span class="font-medium text-slate-900">{{ currentProduction?.documentNo }}</span>
            </div>
            <div>
              <span class="text-slate-500">客戶：</span>
              <span class="font-medium text-slate-900">{{ currentProduction?.bpartnerName }}</span>
            </div>
            <div>
              <span class="text-slate-500">預計日期：</span>
              <span class="font-medium text-slate-900">{{ formatDate(currentProduction?.datePromised) }}</span>
            </div>
            <div>
              <span class="text-slate-500">狀態：</span>
              <span
                :class="currentProduction?.processed ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'"
                class="inline-flex rounded-full px-2 py-0.5 text-xs font-medium"
              >
                {{ currentProduction?.processed ? '已完成' : '執行中' }}
              </span>
            </div>
          </div>
        </div>

        <div v-if="productionLinesLoading" class="py-8 text-center text-slate-500">
          載入療程明細中...
        </div>
        <div v-else-if="productionLines.length === 0" class="py-8 text-center text-slate-500">
          無療程明細
        </div>
        <div v-else>
          <h3 class="text-sm font-medium text-slate-700 mb-3">
            療程明細
          </h3>
          <div class="border border-slate-200 rounded-lg overflow-hidden">
            <table class="w-full text-sm">
              <thead class="bg-slate-50 text-left text-xs font-medium uppercase text-slate-500">
                <tr>
                  <th class="px-4 py-3">
                    商品
                  </th>
                  <th class="px-4 py-3">
                    數量
                  </th>
                  <th class="px-4 py-3">
                    類型
                  </th>
                </tr>
              </thead>
              <tbody class="divide-y divide-slate-200">
                <tr v-for="line in productionLines" :key="line.id">
                  <td class="px-4 py-3 text-slate-900">
                    {{ line.productName }}
                  </td>
                  <td class="px-4 py-3 text-slate-600">
                    {{ line.movementQty }}
                  </td>
                  <td class="px-4 py-3">
                    <span
                      :class="line.isEndProduct ? 'bg-blue-100 text-blue-700' : 'bg-slate-100 text-slate-500'"
                      class="inline-flex rounded-full px-2 py-0.5 text-xs font-medium"
                    >
                      {{ line.isEndProduct ? '成品' : '耗材' }}
                    </span>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        <div v-if="!currentProduction?.processed" class="mt-6 flex justify-end">
          <button
            type="button"
            class="rounded-lg bg-brand-600 px-6 py-2 text-sm font-medium text-white hover:bg-brand-700"
            :disabled="completing"
            @click="handleCompleteProduction"
          >
            {{ completing ? '處理中...' : '完成療程' }}
          </button>
        </div>
      </div>
    </div>
  </div>
</template>
