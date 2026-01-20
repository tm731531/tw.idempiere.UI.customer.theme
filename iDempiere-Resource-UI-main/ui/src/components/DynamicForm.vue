<script setup lang="ts">
import type { TabField } from '../features/window/api'
import { computed, onMounted, reactive, ref, watch } from 'vue'
import { useAuth } from '../features/auth/store'
import { getFieldVisibility, getTabFieldsWithMeta, getWindowRecord, ReferenceType, setFieldVisibility } from '../features/window/api'
import DynamicField from './DynamicField.vue'

const props = withDefaults(
  defineProps<{
    windowSlug: string
    tabSlug: string
    recordId?: number | null
    excludeFields?: string[]
    defaultValues?: Record<string, unknown>
    submitLabel?: string
    showCancel?: boolean
    showHelp?: boolean
  }>(),
  {
    recordId: null,
    excludeFields: () => [],
    defaultValues: () => ({}),
    submitLabel: '儲存',
    showCancel: false,
    showHelp: false,
  },
)

const emit = defineEmits<{
  (e: 'submit', data: Record<string, unknown>): void
  (e: 'cancel'): void
  (e: 'loaded', fields: TabField[]): void
}>()

const auth = useAuth()

const fields = ref<TabField[]>([])
const formData = reactive<Record<string, unknown>>({})
const loading = ref(false)
const error = ref<string | null>(null)
const submitting = ref(false)
const formError = ref<string | null>(null)
const adminHiddenFields = ref<string[]>([]) // Admin-configured hidden fields

// Admin field configuration mode
const adminMode = ref(false)
const tempHiddenFields = ref<string[]>([]) // Temporary hidden fields (for admin editing)
const savingConfig = ref(false)
const configSuccess = ref<string | null>(null)
const canConfigureFields = ref(false) // Whether user can configure fields (admin only)

// System fields to exclude by default
// Note: AD_Org_ID is NOT excluded - users should be able to select organization
const systemFields: readonly string[] = [
  'AD_Client_ID',
  'Created',
  'CreatedBy',
  'Updated',
  'UpdatedBy',
  'IsActive',
] as const

/**
 * Check if a field should be excluded based on basic criteria
 * (system fields, keys, buttons, etc.)
 */
function shouldExcludeField(f: TabField): boolean {
  const colName = f.columnName
  // Exclude system fields
  if (systemFields.includes(colName))
    return true
  // Exclude explicitly excluded fields
  if (props.excludeFields.includes(colName))
    return true
  // Exclude key fields (auto-generated IDs)
  if (f.column?.isKey)
    return true
  // Exclude parent link fields
  if (f.column?.isParent)
    return true
  // Exclude UU fields
  if (colName.endsWith('_UU'))
    return true
  // Exclude button types
  if (f.column?.referenceId === ReferenceType.Button)
    return true
  // Exclude fields not displayed (IsDisplayed = false or SeqNo = 0)
  if (!f.isDisplayed || f.seqNo === 0)
    return true
  // Exclude credit-related calculated fields (system-managed)
  const creditFields = [
    'SO_CreditLimit',
    'SO_CreditUsed',
    'SO_CreditStatus',
    'SO_CreditUsed_Invoiced',
    'SO_CreditUsed_Unconfirmed',
    'OpenBalance',
    'TotalOpenBalance'
  ]
  if (creditFields.includes(colName))
    return true
  return false
}

// Fields to display based on filters (used for normal form operation)
const visibleFields = computed(() => {
  const filtered = fields.value.filter((f) => {
    if (shouldExcludeField(f))
      return false
    // Exclude admin-configured hidden fields
    if (adminHiddenFields.value.includes(f.columnName))
      return false
    return true
  })
  return filtered.sort((a, b) => a.seqNo - b.seqNo)
})

// Fields to display in the UI (admin mode shows ALL fields for configuration)
const displayFields = computed(() => {
  if (adminMode.value) {
    // In admin mode: show ALL fields (except basic exclusions)
    return fields.value.filter(f => !shouldExcludeField(f)).sort((a, b) => a.seqNo - b.seqNo)
  }
  else {
    // Normal mode: use visibleFields with all filters applied
    return visibleFields.value
  }
})

async function loadFields(): Promise<void> {
  if (!auth.token.value) {
    error.value = '未登入'
    return
  }

  loading.value = true
  error.value = null
  formError.value = null

  try {
    // Load fields metadata
    fields.value = await getTabFieldsWithMeta(auth.token.value, props.windowSlug, props.tabSlug, auth.language.value)

    // Load admin-configured field visibility
    let fieldVisibility: FieldVisibilityConfig | null = null
    adminHiddenFields.value = []
    tempHiddenFields.value = []
    canConfigureFields.value = false // Will be set to true if user can read config

    try {
      // Try to read existing configuration - if successful, user can see admin features
      fieldVisibility = await getFieldVisibility(auth.token.value, props.windowSlug, props.tabSlug)
      adminHiddenFields.value = fieldVisibility?.hiddenFields || []
      tempHiddenFields.value = [...adminHiddenFields.value]
      canConfigureFields.value = true // If we can read, show admin features
    }
    catch (e) {
      // If we can't read config, user doesn't have admin access
      console.warn('Cannot access field visibility config, assuming no admin access:', e)
      adminHiddenFields.value = []
      tempHiddenFields.value = []
      canConfigureFields.value = false
      adminMode.value = false
    }

    // Load existing record data if recordId is provided
    const recordData: Record<string, unknown> = {}
    if (props.recordId) {
      const record = await getWindowRecord(
        auth.token.value,
        props.windowSlug,
        props.tabSlug,
        props.recordId,
      )
      // Flatten nested objects (e.g., { C_BP_Group_ID: { id: 104 } } -> { C_BP_Group_ID: 104 })
      for (const [key, value] of Object.entries(record)) {
        if (value && typeof value === 'object' && 'id' in (value as object)) {
          recordData[key] = (value as { id: unknown }).id
        }
        else {
          recordData[key] = value
        }
      }
    }

    // Initialize form data: record data > default values > field defaults
    for (const field of visibleFields.value) {
      const colName = field.columnName
      if (colName in recordData) {
        formData[colName] = recordData[colName]
      }
      else if (colName in props.defaultValues) {
        formData[colName] = props.defaultValues[colName]
      }
      else {
        formData[colName] = getDefaultValue(field)
      }
    }

    emit('loaded', fields.value)
  }
  catch (e: unknown) {
    const err = e as { detail?: string, title?: string, message?: string }
    error.value = err?.detail || err?.title || err?.message || '載入表單失敗'
  }
  finally {
    loading.value = false
  }
}

function getDefaultValue(field: TabField): unknown {
  if (!field.column)
    return null
  switch (field.column.referenceId) {
    case ReferenceType.YesNo:
      return false
    case ReferenceType.Integer:
    case ReferenceType.Number:
    case ReferenceType.Amount:
      return null
    default:
      return null
  }
}

function handleSubmit(): void {
  formError.value = null
  // Build data object, include all non-empty values
  const data: Record<string, unknown> = {}
  for (const field of visibleFields.value) {
    const val = formData[field.columnName]
    // For multiselect fields, include empty strings (means no selection)
    const isMultiselect = field.column?.referenceId === ReferenceType.ChosenMultipleSelectionList
    if (val !== null && val !== undefined && (val !== '' || isMultiselect)) {
      data[field.columnName] = val
    }
  }
  emit('submit', data)
}

/**
 * 找出可能缺少的必填欄位（用於後端報錯時輔助提示）
 * 回傳格式：「標籤 (欄位名)」
 */
function getMissingMandatoryFields(): string[] {
  const missing: string[] = []
  // 從 fields.value 檢查所有欄位（包含被隱藏的）
  for (const f of fields.value) {
    if (!f.column?.isMandatory)
      continue
    // 跳過系統自動處理的欄位
    if (systemFields.includes(f.columnName))
      continue
    // 跳過 key/parent 欄位
    if (f.column.isKey || f.column.isParent)
      continue
    // 跳過 UU 欄位
    if (f.columnName.endsWith('_UU'))
      continue
    // 跳過被明確排除的欄位
    if (props.excludeFields.includes(f.columnName))
      continue

    const val = formData[f.columnName]
    // YesNo: false 也是合法值
    if (f.column.referenceId === ReferenceType.YesNo)
      continue
    if (val === null || val === undefined || val === '') {
      const label = f.name || f.columnName
      missing.push(`${label} (${f.columnName})`)
    }
  }
  return missing
}

/**
 * Toggle a field in the temporary hidden fields list (admin mode)
 */
function toggleTempHidden(columnName: string, hidden: boolean): void {
  if (hidden) {
    if (!tempHiddenFields.value.includes(columnName))
      tempHiddenFields.value.push(columnName)
    return
  }

  const index = tempHiddenFields.value.indexOf(columnName)
  if (index > -1)
    tempHiddenFields.value.splice(index, 1)
}

/**
 * Hide all fields in admin mode
 */
function hideAllFields(): void {
  tempHiddenFields.value = displayFields.value.map(f => f.columnName)
}

/**
 * Show all fields in admin mode
 */
function showAllFields(): void {
  tempHiddenFields.value = []
}

/**
 * Save field configuration to AD_SysConfig (admin only)
 */
async function saveFieldConfiguration(): Promise<void> {
  if (!auth.token.value) {
    formError.value = '未登入'
    return
  }

  savingConfig.value = true
  formError.value = null
  configSuccess.value = null

  try {
    console.log('Attempting to save field visibility config:', {
      windowSlug: props.windowSlug,
      tabSlug: props.tabSlug,
      hiddenFields: tempHiddenFields.value,
      roleId: auth.roleId.value,
      roleName: auth.roleName.value,
    })

    const success = await setFieldVisibility(
      auth.token.value,
      props.windowSlug,
      props.tabSlug,
      tempHiddenFields.value,
    )

    if (success) {
      adminHiddenFields.value = [...tempHiddenFields.value] // Update the actual config
      configSuccess.value = '欄位配置已儲存'
      setTimeout(() => {
        configSuccess.value = null
      }, 3000)
    }
    else {
      console.warn('setFieldVisibility returned false')
      formError.value = `儲存失敗：需要系統管理員權限才能配置欄位可見性 (角色: ${auth.roleName.value || '未知'})`
      canConfigureFields.value = false // Disable admin mode if not admin
      adminMode.value = false // Also disable admin mode
    }
  }
  catch (e: unknown) {
    const err = e as { status?: number, detail?: string, title?: string, message?: string }
    const status = err?.status
    console.error('Error saving field visibility config:', err)
    if (status === 403 || status === 401) {
      formError.value = `儲存失敗：需要系統管理員權限才能配置欄位可見性 (角色: ${auth.roleName.value || '未知'}, HTTP ${status})`
      canConfigureFields.value = false // Disable admin mode if not admin
      adminMode.value = false // Also disable admin mode
    }
    else {
      formError.value = err?.detail || err?.title || err?.message || '儲存欄位配置失敗'
    }
  }
  finally {
    savingConfig.value = false
  }
}

// Expose methods for parent components
defineExpose({
  formData,
  fields,
  reload: loadFields,
  setSubmitting: (val: boolean) => {
    submitting.value = val
  },
  setFormError: (msg: string | null) => {
    formError.value = msg
  },
  getMissingMandatoryFields,
})

// Watch for tab or record changes
watch([() => props.windowSlug, () => props.tabSlug, () => props.recordId], loadFields)

onMounted(loadFields)
</script>

<template>
  <div class="dynamic-form">
    <!-- Loading state -->
    <div v-if="loading" class="flex items-center justify-center py-8">
      <div class="animate-pulse text-slate-500">
        載入表單中...
      </div>
    </div>

    <!-- Error state -->
    <div v-else-if="error" class="rounded-lg border border-rose-200 bg-rose-50 p-4">
      <p class="text-sm text-rose-700">
        {{ error }}
      </p>
      <button
        type="button"
        class="mt-2 text-sm text-rose-600 underline hover:text-rose-700"
        @click="loadFields"
      >
        重試
      </button>
    </div>

    <!-- Form -->
    <form v-else @submit.prevent="handleSubmit">
      <div
        v-if="formError"
        class="mb-4 rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700 whitespace-pre-line"
      >
        {{ formError }}
      </div>

      <!-- Admin mode toggle -->
      <div v-if="canConfigureFields" class="mb-4 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3">
        <div class="flex items-center justify-between">
          <label class="flex items-center gap-2 cursor-pointer">
            <input
              v-model="adminMode"
              type="checkbox"
              class="h-4 w-4 rounded border-slate-300 text-brand-600"
            >
            <span class="text-sm font-medium text-amber-800">欄位配置模式（勾選欄位的「隱藏」來設定哪些欄位預設不顯示）</span>
          </label>
          <div v-if="adminMode" class="flex gap-2">
            <button
              type="button"
              class="rounded-lg border border-amber-300 bg-white px-3 py-1.5 text-sm font-medium text-amber-800 hover:bg-amber-50"
              @click="hideAllFields"
            >
              全部隱藏
            </button>
            <button
              type="button"
              class="rounded-lg border border-amber-300 bg-white px-3 py-1.5 text-sm font-medium text-amber-800 hover:bg-amber-50"
              @click="showAllFields"
            >
              全部顯示
            </button>
            <button
              type="button"
              :disabled="savingConfig"
              class="rounded-lg bg-brand-600 px-3 py-1.5 text-sm font-semibold text-white hover:bg-brand-700 disabled:opacity-60"
              @click="saveFieldConfiguration"
            >
              {{ savingConfig ? '儲存中...' : '儲存配置' }}
            </button>
          </div>
        </div>
      </div>

      <div
        v-if="configSuccess"
        class="mb-4 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700"
      >
        {{ configSuccess }}
      </div>

      <div class="grid gap-4 grid-cols-1">
        <DynamicField
          v-for="field in displayFields"
          :key="field.id"
          v-model="formData[field.columnName]"
          :field="field"
          :show-help="showHelp"
          :admin-mode="adminMode"
          :marked-hidden="tempHiddenFields.includes(field.columnName)"
          @update:marked-hidden="(val) => toggleTempHidden(field.columnName, val)"
        />
      </div>

      <slot name="actions">
        <div class="mt-6 flex gap-3">
          <button
            type="submit"
            :disabled="submitting"
            class="rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-700 disabled:opacity-60"
          >
            {{ submitting ? '儲存中...' : submitLabel }}
          </button>
          <button
            v-if="showCancel"
            type="button"
            class="rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
            @click="emit('cancel')"
          >
            取消
          </button>
        </div>
      </slot>
    </form>
  </div>
</template>
