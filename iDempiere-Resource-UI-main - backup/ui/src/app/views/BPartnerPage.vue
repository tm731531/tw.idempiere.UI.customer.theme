<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import DynamicForm from '../../components/DynamicForm.vue'
import { useAuth } from '../../features/auth/store'
import { createWindowRecord } from '../../features/window/api'
import { apiFetch } from '../../shared/api/http'

const auth = useAuth()

// View mode
const mode = ref<'list' | 'form'>('list')
const editingId = ref<number | null>(null)
const editingRecord = ref<Record<string, unknown> | null>(null)

// List state
const listRecords = ref<any[]>([])
const listLoading = ref(false)
const totalCount = ref(0)
const currentPage = ref(1)
const pageSize = 20
const searchQuery = ref('')

// Form state
const bpFormRef = ref<InstanceType<typeof DynamicForm> | null>(null)
const error = ref<string | null>(null)
const successMessage = ref<string | null>(null)

// Default values for new records
const formDefaults = computed(() => {
  if (editingRecord.value) {
    // Flatten nested objects from Model API (e.g., { C_BP_Group_ID: { id: 104 } } -> { C_BP_Group_ID: 104 })
    const flattened: Record<string, unknown> = {}
    for (const [key, value] of Object.entries(editingRecord.value)) {
      if (value && typeof value === 'object' && 'id' in (value as object)) {
        flattened[key] = (value as { id: unknown }).id
      }
      else {
        flattened[key] = value
      }
    }
    return flattened
  }
  return {
    C_BP_Group_ID: 104, // Standard BP Group
  }
})

const hasNextPage = computed(() => {
  return currentPage.value * pageSize < totalCount.value
})

// Load list using Model API
async function loadList() {
  if (!auth.token.value)
    return

  listLoading.value = true
  error.value = null

  try {
    const searchParams: Record<string, string | number> = {
      $orderby: 'Name',
      $top: pageSize,
      $skip: (currentPage.value - 1) * pageSize,
    }

    if (searchQuery.value.trim()) {
      searchParams.$filter = `contains(Name,'${searchQuery.value.trim()}')`
    }

    const result = await apiFetch<{ 'records': any[], 'row-count'?: number }>(
      '/api/v1/models/C_BPartner',
      { token: auth.token.value, searchParams },
    )

    listRecords.value = result.records ?? []
    totalCount.value = result['row-count'] ?? result.records?.length ?? 0
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

// Form actions
function startCreate() {
  editingId.value = null
  editingRecord.value = null
  error.value = null
  successMessage.value = null
  mode.value = 'form'
}

function startEdit(record: any) {
  editingId.value = record.id
  editingRecord.value = record
  error.value = null
  successMessage.value = null
  mode.value = 'form'
}

function backToList() {
  mode.value = 'list'
  editingId.value = null
  editingRecord.value = null
  error.value = null
  loadList()
}

async function handleSubmit(data: Record<string, unknown>) {
  if (!auth.token.value) {
    error.value = '尚未登入'
    return
  }

  error.value = null
  bpFormRef.value?.setSubmitting(true)

  try {
    if (editingId.value) {
      // Update existing using Model API
      await apiFetch(`/api/v1/models/C_BPartner/${editingId.value}`, {
        method: 'PUT',
        token: auth.token.value,
        json: data,
      })
      successMessage.value = '業務夥伴已更新'
    }
    else {
      // Create new using Window API (this works)
      await createWindowRecord(auth.token.value, 'business-partner', data)
      successMessage.value = '業務夥伴已建立'
    }

    // Go back to list after short delay
    setTimeout(() => {
      backToList()
    }, 1000)
  }
  catch (e: any) {
    const missing = bpFormRef.value?.getMissingMandatoryFields() || []
    if (missing.length > 0) {
      error.value = `請填寫以下必填欄位：\n• ${missing.join('\n• ')}`
    }
    else {
      error.value = e?.detail || e?.title || e?.message || '操作失敗'
    }
  }
  finally {
    bpFormRef.value?.setSubmitting(false)
  }
}

onMounted(() => {
  loadList()
})
</script>

<template>
  <div class="space-y-6">
    <!-- Header -->
    <div class="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
      <div class="flex items-center justify-between">
        <div>
          <h1 class="text-lg font-semibold">
            業務夥伴
          </h1>
          <p class="mt-1 text-sm text-slate-600">
            {{ mode === 'list' ? '查看和管理業務夥伴' : (editingId ? '編輯業務夥伴' : '建立新業務夥伴') }}
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

    <!-- Error Message -->
    <div
      v-if="error"
      class="rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700 whitespace-pre-line"
    >
      {{ error }}
    </div>

    <!-- Success Message -->
    <div
      v-if="successMessage"
      class="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700"
    >
      {{ successMessage }}
    </div>

    <!-- List View -->
    <div v-if="mode === 'list'" class="rounded-2xl border border-slate-200 bg-white shadow-sm">
      <!-- Search -->
      <div class="border-b border-slate-200 p-4">
        <div class="flex gap-2">
          <input
            v-model="searchQuery"
            type="text"
            placeholder="搜尋名稱..."
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

      <!-- Table -->
      <div class="overflow-x-auto">
        <table class="w-full text-sm">
          <thead class="bg-slate-50 text-left text-xs font-medium uppercase text-slate-500">
            <tr>
              <th class="px-4 py-3">
                名稱
              </th>
              <th class="px-4 py-3">
                搜尋鍵
              </th>
              <th class="px-4 py-3">
                客戶
              </th>
              <th class="px-4 py-3">
                供應商
              </th>
              <th class="px-4 py-3">
                操作
              </th>
            </tr>
          </thead>
          <tbody class="divide-y divide-slate-200">
            <tr v-if="listLoading">
              <td colspan="5" class="px-4 py-8 text-center text-slate-500">
                載入中...
              </td>
            </tr>
            <tr v-else-if="listRecords.length === 0">
              <td colspan="5" class="px-4 py-8 text-center text-slate-500">
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
                {{ record.Name }}
              </td>
              <td class="px-4 py-3 text-slate-600">
                {{ record.Value }}
              </td>
              <td class="px-4 py-3">
                <span
                  :class="record.IsCustomer ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-500'"
                  class="inline-flex rounded-full px-2 py-0.5 text-xs font-medium"
                >
                  {{ record.IsCustomer ? '是' : '否' }}
                </span>
              </td>
              <td class="px-4 py-3">
                <span
                  :class="record.IsVendor ? 'bg-blue-100 text-blue-700' : 'bg-slate-100 text-slate-500'"
                  class="inline-flex rounded-full px-2 py-0.5 text-xs font-medium"
                >
                  {{ record.IsVendor ? '是' : '否' }}
                </span>
              </td>
              <td class="px-4 py-3">
                <button
                  type="button"
                  class="text-brand-600 hover:text-brand-700 font-medium"
                  @click.stop="startEdit(record)"
                >
                  編輯
                </button>
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <!-- Pagination -->
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

    <!-- Form View -->
    <div v-if="mode === 'form'" class="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
      <DynamicForm
        ref="bpFormRef"
        window-slug="business-partner"
        tab-slug="business-partner"
        :default-values="formDefaults"
        :submit-label="editingId ? '儲存' : '建立'"
        @submit="handleSubmit"
      />
    </div>
  </div>
</template>
