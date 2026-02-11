<script setup lang="ts">
import type { Resource, ResourceAssignment, ResourceType } from '../../features/resource/api'
import { computed, onMounted, ref, watch } from 'vue'
import { useAuth } from '../../features/auth/store'
import { createAssignment, deleteAssignment, getAssignmentColors, getResourceType, listAssignmentsForRange, listResources } from '../../features/resource/api'

// 事件顯示資訊（Google Calendar style）
type CalendarEvent = ResourceAssignment & {
  resourceId: number
  resourceName: string
  startDate: Date
  endDate: Date
  // 佈局計算結果
  column: number
  totalColumns: number
}

const auth = useAuth()

const resources = ref<Resource[]>([])
const resourceTypes = ref<Map<number, ResourceType>>(new Map())
const selectedResourceId = ref<number | null>(null)
const allAssignments = ref<Map<number, ResourceAssignment[]>>(new Map())
const loading = ref(false)
const error = ref<string | null>(null)

// 新增
const newResourceId = ref<number | null>(null)
const newDay = ref<string | null>(null)
const newSlot = ref<string | null>(null)
const newDuration = ref(30) // 預設 30 分鐘
const newName = ref('')
const submitting = ref(false)

// 時長選項 (30分鐘 ~ 3小時)
const durationOptions = [
  { value: 30, label: '30 分鐘' },
  { value: 60, label: '1 小時' },
  { value: 90, label: '1.5 小時' },
  { value: 120, label: '2 小時' },
  { value: 150, label: '2.5 小時' },
  { value: 180, label: '3 小時' },
]

// 刪除
const deleteTarget = ref<(ResourceAssignment & { resourceId: number }) | null>(null)

// Popout
const activePopout = ref<{ assignment: CalendarEvent, x: number, y: number } | null>(null)
let hidePopoutTimer: ReturnType<typeof setTimeout> | null = null

function showPopout(e: MouseEvent | TouchEvent, assignment: CalendarEvent) {
  e.stopPropagation()
  if (hidePopoutTimer) {
    clearTimeout(hidePopoutTimer)
    hidePopoutTimer = null
  }
  const rect = (e.target as HTMLElement).getBoundingClientRect()
  activePopout.value = {
    assignment,
    x: rect.right + 8,
    y: rect.top,
  }
}

function hidePopout() {
  hidePopoutTimer = setTimeout(() => {
    activePopout.value = null
  }, 150)
}

function keepPopout() {
  if (hidePopoutTimer) {
    clearTimeout(hidePopoutTimer)
    hidePopoutTimer = null
  }
}

const popoutStyle = computed(() => {
  if (!activePopout.value)
    return {}
  const maxX = typeof window !== 'undefined' ? window.innerWidth - 300 : 1000
  const maxY = typeof window !== 'undefined' ? window.innerHeight - 200 : 600
  return {
    left: `${Math.min(activePopout.value.x, maxX)}px`,
    top: `${Math.min(activePopout.value.y, maxY)}px`,
  }
})

function confirmDeleteFromPopout() {
  if (activePopout.value) {
    deleteTarget.value = activePopout.value.assignment
    activePopout.value = null
  }
}

function formatDateTime(dateStr: string): string {
  const d = new Date(dateStr)
  return `${d.getMonth() + 1}/${d.getDate()} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
}

function formatEventTime(dateStr: string): string {
  const d = new Date(dateStr)
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
}

// 顏色配置
const assignmentColors = ref<Map<number, string>>(new Map())
const resourceColors = [
  '#3b82f6', // blue
  '#ef4444', // red
  '#10b981', // green
  '#f59e0b', // amber
  '#8b5cf6', // purple
  '#ec4899', // pink
  '#06b6d4', // cyan
  '#84cc16', // lime
]

function getResourceColor(resourceId: number): string {
  const index = resources.value.findIndex(r => r.id === resourceId)
  return resourceColors[index % resourceColors.length]
}

function getAssignmentColor(assignmentId: number, resourceId: number): string {
  return assignmentColors.value.get(assignmentId) || getResourceColor(resourceId)
}

const now = new Date()
const weekStart = new Date(now)
weekStart.setDate(now.getDate() - ((now.getDay() + 6) % 7))
weekStart.setHours(0, 0, 0, 0)
const weekEnd = new Date(weekStart)
weekEnd.setDate(weekStart.getDate() + 7)

// 預設時間範圍（若資源類型無設定時使用）
const DEFAULT_HOUR_START = 9
const DEFAULT_HOUR_END = 18
const HOUR_HEIGHT = 60 // 每小時高度 (px)

// 根據選中的資源類型計算有效時間範圍
const effectiveTimeRange = computed(() => {
  const types = getActiveResourceTypes()
  if (types.length === 0) {
    return { start: DEFAULT_HOUR_START, end: DEFAULT_HOUR_END }
  }

  // 取所有資源類型的時間範圍聯集（最早開始～最晚結束）
  let minStart = 24
  let maxEnd = 0

  for (const rt of types) {
    const start = parseTimeSlot(rt.timeSlotStart, DEFAULT_HOUR_START)
    const end = parseTimeSlot(rt.timeSlotEnd, DEFAULT_HOUR_END)
    minStart = Math.min(minStart, start)
    maxEnd = Math.max(maxEnd, end)
  }

  return {
    start: minStart < 24 ? minStart : DEFAULT_HOUR_START,
    end: maxEnd > 0 ? maxEnd : DEFAULT_HOUR_END,
  }
})

// 解析時間字串如 "09:00:00" -> 9
function parseTimeSlot(timeStr: string | undefined, fallback: number): number {
  if (!timeStr)
    return fallback
  const match = timeStr.match(/^(\d{1,2}):/)
  if (match)
    return Number.parseInt(match[1], 10)
  return fallback
}

// 獲取當前有效的資源類型列表
function getActiveResourceTypes(): ResourceType[] {
  if (selectedResourceId.value) {
    const resource = resources.value.find(r => r.id === selectedResourceId.value)
    if (resource) {
      const rt = resourceTypes.value.get(resource.resourceTypeId)
      return rt ? [rt] : []
    }
    return []
  }
  // 全部資源：收集所有資源類型
  const typeIds = new Set(resources.value.map(r => r.resourceTypeId))
  return Array.from(typeIds).map(id => resourceTypes.value.get(id)).filter((rt): rt is ResourceType => !!rt)
}

// 根據資源類型計算有效的營業日（週一～週日）
const effectiveBusinessDays = computed(() => {
  const types = getActiveResourceTypes()
  if (types.length === 0) {
    // 無設定時顯示全部
    return { mon: true, tue: true, wed: true, thu: true, fri: true, sat: true, sun: true }
  }

  // 取聯集：任一資源類型營業的日子都顯示
  return {
    mon: types.some(rt => rt.onMonday),
    tue: types.some(rt => rt.onTuesday),
    wed: types.some(rt => rt.onWednesday),
    thu: types.some(rt => rt.onThursday),
    fri: types.some(rt => rt.onFriday),
    sat: types.some(rt => rt.onSaturday),
    sun: types.some(rt => rt.onSunday),
  }
})

const hours = computed(() => {
  const { start, end } = effectiveTimeRange.value
  return Array.from({ length: end - start }, (_, i) => start + i)
})

// 30分鐘時段選項（用於新增預約）- 根據營業時間動態生成
interface TimeSlot { key: string, label: string, hour: number, minute: number }
const timeSlots = computed<TimeSlot[]>(() => {
  const { start, end } = effectiveTimeRange.value
  const slots: TimeSlot[] = []
  for (let h = start; h < end; h++) {
    slots.push({ key: `${h}00`, label: `${h}:00`, hour: h, minute: 0 })
    slots.push({ key: `${h}30`, label: `${h}:30`, hour: h, minute: 30 })
  }
  return slots
})

// 全部星期（用於查詢，不過濾）
const allWeekDays = computed(() => {
  const days = ['一', '二', '三', '四', '五', '六', '日']
  return days.map((label, i) => {
    const d = new Date(weekStart)
    d.setDate(weekStart.getDate() + i)
    return { key: `d${i}`, label: `週${label}`, date: `${d.getMonth() + 1}/${d.getDate()}`, dateObj: new Date(d), dayIndex: i }
  })
})

// 根據營業日過濾的星期（用於顯示）
const weekDays = computed(() => {
  const bd = effectiveBusinessDays.value
  const businessDayFlags = [bd.mon, bd.tue, bd.wed, bd.thu, bd.fri, bd.sat, bd.sun]
  return allWeekDays.value.filter((_, i) => businessDayFlags[i])
})

function isToday(date: Date): boolean {
  const today = new Date()
  return date.getDate() === today.getDate()
    && date.getMonth() === today.getMonth()
    && date.getFullYear() === today.getFullYear()
}

// 獲取某天的所有事件，並計算佈局
function getDayEvents(day: { dateObj: Date }): CalendarEvent[] {
  const { start: HOUR_START, end: HOUR_END } = effectiveTimeRange.value
  const dayStart = new Date(day.dateObj)
  dayStart.setHours(HOUR_START, 0, 0, 0)
  const dayEnd = new Date(day.dateObj)
  dayEnd.setHours(HOUR_END, 0, 0, 0)

  // 收集當天所有事件
  const events: CalendarEvent[] = []
  for (const r of resources.value) {
    if (selectedResourceId.value && r.id !== selectedResourceId.value)
      continue
    const assignments = allAssignments.value.get(r.id) ?? []
    for (const a of assignments) {
      const startDate = new Date(a.from)
      const endDate = a.to ? new Date(a.to) : new Date(startDate.getTime() + 30 * 60 * 1000)

      // 檢查是否在這一天
      if (startDate < dayEnd && endDate > dayStart) {
        events.push({
          ...a,
          resourceId: r.id,
          resourceName: r.name,
          startDate,
          endDate,
          column: 0,
          totalColumns: 1,
        })
      }
    }
  }

  // 計算重疊佈局（Google Calendar 風格）
  events.sort((a, b) => a.startDate.getTime() - b.startDate.getTime())

  // 使用貪婪算法分配欄位
  const columns: CalendarEvent[][] = []

  for (const event of events) {
    let placed = false
    for (let col = 0; col < columns.length; col++) {
      const columnEvents = columns[col]
      const lastEvent = columnEvents[columnEvents.length - 1]
      // 檢查是否與該欄位的最後一個事件重疊
      if (lastEvent.endDate <= event.startDate) {
        columnEvents.push(event)
        event.column = col
        placed = true
        break
      }
    }
    if (!placed) {
      event.column = columns.length
      columns.push([event])
    }
  }

  // 計算每個事件需要的總欄位數（處理重疊群組）
  for (const event of events) {
    // 找出所有與此事件重疊的事件
    const overlapping = events.filter(e =>
      e.startDate < event.endDate && e.endDate > event.startDate,
    )
    const maxColumn = Math.max(...overlapping.map(e => e.column)) + 1
    event.totalColumns = maxColumn
  }

  return events
}

function getEventStyle(event: CalendarEvent): Record<string, string> {
  const { start: HOUR_START, end: HOUR_END } = effectiveTimeRange.value
  const dayStart = new Date(event.startDate)
  dayStart.setHours(HOUR_START, 0, 0, 0)
  const dayEnd = new Date(event.startDate)
  dayEnd.setHours(HOUR_END, 0, 0, 0)

  // 限制事件在顯示範圍內
  const effectiveStart = Math.max(event.startDate.getTime(), dayStart.getTime())
  const effectiveEnd = Math.min(event.endDate.getTime(), dayEnd.getTime())

  // 計算位置
  const startMinutes = (effectiveStart - dayStart.getTime()) / (60 * 1000)
  const durationMinutes = (effectiveEnd - effectiveStart) / (60 * 1000)

  const top = (startMinutes / 60) * HOUR_HEIGHT
  const height = Math.max((durationMinutes / 60) * HOUR_HEIGHT - 2, 20) // 最小高度 20px

  // 計算水平位置
  const width = (1 / event.totalColumns) * 100
  const left = event.column * width

  const color = getAssignmentColor(event.id, event.resourceId)

  return {
    top: `${top}px`,
    height: `${height}px`,
    left: `${left}%`,
    width: `calc(${width}% - 4px)`,
    backgroundColor: `${color}20`,
    borderLeftColor: color,
    color,
  }
}

async function loadAll() {
  if (!auth.token.value)
    return
  resources.value = await listResources(auth.token.value)

  // 載入所有資源類型
  const typeIds = new Set(resources.value.map(r => r.resourceTypeId).filter(id => id > 0))
  const typeMap = new Map<number, ResourceType>()
  await Promise.all(
    Array.from(typeIds).map(async (typeId) => {
      try {
        const rt = await getResourceType(auth.token.value!, typeId)
        typeMap.set(typeId, rt)
      }
      catch (e) {
        console.error(`Failed to load resource type ${typeId}:`, e)
      }
    }),
  )
  resourceTypes.value = typeMap

  const map = new Map<number, ResourceAssignment[]>()
  const allAssignmentIds: number[] = []
  await Promise.all(
    resources.value.map(async (r) => {
      const list = await listAssignmentsForRange(auth.token.value!, r.id, weekStart, weekEnd)
      map.set(r.id, list)
      allAssignmentIds.push(...list.map(a => a.id))
    }),
  )
  allAssignments.value = map

  // 載入所有預約的顏色配置
  if (allAssignmentIds.length > 0) {
    try {
      assignmentColors.value = await getAssignmentColors(auth.token.value!, allAssignmentIds)
    }
    catch (e) {
      console.error('Failed to load assignment colors:', e)
      assignmentColors.value = new Map()
    }
  }
}

async function reload() {
  error.value = null
  loading.value = true
  try {
    await loadAll()
  }
  catch (e: any) {
    error.value = e?.detail || e?.title || e?.message || '載入失敗'
  }
  finally {
    loading.value = false
  }
}

async function doDelete() {
  if (!auth.token.value || !deleteTarget.value)
    return
  try {
    await deleteAssignment(auth.token.value, deleteTarget.value.id)
    deleteTarget.value = null
    await reload()
  }
  catch (e: any) {
    error.value = e?.detail || e?.title || e?.message || '刪除失敗'
  }
}

async function submitNew() {
  if (!auth.token.value || !newResourceId.value || !newDay.value || !newSlot.value || !newName.value.trim())
    return
  submitting.value = true
  error.value = null
  try {
    const dayObj = allWeekDays.value.find(d => d.key === newDay.value)!
    const slotObj = timeSlots.value.find(s => s.key === newSlot.value)!
    const from = new Date(dayObj.dateObj)
    from.setHours(slotObj.hour, slotObj.minute, 0, 0)
    const to = new Date(from)
    to.setMinutes(to.getMinutes() + newDuration.value)
    await createAssignment(auth.token.value, { resourceId: newResourceId.value, name: newName.value.trim(), from, to })
    newName.value = ''
    await reload()
  }
  catch (e: any) {
    error.value = e?.detail || e?.title || e?.message || '新增失敗'
  }
  finally {
    submitting.value = false
  }
}

// 當資源選擇變更時，重置快速新增表單中可能已失效的選項
watch([selectedResourceId, newResourceId], () => {
  // 檢查 newDay 是否仍在有效列表中
  if (newDay.value && !weekDays.value.some(d => d.key === newDay.value)) {
    newDay.value = null
  }
  // 檢查 newSlot 是否仍在有效列表中
  if (newSlot.value && !timeSlots.value.some(s => s.key === newSlot.value)) {
    newSlot.value = null
  }
})

onMounted(reload)
</script>

<template>
  <div class="space-y-6">
    <div class="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
      <h1 class="text-lg font-semibold">
        管理員：行事曆
      </h1>
      <p class="mt-1 text-sm text-slate-600">
        查看所有資源的預約狀況，可新增或刪除預約。
      </p>
    </div>

    <div class="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
      <div class="flex flex-wrap items-center justify-between gap-3">
        <div class="flex items-center gap-3">
          <select v-model="selectedResourceId" class="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm">
            <option :value="null">
              全部資源
            </option>
            <option v-for="r in resources" :key="r.id" :value="r.id">
              {{ r.name }}
            </option>
          </select>
          <div class="text-xs text-slate-500">
            {{ weekStart.toLocaleDateString() }} ～ {{ weekEnd.toLocaleDateString() }}
          </div>
        </div>
        <button
          class="rounded-lg bg-brand-600 px-3 py-2 text-sm font-semibold text-white hover:bg-brand-700 disabled:opacity-60"
          :disabled="loading"
          @click="reload"
        >
          {{ loading ? '載入中…' : '重新整理' }}
        </button>
      </div>

      <p v-if="error" class="mt-4 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
        {{ error }}
      </p>

      <!-- Google Calendar Style Grid -->
      <div class="mt-4 overflow-x-auto">
        <div class="calendar-container">
          <!-- Time column -->
          <div class="time-column">
            <div class="day-header-cell" />
            <div class="time-grid">
              <div v-for="hour in hours" :key="hour" class="time-label">
                <span>{{ hour }}:00</span>
              </div>
            </div>
          </div>

          <!-- Day columns -->
          <div v-for="day in weekDays" :key="day.key" class="day-column">
            <div class="day-header-cell" :class="{ 'is-today': isToday(day.dateObj) }">
              <div class="day-name">
                {{ day.label }}
              </div>
              <div class="day-date" :class="{ 'today-badge': isToday(day.dateObj) }">
                {{ day.dateObj.getDate() }}
              </div>
            </div>
            <div class="day-grid" :style="{ height: `${hours.length * HOUR_HEIGHT}px` }">
              <!-- Hour slots background -->
              <div v-for="hour in hours" :key="hour" class="hour-slot">
                <div class="half-hour-line" />
              </div>
              <!-- Events -->
              <div
                v-for="event in getDayEvents(day)"
                :key="event.id"
                class="event-card"
                :style="getEventStyle(event)"
                @click="showPopout($event, event)"
                @mouseenter="showPopout($event, event)"
                @mouseleave="hidePopout"
              >
                <div class="event-time">
                  {{ formatEventTime(event.from) }}
                </div>
                <div class="event-title">
                  {{ event.name || '—' }}
                </div>
                <div class="event-resource">
                  {{ event.resourceName }}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- 新增預約 -->
      <div class="mt-6 rounded-xl border border-slate-200 bg-slate-50 p-4">
        <div class="text-sm font-semibold text-slate-900">
          快速新增預約
        </div>
        <div class="mt-3 grid gap-3 sm:grid-cols-6">
          <select v-model="newResourceId" class="rounded-lg border border-slate-300 bg-white px-2 py-1.5 text-sm">
            <option :value="null" disabled>
              選擇資源
            </option>
            <option v-for="r in resources" :key="r.id" :value="r.id">
              {{ r.name }}
            </option>
          </select>
          <select v-model="newDay" class="rounded-lg border border-slate-300 bg-white px-2 py-1.5 text-sm">
            <option :value="null" disabled>
              選擇日期
            </option>
            <option v-for="d in weekDays" :key="d.key" :value="d.key">
              {{ d.label }} {{ d.date }}
            </option>
          </select>
          <select v-model="newSlot" class="rounded-lg border border-slate-300 bg-white px-2 py-1.5 text-sm">
            <option :value="null" disabled>
              選擇時段
            </option>
            <option v-for="s in timeSlots" :key="s.key" :value="s.key">
              {{ s.label }}
            </option>
          </select>
          <select v-model="newDuration" class="rounded-lg border border-slate-300 bg-white px-2 py-1.5 text-sm">
            <option v-for="d in durationOptions" :key="d.value" :value="d.value">
              {{ d.label }}
            </option>
          </select>
          <input v-model="newName" class="rounded-lg border border-slate-300 bg-white px-2 py-1.5 text-sm" placeholder="預約名稱">
          <button
            class="rounded-lg bg-brand-600 px-3 py-1.5 text-sm font-semibold text-white hover:bg-brand-700 disabled:opacity-60"
            :disabled="submitting || !newResourceId || !newDay || !newSlot || !newName.trim()"
            @click="submitNew"
          >
            {{ submitting ? '…' : '新增' }}
          </button>
        </div>
      </div>
    </div>

    <!-- Popout 資訊卡 -->
    <Teleport to="body">
      <div
        v-if="activePopout"
        class="fixed z-50 rounded-lg bg-white shadow-xl border border-slate-200 p-3 min-w-[200px] max-w-[280px]"
        :style="popoutStyle"
        @mouseenter="keepPopout"
        @mouseleave="hidePopout"
      >
        <div class="flex items-start justify-between gap-2">
          <div
            class="w-3 h-3 rounded-full flex-shrink-0 mt-0.5"
            :style="{ backgroundColor: getAssignmentColor(activePopout.assignment.id, activePopout.assignment.resourceId) }"
          />
          <div class="flex-1 min-w-0">
            <div class="font-semibold text-sm text-slate-900 truncate">
              {{ activePopout.assignment.name || '—' }}
            </div>
            <div class="text-xs text-slate-500 mt-0.5">
              {{ activePopout.assignment.resourceName }}
            </div>
          </div>
        </div>
        <div class="mt-2 text-xs text-slate-600 space-y-1">
          <div class="flex items-center gap-1">
            <span class="text-slate-400">開始:</span>
            <span>{{ formatDateTime(activePopout.assignment.from) }}</span>
          </div>
          <div class="flex items-center gap-1">
            <span class="text-slate-400">結束:</span>
            <span>{{ formatDateTime(activePopout.assignment.to) }}</span>
          </div>
        </div>
        <div class="mt-3 pt-2 border-t border-slate-100">
          <button
            class="w-full rounded-lg bg-rose-50 px-3 py-1.5 text-xs font-semibold text-rose-600 hover:bg-rose-100 transition-colors"
            @click="confirmDeleteFromPopout"
          >
            刪除預約
          </button>
        </div>
      </div>
    </Teleport>

    <!-- 刪除確認 Modal -->
    <div v-if="deleteTarget" class="fixed inset-0 z-50 flex items-center justify-center bg-black/40" @click.self="deleteTarget = null">
      <div class="rounded-xl bg-white p-6 shadow-xl">
        <div class="text-sm font-semibold">
          確定刪除此預約？
        </div>
        <div class="mt-2 text-xs text-slate-600">
          {{ deleteTarget.name }} ({{ deleteTarget.from }})
        </div>
        <div class="mt-4 flex gap-2">
          <button class="rounded-lg bg-rose-600 px-4 py-2 text-sm font-semibold text-white hover:bg-rose-700" @click="doDelete">
            刪除
          </button>
          <button class="rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm" @click="deleteTarget = null">
            取消
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.calendar-container {
  display: flex;
  border: 1px solid #e2e8f0;
  border-radius: 8px;
  overflow: hidden;
  min-width: 800px;
}

.time-column {
  flex-shrink: 0;
  width: 60px;
  border-right: 1px solid #e2e8f0;
  background: #f8fafc;
}

.day-header-cell {
  height: 60px;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  border-bottom: 1px solid #e2e8f0;
  background: #f8fafc;
}

.day-header-cell.is-today {
  background: #eff6ff;
}

.day-name {
  font-size: 11px;
  color: #64748b;
  font-weight: 500;
}

.day-date {
  font-size: 20px;
  font-weight: 600;
  color: #1e293b;
  margin-top: 2px;
}

.day-date.today-badge {
  background: #3b82f6;
  color: white;
  width: 32px;
  height: 32px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
}

.time-grid {
  position: relative;
}

.time-label {
  height: 60px;
  display: flex;
  align-items: flex-start;
  justify-content: flex-end;
  padding-right: 8px;
  font-size: 10px;
  color: #64748b;
  border-bottom: 1px solid #e2e8f0;
}

.time-label span {
  transform: translateY(-6px);
}

.day-column {
  flex: 1;
  min-width: 100px;
  border-right: 1px solid #e2e8f0;
}

.day-column:last-child {
  border-right: none;
}

.day-grid {
  position: relative;
  /* height is set dynamically via inline style */
}

.hour-slot {
  height: 60px;
  border-bottom: 1px solid #e2e8f0;
  position: relative;
}

.half-hour-line {
  position: absolute;
  left: 0;
  right: 0;
  top: 50%;
  border-top: 1px dashed #e2e8f0;
}

.event-card {
  position: absolute;
  border-left: 3px solid;
  border-radius: 4px;
  padding: 2px 4px;
  font-size: 11px;
  overflow: hidden;
  cursor: pointer;
  transition: all 0.15s ease;
  z-index: 10;
}

.event-card:hover {
  z-index: 20;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.15);
  transform: scale(1.02);
}

.event-time {
  font-weight: 600;
  font-size: 10px;
  opacity: 0.8;
}

.event-title {
  font-weight: 600;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.event-resource {
  font-size: 10px;
  opacity: 0.7;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
</style>
