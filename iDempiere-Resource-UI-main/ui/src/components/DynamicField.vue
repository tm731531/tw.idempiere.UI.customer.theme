<script setup lang="ts">
import type { LookupOption, TabField } from '../features/window/api'
import { computed, onMounted, ref, watch } from 'vue'
import { useAuth } from '../features/auth/store'
import { getInputType, getReferenceLookupOptions, getTableLookupOptions, ReferenceType } from '../features/window/api'

const props = defineProps<{
  field: TabField
  modelValue: unknown
  showHelp?: boolean
  adminMode?: boolean
  markedHidden?: boolean
}>()

const emit = defineEmits<{
  (e: 'update:modelValue', value: unknown): void
  (e: 'update:markedHidden', value: boolean): void
}>()

const auth = useAuth()

const localValue = ref(props.modelValue)
const lookupOptions = ref<LookupOption[]>([])
const lookupLoading = ref(false)
const lookupError = ref<string | null>(null)

const fieldId = computed(() => `field-${props.field.id}`)

const labelText = computed(() => {
  // Use field name from API directly (no translation)
  return props.field.name || props.field.columnName
})

const inputType = computed(() => {
  if (!props.field.column)
    return 'text'
  return getInputType(props.field.column.referenceId)
})

const isRequired = computed(() => props.field.column?.isMandatory ?? false)

const maxLength = computed(() => props.field.column?.fieldLength || undefined)

const inputClass = 'mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm focus:border-brand-500 focus:ring-1 focus:ring-brand-500'

// Multiselect helpers
function parseMultiValue(val: unknown): (string | number)[] {
  if (Array.isArray(val))
    return val
  if (typeof val === 'string' && val.trim()) {
    // Handle comma-separated string
    return val.split(',').map(v => v.trim()).filter(Boolean)
  }
  return []
}

function isOptionSelected(optValue: string | number): boolean {
  const selected = parseMultiValue(localValue.value)
  return selected.some(v => String(v) === String(optValue))
}

function toggleOption(optValue: string | number): void {
  const selected = parseMultiValue(localValue.value)
  const idx = selected.findIndex(v => String(v) === String(optValue))
  if (idx >= 0) {
    selected.splice(idx, 1)
  }
  else {
    selected.push(optValue)
  }
  // Store as comma-separated string for iDempiere API compatibility
  localValue.value = selected.join(',')
}

const selectedCount = computed(() => parseMultiValue(localValue.value).length)

// Sync local value with prop
watch(
  () => props.modelValue,
  (val) => {
    localValue.value = val
  },
)

// Emit changes
watch(localValue, (val) => {
  emit('update:modelValue', val)
})

// Load lookup options for select/multiselect fields
async function loadLookupOptions() {
  lookupError.value = null
  lookupOptions.value = []

  const colName = props.field.columnName

  if (inputType.value !== 'select' && inputType.value !== 'multiselect') {
    return
  }
  if (!props.field.column) {
    console.log(`[DynamicField] ${colName}: no column metadata available`)
    lookupError.value = '欄位元資料載入失敗'
    return
  }
  if (!auth.token.value) {
    console.log(`[DynamicField] ${colName}: no token`)
    lookupError.value = '未登入，無法載入選項'
    return
  }

  const refId = props.field.column.referenceId
  const refValueId = props.field.column.referenceValueId

  console.log(`[DynamicField] ${colName}: refId=${refId}, refValueId=${refValueId}`)

  lookupLoading.value = true
  try {
    // 1) List/Table/Search/MultiSelect with Reference: use Reference API
    if ((refId === ReferenceType.List || refId === ReferenceType.Table || refId === ReferenceType.Search || refId === ReferenceType.ChosenMultipleSelectionList) && refValueId) {
      console.log(`[DynamicField] ${colName}: trying Reference API (refValueId=${refValueId})`)
      lookupOptions.value = await getReferenceLookupOptions(auth.token.value, refValueId)
      console.log(`[DynamicField] ${colName}: got ${lookupOptions.value.length} from Reference API`)
      // Don't fallback for Table/List/Search/MultiSelect types - they MUST use Reference API
      return
    }

    // 2) TableDirect only: derive table name from column name
    if (refId === ReferenceType.TableDirect && colName.endsWith('_ID')) {
      const tableName = colName.slice(0, -3)
      console.log(`[DynamicField] ${colName}: trying TableDirect, table=${tableName}`)
      lookupOptions.value = await getTableLookupOptions(auth.token.value, tableName, {
        select: `${tableName}_ID,Name`,
        orderby: 'Name',
        top: 200,
      })
      console.log(`[DynamicField] ${colName}: got ${lookupOptions.value.length} from table`)
    }
  }
  catch (e: any) {
    const status = e?.status
    if (status === 401) {
      lookupError.value = 'Token 已過期，請重新登入'
    }
    else if (status === 403) {
      lookupError.value = '無權限存取此資料'
    }
    else {
      lookupError.value = e?.detail || e?.title || e?.message || `下拉選單載入失敗 (${status || 'unknown'})`
    }
    console.error(`[DynamicField] loadLookupOptions failed for ${colName}:`, e)
  }
  finally {
    lookupLoading.value = false
  }

  // 必填但沒有選項：要提示，否則使用者會卡住卻不知道原因
  if (isRequired.value && lookupOptions.value.length === 0) {
    lookupError.value = lookupError.value || '此欄位為必填，但目前沒有可選項（可能是參照設定或權限/資料問題）'
  }
}

onMounted(loadLookupOptions)

watch([() => auth.token.value, () => props.field.id], () => {
  loadLookupOptions()
})
</script>

<template>
  <div class="dynamic-field">
    <div class="flex items-center justify-between gap-2">
      <label :for="fieldId" class="block text-sm font-medium text-slate-700">
        {{ labelText }}
        <span v-if="isRequired" class="text-rose-500">*</span>
      </label>

      <!-- Admin mode: checkbox to mark field as hidden -->
      <label v-if="adminMode" class="flex items-center gap-1 text-xs text-slate-500 cursor-pointer">
        <input
          type="checkbox"
          :checked="markedHidden"
          class="h-3 w-3 rounded border-slate-300 text-slate-600"
          @change="emit('update:markedHidden', !markedHidden)"
        >
        <span>隱藏</span>
      </label>
    </div>

    <!-- Text Input -->
    <input
      v-if="inputType === 'text'"
      :id="fieldId"
      v-model="localValue"
      type="text"
      :maxlength="maxLength"
      :required="isRequired"
      :placeholder="field.description"
      :class="inputClass"
    >

    <!-- Number Input -->
    <input
      v-else-if="inputType === 'number'"
      :id="fieldId"
      v-model.number="localValue"
      type="number"
      :required="isRequired"
      :placeholder="field.description"
      :class="inputClass"
    >

    <!-- Checkbox (Yes/No) -->
    <div v-else-if="inputType === 'checkbox'" class="mt-2 flex items-center">
      <input
        :id="fieldId"
        v-model="localValue"
        type="checkbox"
        class="h-4 w-4 rounded border-slate-300 text-brand-600 focus:ring-brand-500"
      >
      <span class="ml-2 text-sm text-slate-600">{{ field.description }}</span>
    </div>

    <!-- Date Input -->
    <input
      v-else-if="inputType === 'date'"
      :id="fieldId"
      v-model="localValue"
      type="date"
      :required="isRequired"
      :class="inputClass"
    >

    <!-- DateTime Input -->
    <input
      v-else-if="inputType === 'datetime'"
      :id="fieldId"
      v-model="localValue"
      type="datetime-local"
      :required="isRequired"
      :class="inputClass"
    >

    <!-- Textarea -->
    <textarea
      v-else-if="inputType === 'textarea'"
      :id="fieldId"
      v-model="localValue"
      :required="isRequired"
      :placeholder="field.description"
      rows="3"
      :class="inputClass"
    />

    <!-- Select (Lookup) -->
    <select
      v-else-if="inputType === 'select'"
      :id="fieldId"
      v-model="localValue"
      :required="isRequired"
      :disabled="lookupLoading"
      :class="inputClass"
    >
      <option :value="null">
        {{ lookupLoading ? '載入中...' : '-- 請選擇 --' }}
      </option>
      <option v-for="opt in lookupOptions" :key="String(opt.value)" :value="opt.value">
        {{ opt.label }}
      </option>
    </select>

    <!-- MultiSelect (Checkbox Group) -->
    <div v-else-if="inputType === 'multiselect'" class="mt-1">
      <div v-if="lookupLoading" class="text-sm text-slate-500">
        載入中...
      </div>
      <div v-else-if="lookupOptions.length === 0" class="text-sm text-slate-500">
        無可選項目
      </div>
      <div v-else class="space-y-2 max-h-48 overflow-y-auto border border-slate-300 rounded-lg p-3 bg-white">
        <label
          v-for="opt in lookupOptions"
          :key="String(opt.value)"
          class="flex items-center gap-2 cursor-pointer hover:bg-slate-50 rounded px-1"
        >
          <input
            type="checkbox"
            :value="opt.value"
            :checked="isOptionSelected(opt.value)"
            class="h-4 w-4 rounded border-slate-300 text-brand-600 focus:ring-brand-500"
            @change="toggleOption(opt.value)"
          >
          <span class="text-sm text-slate-700">{{ opt.label }}</span>
        </label>
      </div>
      <p v-if="selectedCount > 0" class="mt-1 text-xs text-slate-500">
        已選擇 {{ selectedCount }} 項
      </p>
    </div>

    <p v-if="lookupError && (inputType === 'select' || inputType === 'multiselect')" class="mt-1 text-xs text-rose-600">
      {{ lookupError }}
    </p>

    <!-- Help text -->
    <p v-if="field.help && showHelp" class="mt-1 text-xs text-slate-500">
      {{ field.help }}
    </p>
  </div>
</template>
