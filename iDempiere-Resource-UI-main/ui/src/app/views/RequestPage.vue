<script setup lang="ts">
import type { BPartner } from '../../features/bpartner/api'
import type { RequestStatus, RequestType } from '../../features/request/api'
import { onMounted, ref } from 'vue'
import { useAuth } from '../../features/auth/store'
import { listBPartners } from '../../features/bpartner/api'
import {
  createRequestFromDynamicForm,
  listRequestStatuses,
  listRequestTypes,

} from '../../features/request/api'
import DynamicForm from '../../components/DynamicForm.vue'
import CustomerDetailView from './CustomerDetailView.vue'
import GanttChartView from './GanttChartView.vue'
import KanbanBoardView from './KanbanBoardView.vue'
import MyCustomersView from './MyCustomersView.vue'
import PendingCustomersView from './PendingCustomersView.vue'
import RequestListView from './RequestListView.vue'
import StatisticsView from './StatisticsView.vue'

type TabId = 'list' | 'pending' | 'my' | 'customer' | 'stats' | 'gantt' | 'kanban'

const tabs = [
  { id: 'list' as TabId, label: '所有諮詢單' },
  { id: 'pending' as TabId, label: '待接應' },
  { id: 'my' as TabId, label: '我的客戶' },
  { id: 'customer' as TabId, label: '客戶查詢' },
  { id: 'stats' as TabId, label: '統計' },
  { id: 'gantt' as TabId, label: '甘特圖' },
  { id: 'kanban' as TabId, label: '看板' },
]

const activeTab = ref<TabId>('list')

const auth = useAuth()
const showModal = ref(false)
const customers = ref<BPartner[]>([])
const requestTypes = ref<RequestType[]>([])
const requestStatuses = ref<RequestStatus[]>([])
const dynamicFormRef = ref<InstanceType<typeof DynamicForm>>()

function openModal() {
  showModal.value = true
}

function closeModal() {
  showModal.value = false
}

async function submitDynamicForm(formData: Record<string, unknown>) {
  if (!auth.token.value || !auth.userId.value) {
    alert('無法取得使用者資訊，請重新登入')
    return
  }

  // Set the sales representative to current user
  formData.SalesRep_ID = auth.userId.value

  try {
    await createRequestFromDynamicForm(auth.token.value, formData)
    closeModal()
    window.location.reload()
  }
  catch (e: any) {
    const errorMsg = e?.detail || e?.title || e?.message || '未知錯誤'
    
    // Try to extract missing mandatory fields from error
    if (dynamicFormRef.value && errorMsg.includes('mandatory')) {
      const missingFields = dynamicFormRef.value.getMissingMandatoryFields()
      if (missingFields.length > 0) {
        alert(`建立失敗：缺少必填欄位\n\n${missingFields.join('\n')}\n\n錯誤詳情：${errorMsg}`)
        return
      }
    }
    
    alert(`建立失敗：${errorMsg}`)
  }
}

onMounted(async () => {
  // DynamicForm handles its own data loading
  // No need to pre-load customers, request types, and statuses here
})
</script>

<template>
  <div class="space-y-6">
    <div class="flex items-center justify-between">
      <div class="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <h1 class="text-lg font-semibold">
          諮詢單
        </h1>
        <p class="mt-1 text-sm text-slate-600">
          諮詢師接應客戶使用，一個客戶一個需求開一單。
        </p>
      </div>
      <button
        class="rounded-lg bg-brand-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-brand-700"
        @click="openModal"
      >
        新增諮詢單
      </button>
    </div>

    <!-- Tabs -->
    <div class="rounded-2xl border border-slate-200 bg-white shadow-sm">
      <div class="flex border-b border-slate-200">
        <button
          v-for="tab in tabs"
          :key="tab.id"
          class="px-6 py-3 text-sm font-medium transition-colors"
          :class="activeTab === tab.id
            ? 'border-b-2 border-brand-600 text-brand-600'
            : 'text-slate-600 hover:text-slate-900'"
          @click="activeTab = tab.id"
        >
          {{ tab.label }}
        </button>
      </div>

      <!-- 列表視圖 -->
      <div v-if="activeTab === 'list'" class="p-6">
        <RequestListView />
      </div>

      <!-- 待接應 -->
      <div v-if="activeTab === 'pending'" class="p-6">
        <PendingCustomersView />
      </div>

      <!-- 我的客戶 -->
      <div v-if="activeTab === 'my'" class="p-6">
        <MyCustomersView />
      </div>

      <!-- 客戶查詢 -->
      <div v-if="activeTab === 'customer'" class="p-6">
        <CustomerDetailView />
      </div>

      <!-- 統計 -->
      <div v-if="activeTab === 'stats'" class="p-6">
        <StatisticsView />
      </div>

      <!-- 甘特圖 -->
      <div v-if="activeTab === 'gantt'" class="p-6">
        <GanttChartView />
      </div>

      <!-- 看板 -->
      <div v-if="activeTab === 'kanban'" class="p-6">
        <KanbanBoardView />
      </div>
    </div>

    <!-- Create Request Modal -->
    <Teleport to="body">
      <div
        v-if="showModal"
        class="fixed inset-0 z-50 flex items-center justify-center bg-black/40"
        @click.self="closeModal"
      >
        <div class="w-full max-w-2xl rounded-2xl bg-white p-6 shadow-xl">
          <div class="flex items-center justify-between">
            <h3 class="text-lg font-semibold text-slate-900">
              新增諮詢單
            </h3>
            <button
              class="rounded-full p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
              @click="closeModal"
            >
              <svg class="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          <div class="mt-4">
            <DynamicForm
              ref="dynamicFormRef"
              window-slug="request-consultation"
              tab-slug="request"
              :default-values="{ SalesRep_ID: auth.userId }"
              :exclude-fields="[]"
              submit-label="建立"
              :show-cancel="true"
              :show-help="true"
              @submit="submitDynamicForm"
              @cancel="closeModal"
            />
          </div>
        </div>
      </div>
    </Teleport>
  </div>
</template>
