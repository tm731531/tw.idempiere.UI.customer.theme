<script setup lang="ts">
import type { Request, RequestStatus, RequestType } from '../../features/request/api'
import { onMounted, ref } from 'vue'
import ErrorMessage from '../../components/ErrorMessage.vue'
import { useAuth } from '../../features/auth/store'
import {
  createRequest,
  getPendingCustomers,
  getUnassignedRequests,
  listRequestStatuses,
  listRequestTypes,
  updateRequest,
} from '../../features/request/api'

const auth = useAuth()

const customers = ref<{ id: number, name: string }[]>([])
const unassignedRequests = ref<Request[]>([])
const requestTypes = ref<RequestType[]>([])
const requestStatuses = ref<RequestStatus[]>([])
const loading = ref(false)
const submitting = ref(false)
const error = ref<string | null>(null)

const showModal = ref(false)
const selectedCustomer = ref<{ id: number, name: string } | null>(null)

const form = ref({
  name: '',
  description: '',
  requestTypeId: undefined as number | undefined,
  requestStatusId: undefined as number | undefined,
  startDate: '' as string,
  closeDate: '' as string,
})

async function loadData() {
  if (!auth.token.value)
    return

  loading.value = true
  error.value = null

  try {
    const [customersResult, unassignedResult] = await Promise.all([
      getPendingCustomers(auth.token.value),
      getUnassignedRequests(auth.token.value),
    ])
    customers.value = customersResult
    unassignedRequests.value = unassignedResult
  }
  catch (e: any) {
    error.value = e?.detail || e?.title || e?.message || '載入失敗'
  }
  finally {
    loading.value = false
  }
}

// 接手未分配的諮詢單
async function claimRequest(request: Request) {
  if (!auth.token.value || !auth.userId.value)
    return

  submitting.value = true
  error.value = null

  try {
    await updateRequest(auth.token.value, request.id, {
      salesRepId: auth.userId.value,
    })
    await loadData()
  }
  catch (e: any) {
    error.value = e?.detail || e?.title || e?.message || '接手失敗'
  }
  finally {
    submitting.value = false
  }
}

function formatDate(dateStr?: string): string {
  if (!dateStr)
    return '—'
  const d = new Date(dateStr)
  return `${d.getMonth() + 1}/${d.getDate()}`
}

function openNewRequest(customer: { id: number, name: string }) {
  selectedCustomer.value = customer
  form.value = {
    name: '',
    description: '',
    requestTypeId: undefined,
    requestStatusId: undefined,
    startDate: '',
    closeDate: '',
  }
  showModal.value = true
}

function closeModal() {
  showModal.value = false
  selectedCustomer.value = null
  form.value = {
    name: '',
    description: '',
    requestTypeId: undefined,
    requestStatusId: undefined,
    startDate: '',
    closeDate: '',
  }
}

async function submitRequest() {
  if (!auth.token.value || !selectedCustomer.value || !form.value.name.trim())
    return
  if (!auth.userId.value) {
    error.value = '無法取得使用者資訊，請重新登入'
    return
  }

  submitting.value = true
  error.value = null

  try {
    await createRequest(auth.token.value, {
      bPartnerId: selectedCustomer.value.id,
      salesRepId: auth.userId.value, // 使用當前登入使用者作為諮詢師
      name: form.value.name.trim(),
      description: form.value.description || undefined,
      requestTypeId: form.value.requestTypeId,
      requestStatusId: form.value.requestStatusId,
      startDate: form.value.startDate ? new Date(form.value.startDate) : undefined,
      closeDate: form.value.closeDate ? new Date(form.value.closeDate) : undefined,
    })

    closeModal()
    await loadData()
  }
  catch (e: any) {
    error.value = e?.detail || e?.title || e?.message || '建立失敗'
  }
  finally {
    submitting.value = false
  }
}

onMounted(async () => {
  if (!auth.token.value)
    return

  try {
    requestTypes.value = await listRequestTypes(auth.token.value)
    requestStatuses.value = await listRequestStatuses(auth.token.value)
  }
  catch (e) {
    console.error('Failed to load request types/statuses:', e)
  }

  await loadData()
})
</script>

<template>
  <div class="space-y-4">
    <div class="flex items-center justify-between">
      <h2 class="text-base font-semibold text-slate-900">
        從未諮詢的客戶
      </h2>
      <button
        class="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
        :disabled="loading"
        @click="loadData"
      >
        {{ loading ? '載入中…' : '重新整理' }}
      </button>
    </div>

    <ErrorMessage :message="error" />

    <!-- Customer List -->
    <div class="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
      <div
        v-for="customer in customers"
        :key="customer.id"
        class="rounded-lg border border-slate-200 bg-white p-4 shadow-sm hover:shadow-md transition-shadow cursor-pointer"
        @click="openNewRequest(customer)"
      >
        <div class="flex items-start justify-between">
          <div class="flex-1">
            <h3 class="font-medium text-slate-900">
              {{ customer.name }}
            </h3>
            <p class="mt-1 text-xs text-slate-500">
              點擊建立諮詢單
            </p>
          </div>
          <button
            class="rounded-full bg-brand-600 p-1.5 text-white hover:bg-brand-700"
            @click.stop="openNewRequest(customer)"
          >
            <svg class="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4" />
            </svg>
          </button>
        </div>
      </div>
    </div>

    <!-- Empty State for customers -->
    <div v-if="!loading && customers.length === 0" class="rounded-lg border border-slate-200 bg-slate-50 p-8 text-center">
      <p class="text-sm text-slate-600">
        所有客戶都已有諮詢記錄
      </p>
    </div>

    <!-- Unassigned Requests Section -->
    <div class="mt-8">
      <h2 class="text-base font-semibold text-slate-900 mb-4">
        未分配諮詢師的諮詢單
        <span v-if="unassignedRequests.length > 0" class="ml-2 rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-700">
          {{ unassignedRequests.length }}
        </span>
      </h2>

      <div class="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <div
          v-for="request in unassignedRequests"
          :key="request.id"
          class="rounded-lg border border-amber-200 bg-amber-50 p-4 shadow-sm hover:shadow-md transition-shadow"
        >
          <div class="space-y-2">
            <div class="flex items-start justify-between">
              <h3 class="font-medium text-slate-900">
                {{ request.name || '未命名諮詢單' }}
              </h3>
              <span class="inline-flex rounded-full bg-amber-200 px-2 py-0.5 text-xs font-medium text-amber-800">
                待分配
              </span>
            </div>
            <p class="text-sm text-slate-600">
              {{ request.bPartnerName || '未知客戶' }}
            </p>
            <div class="flex items-center justify-between text-xs text-slate-500">
              <span>{{ request.requestTypeName || '—' }}</span>
              <span>{{ formatDate(request.created) }}</span>
            </div>
            <div class="pt-2">
              <button
                class="w-full rounded-lg bg-brand-600 px-3 py-2 text-sm font-semibold text-white hover:bg-brand-700 disabled:opacity-60"
                :disabled="submitting"
                @click="claimRequest(request)"
              >
                {{ submitting ? '處理中…' : '接手此諮詢單' }}
              </button>
            </div>
          </div>
        </div>
      </div>

      <!-- Empty State for unassigned requests -->
      <div v-if="!loading && unassignedRequests.length === 0" class="rounded-lg border border-slate-200 bg-slate-50 p-8 text-center">
        <p class="text-sm text-slate-600">
          所有諮詢單都已分配諮詢師
        </p>
      </div>
    </div>

    <!-- Create Request Modal -->
    <Teleport to="body">
      <div
        v-if="showModal"
        class="fixed inset-0 z-50 flex items-center justify-center bg-black/40"
        @click.self="closeModal"
      >
        <div class="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl">
          <div class="flex items-center justify-between">
            <h3 class="text-lg font-semibold text-slate-900">
              建立諮詢單
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

          <div class="mt-4 space-y-4">
            <div>
              <label class="text-sm font-medium text-slate-700">客戶</label>
              <input
                :value="selectedCustomer?.name"
                type="text"
                disabled
                class="mt-1 w-full rounded-lg border border-slate-300 bg-slate-50 px-3 py-2 text-sm text-slate-600"
              >
            </div>
            <div>
              <label class="text-sm font-medium text-slate-700">諮詢單名稱</label>
              <input
                v-model="form.name"
                type="text"
                class="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm focus:border-brand-500 focus:ring-1 focus:ring-brand-500"
                placeholder="例如：諮詢需求"
              >
            </div>
            <div>
              <label class="text-sm font-medium text-slate-700">說明</label>
              <textarea
                v-model="form.description"
                class="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm focus:border-brand-500 focus:ring-1 focus:ring-brand-500"
                rows="3"
                placeholder="選填：需求說明..."
              />
            </div>
            <div>
              <label class="text-sm font-medium text-slate-700">Request Type</label>
              <select
                v-model="form.requestTypeId"
                class="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm focus:border-brand-500 focus:ring-1 focus:ring-brand-500"
              >
                <option :value="undefined">
                  未選擇
                </option>
                <option v-for="type in requestTypes" :key="type.id" :value="type.id">
                  {{ type.name }}
                </option>
              </select>
            </div>
            <div>
              <label class="text-sm font-medium text-slate-700">Status</label>
              <select
                v-model="form.requestStatusId"
                class="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm focus:border-brand-500 focus:ring-1 focus:ring-brand-500"
              >
                <option :value="undefined">
                  未選擇
                </option>
                <option v-for="status in requestStatuses" :key="status.id" :value="status.id">
                  {{ status.name }}
                </option>
              </select>
            </div>
            <div class="grid grid-cols-2 gap-4">
              <div>
                <label class="text-sm font-medium text-slate-700">諮詢開始</label>
                <input
                  v-model="form.startDate"
                  type="datetime-local"
                  class="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm focus:border-brand-500 focus:ring-1 focus:ring-brand-500"
                >
              </div>
              <div>
                <label class="text-sm font-medium text-slate-700">諮詢結束</label>
                <input
                  v-model="form.closeDate"
                  type="datetime-local"
                  class="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm focus:border-brand-500 focus:ring-1 focus:ring-brand-500"
                >
              </div>
            </div>
          </div>

          <div class="mt-6 flex gap-3">
            <button
              class="flex-1 rounded-lg bg-brand-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-brand-700 disabled:opacity-60"
              :disabled="submitting || !form.name.trim() || !selectedCustomer"
              @click="submitRequest"
            >
              {{ submitting ? '建立中…' : '建立' }}
            </button>
            <button
              class="rounded-lg border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50"
              @click="closeModal"
            >
              取消
            </button>
          </div>
        </div>
      </div>
    </Teleport>
  </div>
</template>
