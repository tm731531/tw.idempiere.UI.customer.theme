<script setup lang="ts">
import type { Resource, ResourceAssignment, ResourceType } from '../../features/resource/api'
import { computed, onMounted, ref, watch } from 'vue'
import { useAuth } from '../../features/auth/store'
import { usePermission } from '../../features/permission/store'
import {
  createAssignment,
  deleteAssignment,
  getAllAssignmentsForExport,
  getAssignmentColors,
  getResourceDefaultColors,
  getResourceType,
  listAssignmentsForRange,
  listResources,

  setAssignmentColor,
  updateAssignment,
} from '../../features/resource/api'
import {
  formatDateTime,
  formatDateTimeLocal,
  formatEventTime,
  formatTime,
  getWeekEnd,
  getWeekStart,
  parseTimeString,
} from '../../shared/utils/datetime'
import { getErrorMessage } from '../../shared/utils/error'

// 事件顯示資訊（Google Calendar style）
type CalendarEvent = ResourceAssignment & {
  resourceId: number
  resourceName: string
  startDate: Date
  endDate: Date
  column: number
  totalColumns: number
}

const auth = useAuth()
const permission = usePermission()

const resources = ref<Resource[]>([])
const selectedResourceIds = ref<number[]>([])
const resourceTypes = ref<Map<number, ResourceType>>(new Map())
const assignments = ref<Map<number, ResourceAssignment[]>>(new Map())
const resourceDefaultColors = ref<Map<number, string>>(new Map())
const loading = ref(false)
const exporting = ref(false)
const error = ref<string | null>(null)

// 額外欄位可見性
const showDescriptionField = ref(false)

// 資源顏色映射
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
  return resourceDefaultColors.value.get(resourceId) || (() => {
    const index = resources.value.findIndex(r => r.id === resourceId)
    return resourceColors[index % resourceColors.length]
  })()
}

function getAssignmentColor(assignmentId: number): string {
  return assignmentColors.value.get(assignmentId) || getResourceColor(
    selectedResourceIds.value.find(id =>
      assignments.value.get(id)?.some(a => a.id === assignmentId),
    ) || selectedResourceIds.value[0] || 0,
  )
}

// 選擇模式
const selectionMode = ref<'start' | 'end' | null>(null)
const selectedStart = ref<{ day: WeekDay, slot: TimeSlot } | null>(null)
const selectedEnd = ref<{ day: WeekDay, slot: TimeSlot } | null>(null)
const hoverSlot = ref<TimeSlot | null>(null)
const showBookingForm = ref(false)
const bookingName = ref('')
const bookingColor = ref('#3b82f6')
const bookingDescription = ref('')
const submitting = ref(false)
const assignmentColors = ref<Map<number, string>>(new Map())

// 多資源預約時間（各別修改）
const multiResourceTimes = ref<Map<number, { from: Date, to: Date }>>(new Map())

// 編輯預約
const editingEvent = ref<CalendarEvent | null>(null)
const editName = ref('')
const editColor = ref('#3b82f6')
const editFromDate = ref('')
const editToDate = ref('')
const editDescription = ref('')
const showEditModal = ref(false)
const deleting = ref(false)

// Hover 時的預計時長
const hoverDuration = computed(() => {
  if (!selectedStart.value || !hoverSlot.value)
    return 0
  const startMin = selectedStart.value.slot.hour * 60 + selectedStart.value.slot.minute
  const endMin = hoverSlot.value.endHour * 60 + hoverSlot.value.endMinute
  return Math.max(endMin - startMin, 30)
})

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

// 編輯預約功能
async function openEditModal(event: CalendarEvent) {
  activePopout.value = null
  editingEvent.value = event
  editName.value = event.name || ''
  editColor.value = assignmentColors.value.get(event.id) || getResourceColor(event.resourceId)

  const fromDate = new Date(event.from)
  const toDate = event.to ? new Date(event.to) : new Date(fromDate.getTime() + 30 * 60 * 1000)
  editFromDate.value = formatDateTimeLocal(fromDate)
  editToDate.value = formatDateTimeLocal(toDate)
  editDescription.value = (event as any).description || ''

  // 檢查欄位可見性
  if (auth.token.value && auth.clientId.value && auth.organizationId.value) {
    showDescriptionField.value = await permission.isFieldVisible(
      auth.token.value,
      'S_ResourceAssignment',
      'Description',
    )
  }

  showEditModal.value = true
}

function closeEditModal() {
  showEditModal.value = false
  editingEvent.value = null
  editName.value = ''
  editColor.value = '#3b82f6'
  editFromDate.value = ''
  editToDate.value = ''
  editDescription.value = ''
}

async function saveEdit() {
  if (!auth.token.value || !editingEvent.value || !editName.value.trim() || !editFromDate.value || !editToDate.value)
    return

  const fromDate = new Date(editFromDate.value)
  const toDate = new Date(editToDate.value)

  if (Number.isNaN(fromDate.getTime()) || Number.isNaN(toDate.getTime())) {
    error.value = '時間格式無效'
    return
  }

  if (fromDate >= toDate) {
    error.value = '結束時間必須晚於開始時間'
    return
  }

  submitting.value = true
  error.value = null

  try {
    await updateAssignment(auth.token.value, editingEvent.value.id, {
      name: editName.value.trim(),
      from: fromDate,
      to: toDate,
      description: editDescription.value || undefined,
    })

    if (editColor.value) {
      await setAssignmentColor(auth.token.value, editingEvent.value.id, editColor.value)
    }

    closeEditModal()
    await loadAllAssignments()
  }
  catch (e: any) {
    error.value = getErrorMessage(e, '更新失敗')
  }
  finally {
    submitting.value = false
  }
}

async function confirmDelete() {
  if (!auth.token.value || !editingEvent.value)
    return
  if (!confirm(`確定要刪除「${editingEvent.value.name || '此預約'}」嗎？`))
    return

  deleting.value = true
  error.value = null

  try {
    await deleteAssignment(auth.token.value, editingEvent.value.id)
    closeEditModal()
    await loadAllAssignments()
  }
  catch (e: any) {
    error.value = getErrorMessage(e, '刪除失敗')
  }
  finally {
    deleting.value = false
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

// 時間相關
const now = new Date()
const weekStart = getWeekStart(now)
const weekEnd = getWeekEnd(weekStart)

interface WeekDay {
  key: string
  label: string
  date: string
  dateObj: Date
  dayOfWeek: number
}

interface TimeSlot {
  key: string
  hour: number
  minute: number
  endHour: number
  endMinute: number
  index: number
}

// 日曆顯示時間範圍
const HOUR_START = computed(() => {
  if (!commonResourceType.value?.timeSlotStart)
    return 9
  const match = commonResourceType.value.timeSlotStart.match(/^(\d{2})/)
  return match ? Number.parseInt(match[1], 10) : 9
})

const HOUR_END = computed(() => {
  if (!commonResourceType.value?.timeSlotEnd)
    return 18
  const match = commonResourceType.value.timeSlotEnd.match(/^(\d{2})/)
  return match ? Number.parseInt(match[1], 10) : 18
})

const displayHours = computed(() => {
  return Array.from({ length: HOUR_END.value - HOUR_START.value }, (_, i) => HOUR_START.value + i)
})

const HOUR_HEIGHT = 60

function formatSlotTime(slot?: TimeSlot | null): string {
  if (!slot)
    return '--:--'
  return `${String(slot.hour).padStart(2, '0')}:${String(slot.minute).padStart(2, '0')}`
}

function formatSlotEndTime(slot?: TimeSlot | null): string {
  if (!slot)
    return '--:--'
  return `${String(slot.endHour).padStart(2, '0')}:${String(slot.endMinute).padStart(2, '0')}`
}

const timeSlots = computed<TimeSlot[]>(() => {
  if (!commonResourceType.value)
    return []

  const start = parseTimeString(commonResourceType.value.timeSlotStart)
  const end = parseTimeString(commonResourceType.value.timeSlotEnd)

  if (!start || !end)
    return []

  const slots: TimeSlot[] = []
  let hour = start.hour
  let minute = start.minute
  const slotMinutes = 30
  let index = 0

  while (hour < end.hour || (hour === end.hour && minute < end.minute)) {
    const endMinute = minute + slotMinutes
    const endHour = hour + Math.floor(endMinute / 60)
    const actualEndMinute = endMinute % 60

    if (endHour > end.hour || (endHour === end.hour && actualEndMinute > end.minute)) {
      break
    }

    slots.push({
      key: `${hour}${String(minute).padStart(2, '0')}`,
      hour,
      minute,
      endHour,
      endMinute: actualEndMinute,
      index: index++,
    })

    minute += slotMinutes
    if (minute >= 60) {
      hour += Math.floor(minute / 60)
      minute = minute % 60
    }
  }

  return slots
})

const weekDays = computed<WeekDay[]>(() => {
  const dayLabels = ['日', '一', '二', '三', '四', '五', '六']
  const days: WeekDay[] = []

  for (let i = 0; i < 7; i++) {
    const d = new Date(weekStart)
    d.setDate(weekStart.getDate() + i)
    const dow = d.getDay()
    days.push({
      key: `d${i}`,
      label: `週${dayLabels[dow]}`,
      date: `${d.getMonth() + 1}/${d.getDate()}`,
      dateObj: new Date(d),
      dayOfWeek: dow,
    })
  }

  return days
})

function isToday(date: Date): boolean {
  const today = new Date()
  return date.getDate() === today.getDate()
    && date.getMonth() === today.getMonth()
    && date.getFullYear() === today.getFullYear()
}

function isDayAvailable(dayOfWeek: number, resourceId?: number): boolean {
  const rt = resourceId ? resourceTypes.value.get(resourceId) : commonResourceType.value
  if (!rt)
    return false
  switch (dayOfWeek) {
    case 0: return rt.onSunday ?? false
    case 1: return rt.onMonday ?? false
    case 2: return rt.onTuesday ?? false
    case 3: return rt.onWednesday ?? false
    case 4: return rt.onThursday ?? false
    case 5: return rt.onFriday ?? false
    case 6: return rt.onSaturday ?? false
    default: return false
  }
}

function isAnyDayAvailable(dayOfWeek: number): boolean {
  return selectedResourceIds.value.some(resId => isDayAvailable(dayOfWeek, resId))
}

function getAvailableDaysText(resourceId: number): string {
  const rt = resourceTypes.value.get(resourceId)
  if (!rt)
    return '無'
  const days: string[] = []
  if (rt.onMonday)
    days.push('一')
  if (rt.onTuesday)
    days.push('二')
  if (rt.onWednesday)
    days.push('三')
  if (rt.onThursday)
    days.push('四')
  if (rt.onFriday)
    days.push('五')
  if (rt.onSaturday)
    days.push('六')
  if (rt.onSunday)
    days.push('日')
  return days.length ? days.join('、') : '無'
}

function hasBusinessHours(resourceId: number): boolean {
  const rt = resourceTypes.value.get(resourceId)
  return !!(rt?.timeSlotStart && rt?.timeSlotEnd)
}

const hasAllBusinessHours = computed(() => {
  if (selectedResourceIds.value.length === 0)
    return true
  return selectedResourceIds.value.every(resId => hasBusinessHours(resId))
})

function getResourcesWithoutHours(): Resource[] {
  return selectedResources.value.filter(res => !hasBusinessHours(res.id))
}

const selectedResources = computed(() =>
  resources.value.filter(r => selectedResourceIds.value.includes(r.id)),
)

const commonResourceType = computed(() => {
  if (selectedResourceIds.value.length === 0)
    return null
  const firstRes = selectedResources.value[0]
  return resourceTypes.value.get(firstRes?.id) ?? null
})

// 獲取某天的所有事件
function getDayEvents(day: WeekDay): CalendarEvent[] {
  const dayStart = new Date(day.dateObj)
  dayStart.setHours(HOUR_START.value, 0, 0, 0)
  const dayEnd = new Date(day.dateObj)
  dayEnd.setHours(HOUR_END.value, 0, 0, 0)

  const events: CalendarEvent[] = []
  for (const resId of selectedResourceIds.value) {
    const resourceAssignments = assignments.value.get(resId) ?? []
    const resource = resources.value.find(r => r.id === resId)

    for (const a of resourceAssignments) {
      const startDate = new Date(a.from)
      const endDate = a.to ? new Date(a.to) : new Date(startDate.getTime() + 30 * 60 * 1000)

      if (startDate < dayEnd && endDate > dayStart) {
        events.push({
          ...a,
          resourceId: resId,
          resourceName: resource?.name ?? `資源 #${resId}`,
          startDate,
          endDate,
          column: 0,
          totalColumns: 1,
        })
      }
    }
  }

  // 計算重疊佈局
  events.sort((a, b) => a.startDate.getTime() - b.startDate.getTime())
  const columns: CalendarEvent[][] = []

  for (const event of events) {
    let placed = false
    for (let col = 0; col < columns.length; col++) {
      const lastEvent = columns[col][columns[col].length - 1]
      if (lastEvent.endDate <= event.startDate) {
        columns[col].push(event)
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

  for (const event of events) {
    const overlapping = events.filter(e =>
      e.startDate < event.endDate && e.endDate > event.startDate,
    )
    event.totalColumns = Math.max(...overlapping.map(e => e.column)) + 1
  }

  return events
}

function getEventStyle(event: CalendarEvent): Record<string, string> {
  const dayStart = new Date(event.startDate)
  dayStart.setHours(HOUR_START.value, 0, 0, 0)
  const dayEnd = new Date(event.startDate)
  dayEnd.setHours(HOUR_END.value, 0, 0, 0)

  const effectiveStart = Math.max(event.startDate.getTime(), dayStart.getTime())
  const effectiveEnd = Math.min(event.endDate.getTime(), dayEnd.getTime())

  const startMinutes = (effectiveStart - dayStart.getTime()) / (60 * 1000)
  const durationMinutes = (effectiveEnd - effectiveStart) / (60 * 1000)

  const top = (startMinutes / 60) * HOUR_HEIGHT
  const height = Math.max((durationMinutes / 60) * HOUR_HEIGHT - 2, 20)

  const width = (1 / event.totalColumns) * 100
  const left = event.column * width

  const color = getAssignmentColor(event.id)

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

// 計算過去時段的高度（用於 disabled overlay）
function getPastTimeHeight(day: WeekDay): number {
  const now = new Date()
  const dayStart = new Date(day.dateObj)
  dayStart.setHours(HOUR_START.value, 0, 0, 0)
  const dayEnd = new Date(day.dateObj)
  dayEnd.setHours(HOUR_END.value, 0, 0, 0)

  // 如果整天都過去了
  if (now >= dayEnd) {
    return (HOUR_END.value - HOUR_START.value) * HOUR_HEIGHT
  }

  // 如果還沒到這天
  if (now < dayStart) {
    return 0
  }

  // 計算已過去的時間高度
  const pastMinutes = (now.getTime() - dayStart.getTime()) / (60 * 1000)
  return Math.min((pastMinutes / 60) * HOUR_HEIGHT, (HOUR_END.value - HOUR_START.value) * HOUR_HEIGHT)
}

// Selection handling
function isSelectionInDay(day: WeekDay): boolean {
  return selectedStart.value?.day.key === day.key
}

function getSelectionStyle(day: WeekDay): Record<string, string> {
  if (!selectedStart.value || selectedStart.value.day.key !== day.key)
    return {}

  const startSlot = selectedStart.value.slot
  const endSlot = selectedEnd.value?.slot || startSlot

  const dayStart = new Date(day.dateObj)
  dayStart.setHours(HOUR_START.value, 0, 0, 0)

  const startTime = new Date(day.dateObj)
  startTime.setHours(startSlot.hour, startSlot.minute, 0, 0)

  const endTime = new Date(day.dateObj)
  endTime.setHours(endSlot.endHour, endSlot.endMinute, 0, 0)

  const startMinutes = (startTime.getTime() - dayStart.getTime()) / (60 * 1000)
  const endMinutes = (endTime.getTime() - dayStart.getTime()) / (60 * 1000)

  const top = (startMinutes / 60) * HOUR_HEIGHT
  const height = ((endMinutes - startMinutes) / 60) * HOUR_HEIGHT

  return {
    top: `${top}px`,
    height: `${height}px`,
  }
}

// Hover preview style（從開始時間到 hover 位置）
function getHoverPreviewStyle(day: WeekDay): Record<string, string> {
  if (!selectedStart.value || !hoverSlot.value || selectedStart.value.day.key !== day.key)
    return {}

  const startSlot = selectedStart.value.slot
  const endSlot = hoverSlot.value

  // 確保 hover 位置在開始時間之後
  if (endSlot.index < startSlot.index)
    return {}

  const dayStart = new Date(day.dateObj)
  dayStart.setHours(HOUR_START.value, 0, 0, 0)

  const startTime = new Date(day.dateObj)
  startTime.setHours(startSlot.hour, startSlot.minute, 0, 0)

  const endTime = new Date(day.dateObj)
  endTime.setHours(endSlot.endHour, endSlot.endMinute, 0, 0)

  const startMinutes = (startTime.getTime() - dayStart.getTime()) / (60 * 1000)
  const endMinutes = (endTime.getTime() - dayStart.getTime()) / (60 * 1000)

  const top = (startMinutes / 60) * HOUR_HEIGHT
  const height = ((endMinutes - startMinutes) / 60) * HOUR_HEIGHT

  return {
    top: `${top}px`,
    height: `${Math.max(height, 30)}px`,
  }
}

// Hover 事件處理
function onDayGridHover(e: MouseEvent, day: WeekDay) {
  if (selectionMode.value !== 'end')
    return
  if (!selectedStart.value || selectedStart.value.day.key !== day.key)
    return

  const rect = (e.currentTarget as HTMLElement).getBoundingClientRect()
  const y = e.clientY - rect.top

  const totalMinutes = (y / HOUR_HEIGHT) * 60
  const hoverHour = HOUR_START.value + Math.floor(totalMinutes / 60)
  const hoverMinute = Math.floor((totalMinutes % 60) / 30) * 30

  const slot = timeSlots.value.find(s => s.hour === hoverHour && s.minute === hoverMinute)
  if (slot && slot.index >= selectedStart.value.slot.index) {
    hoverSlot.value = slot
  }
}

function onDayGridLeave() {
  hoverSlot.value = null
}

function onDayGridClick(e: MouseEvent, day: WeekDay) {
  if (!isAnyDayAvailable(day.dayOfWeek))
    return

  const rect = (e.currentTarget as HTMLElement).getBoundingClientRect()
  const y = e.clientY - rect.top

  // 計算點擊的時間
  const totalMinutes = (y / HOUR_HEIGHT) * 60
  const clickHour = HOUR_START.value + Math.floor(totalMinutes / 60)
  const clickMinute = Math.floor((totalMinutes % 60) / 30) * 30

  // 找到對應的 slot
  const slot = timeSlots.value.find(s => s.hour === clickHour && s.minute === clickMinute)
  if (!slot)
    return

  // 檢查是否已被預約
  const slotStart = new Date(day.dateObj)
  slotStart.setHours(slot.hour, slot.minute, 0, 0)
  const slotEnd = new Date(day.dateObj)
  slotEnd.setHours(slot.endHour, slot.endMinute, 0, 0)

  const events = getDayEvents(day)
  const hasConflict = events.some(ev => ev.startDate < slotEnd && ev.endDate > slotStart)
  if (hasConflict)
    return

  // 檢查是否過去時間（選擇開始時間時）
  if (selectionMode.value !== 'end' && slotStart < now)
    return

  // 直接點擊日曆即可開始選擇（不需要先按「新增預約」按鈕）
  if (!selectionMode.value || selectionMode.value === 'start') {
    selectedStart.value = { day, slot }
    selectedEnd.value = { day, slot }
    selectionMode.value = 'end'
  }
  else if (selectionMode.value === 'end') {
    if (day.key !== selectedStart.value?.day.key)
      return
    if (slot.index < (selectedStart.value?.slot.index ?? 0))
      return

    // 檢查中間是否有衝突
    const startIdx = selectedStart.value?.slot.index ?? 0
    for (let i = startIdx; i <= slot.index; i++) {
      const checkSlot = timeSlots.value[i]
      if (!checkSlot)
        return
      const checkStart = new Date(day.dateObj)
      checkStart.setHours(checkSlot.hour, checkSlot.minute, 0, 0)
      const checkEnd = new Date(day.dateObj)
      checkEnd.setHours(checkSlot.endHour, checkSlot.endMinute, 0, 0)
      if (events.some(ev => ev.startDate < checkEnd && ev.endDate > checkStart))
        return
    }

    selectedEnd.value = { day, slot }
    selectionMode.value = null

    // 初始化各資源的預約時間（預設為相同的時間）
    const from = new Date(selectedStart.value.day.dateObj)
    from.setHours(selectedStart.value.slot.hour, selectedStart.value.slot.minute, 0, 0)
    const to = new Date(selectedEnd.value.day.dateObj)
    to.setHours(selectedEnd.value.slot.endHour, selectedEnd.value.slot.endMinute, 0, 0)

    multiResourceTimes.value = new Map(
      selectedResourceIds.value.map(resId => [resId, { from: new Date(from), to: new Date(to) }]),
    )

    showBookingForm.value = true
  }
}

async function startSelection() {
  selectionMode.value = 'start'
  selectedStart.value = null
  selectedEnd.value = null
  showBookingForm.value = false
  bookingName.value = ''
  bookingDescription.value = ''
  resetColor()

  // 檢查欄位可見性
  if (auth.token.value && auth.clientId.value && auth.organizationId.value) {
    showDescriptionField.value = await permission.isFieldVisible(
      auth.token.value,
      'S_ResourceAssignment',
      'Description',
    )
  }
}

function resetSelection() {
  selectionMode.value = null
  selectedStart.value = null
  selectedEnd.value = null
  hoverSlot.value = null
  showBookingForm.value = false
  bookingName.value = ''
  bookingDescription.value = ''
  multiResourceTimes.value = new Map()
  resetColor()
}

function resetColor() {
  bookingColor.value = selectedResourceIds.value.length > 0
    ? getResourceColor(selectedResourceIds.value[0])
    : '#3b82f6'
}

function calculateDuration(): number {
  if (!selectedStart.value || !selectedEnd.value)
    return 0
  const startMin = selectedStart.value.slot.hour * 60 + selectedStart.value.slot.minute
  const endMin = selectedEnd.value.slot.endHour * 60 + selectedEnd.value.slot.endMinute
  return endMin - startMin
}

async function submitBooking() {
  if (!auth.token.value)
    return
  if (selectedResourceIds.value.length === 0)
    return
  if (!selectedStart.value || !selectedEnd.value)
    return
  if (!bookingName.value.trim())
    return

  submitting.value = true
  error.value = null

  try {
    const defaultFrom = new Date(selectedStart.value.day.dateObj)
    defaultFrom.setHours(selectedStart.value.slot.hour, selectedStart.value.slot.minute, 0, 0)
    const defaultTo = new Date(selectedEnd.value.day.dateObj)
    defaultTo.setHours(selectedEnd.value.slot.endHour, selectedEnd.value.slot.endMinute, 0, 0)

    const createdAssignments = await Promise.all(
      selectedResourceIds.value.map((resourceId) => {
        const time = multiResourceTimes.value.get(resourceId)
        return createAssignment(auth.token.value!, {
          resourceId,
          name: bookingName.value.trim(),
          from: time?.from || defaultFrom,
          to: time?.to || defaultTo,
          description: bookingDescription.value || undefined,
        })
      }),
    )

    if (bookingColor.value) {
      await Promise.all(
        createdAssignments.map(async (assignment: any) => {
          const assignmentId = assignment.id || assignment.S_ResourceAssignment_ID
          if (assignmentId) {
            try {
              await setAssignmentColor(auth.token.value!, assignmentId, bookingColor.value)
            }
            catch (e) {
              console.error(`Failed to save color for assignment ${assignmentId}:`, e)
            }
          }
        }),
      )
    }

    resetSelection()
    await loadAllAssignments()
  }
  catch (e: any) {
    error.value = getErrorMessage(e, '預約失敗')
  }
  finally {
    submitting.value = false
  }
}

function updateResourceTime(resourceId: number, field: 'from' | 'to', value: string) {
  if (!value)
    return

  const date = new Date(value)
  if (Number.isNaN(date.getTime()))
    return

  const times = multiResourceTimes.value.get(resourceId) || { from: new Date(), to: new Date() }
  times[field] = date

  if (times.from >= times.to) {
    const resourceName = resources.value.find(r => r.id === resourceId)?.name || `資源 #${resourceId}`
    error.value = `${resourceName} 的結束時間必須晚於開始時間`
    return
  }

  multiResourceTimes.value.set(resourceId, times)
  error.value = null
}

async function loadResources() {
  if (!auth.token.value)
    return
  resources.value = await listResources(auth.token.value)
  if (selectedResourceIds.value.length === 0 && resources.value.length) {
    selectedResourceIds.value = [resources.value[0].id]
  }

  try {
    const colors = await getResourceDefaultColors(
      auth.token.value,
      resources.value.map(r => r.id),
    )
    resourceDefaultColors.value = colors
  }
  catch (e) {
    console.error('Failed to load resource default colors:', e)
  }
}

async function loadResourceTypes() {
  if (!auth.token.value)
    return
  const map = new Map<number, ResourceType>()
  for (const resId of selectedResourceIds.value) {
    const resource = resources.value.find(r => r.id === resId)
    if (resource) {
      try {
        const rt = await getResourceType(auth.token.value, resource.resourceTypeId)
        map.set(resId, rt)
      }
      catch (e) {
        console.error(`Failed to load resource type for resource ${resId}:`, e)
      }
    }
  }
  resourceTypes.value = map
}

async function loadAllAssignments() {
  if (!auth.token.value || selectedResourceIds.value.length === 0)
    return
  const map = new Map<number, ResourceAssignment[]>()
  const allAssignmentIds: number[] = []

  await Promise.all(
    selectedResourceIds.value.map(async (resId) => {
      try {
        const list = await listAssignmentsForRange(auth.token.value!, resId, weekStart, weekEnd)
        map.set(resId, list)
        allAssignmentIds.push(...list.map(a => a.id))
      }
      catch (e) {
        console.error(`Failed to load assignments for resource ${resId}:`, e)
        map.set(resId, [])
      }
    }),
  )
  assignments.value = map

  if (allAssignmentIds.length > 0) {
    try {
      const colors = await getAssignmentColors(auth.token.value!, allAssignmentIds)
      assignmentColors.value = colors
    }
    catch (e) {
      console.error('Failed to load assignment colors:', e)
      assignmentColors.value = new Map()
    }
  }
  else {
    assignmentColors.value = new Map()
  }
}

function onResourceToggle(resourceId: number) {
  const index = selectedResourceIds.value.indexOf(resourceId)
  if (index > -1)
    selectedResourceIds.value.splice(index, 1)
  else
    selectedResourceIds.value.push(resourceId)

  reloadForSelectedResources()
}

async function reloadForSelectedResources() {
  error.value = null
  loading.value = true
  resetSelection()
  try {
    await loadResourceTypes()
    await loadAllAssignments()
  }
  catch (e: any) {
    error.value = getErrorMessage(e, '載入預約失敗')
  }
  finally {
    loading.value = false
  }
}

async function reload() {
  error.value = null
  loading.value = true
  resetSelection()
  try {
    await loadResources()
    await reloadForSelectedResources()
  }
  catch (e: any) {
    error.value = getErrorMessage(e, '載入失敗')
  }
  finally {
    loading.value = false
  }
}

async function exportCSV() {
  if (!auth.token.value)
    return

  exporting.value = true
  error.value = null

  try {
    const data = await getAllAssignmentsForExport(auth.token.value, weekStart, weekEnd)

    if (data.length === 0) {
      error.value = '本週無預約資料可匯出'
      return
    }

    const headers = ['預約 ID', '預約名稱', '資源名稱', '開始時間', '結束時間']
    const rows = data.map(({ assignment, resourceName }) => [
      assignment.id,
      assignment.name,
      resourceName,
      formatDateTime(assignment.from),
      assignment.to ? formatDateTime(assignment.to) : '',
    ])

    const csvContent = [headers, ...rows]
      .map(row => row.map(cell => `"${cell}"`).join(','))
      .join('\n')

    const blob = new Blob([`\uFEFF${csvContent}`], { type: 'text/csv;charset=utf-8;' })
    const link = document.createElement('a')
    const url = URL.createObjectURL(blob)

    link.setAttribute('href', url)
    link.setAttribute('download', `預約匯出_${weekStart.toISOString().split('T')[0]}_${weekEnd.toISOString().split('T')[0]}.csv`)
    link.style.visibility = 'hidden'

    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }
  catch (e: any) {
    error.value = getErrorMessage(e, '匯出失敗')
  }
  finally {
    exporting.value = false
  }
}

watch(selectedResourceIds, async () => {
  await reloadForSelectedResources()
}, { deep: true })

onMounted(reload)
</script>

<template>
  <div class="space-y-6">
    <div class="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
      <h1 class="text-lg font-semibold">
        使用者：預約
      </h1>
      <p class="mt-1 text-sm text-slate-600">
        選擇醫師/諮詢師，點選開始時段，再點選結束時段進行預約。
      </p>
    </div>

    <div class="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
      <div class="flex flex-wrap items-end justify-between gap-4">
        <div class="flex-1 min-w-[300px]">
          <label class="text-sm font-medium text-slate-700">選擇資源（醫師/諮詢師）</label>
          <div class="mt-2 flex flex-wrap gap-3">
            <label
              v-for="r in resources"
              :key="r.id"
              class="flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm cursor-pointer hover:bg-slate-50 transition-colors"
              :class="selectedResourceIds.includes(r.id) ? 'border-brand-500 bg-brand-50' : ''"
            >
              <input
                type="checkbox"
                :value="r.id"
                :checked="selectedResourceIds.includes(r.id)"
                class="rounded border-slate-300 text-brand-600 focus:ring-brand-500"
                @change="onResourceToggle(r.id)"
              >
              <span>{{ r.name }}</span>
            </label>
          </div>
          <div v-if="selectedResourceIds.length > 0" class="mt-2 text-xs text-slate-600">
            已選擇 {{ selectedResourceIds.length }} 個資源（可疊加觀看）
          </div>
        </div>

        <div class="flex items-center gap-2">
          <button
            class="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-60"
            :disabled="loading"
            type="button"
            @click="reload"
          >
            {{ loading ? '載入中…' : '重新整理' }}
          </button>
        </div>
      </div>

      <p v-if="error" class="mt-4 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
        {{ error }}
      </p>

      <!-- 時段資訊 -->
      <div v-if="selectedResources.length > 0" class="mt-4 space-y-2">
        <div
          v-for="res in selectedResources"
          :key="res.id"
          class="rounded-lg bg-slate-50 px-3 py-2 text-xs text-slate-600"
          :style="{ borderLeft: `4px solid ${getResourceColor(res.id)}` }"
        >
          <span class="font-semibold" :style="{ color: getResourceColor(res.id) }">{{ res.name }}：</span>
          <span class="font-medium">營業時段：</span>
          <template v-if="hasBusinessHours(res.id)">
            {{ formatTime(resourceTypes.get(res.id)?.timeSlotStart) }} - {{ formatTime(resourceTypes.get(res.id)?.timeSlotEnd) }}
          </template>
          <template v-else>
            <span class="text-rose-600 font-semibold">--:-- - --:-- (未配置)</span>
          </template>
          <span class="ml-3 font-medium">營業日：</span>
          <span>{{ getAvailableDaysText(res.id) }}</span>
        </div>
      </div>

      <!-- 營業時段未配置警告 -->
      <div
        v-if="selectedResources.length > 0 && !hasAllBusinessHours"
        class="mt-4 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-700"
      >
        <div class="flex items-start gap-2">
          <svg class="h-5 w-5 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
          <div>
            <p class="font-semibold">
              部分資源未配置營業時段
            </p>
            <p class="mt-1 text-xs">
              以下資源尚未配置營業時段，無法進行時間選擇：{{ getResourcesWithoutHours().map(r => r.name).join('、') }}
            </p>
            <p class="mt-2 text-xs">
              請聯繫管理員在系統中配置這些資源的營業時段（TimeSlotStart 和 TimeSlotEnd）。
            </p>
          </div>
        </div>
      </div>

      <!-- 選擇提示 -->
      <div v-if="selectionMode" class="mt-4 rounded-lg border border-brand-200 bg-brand-50 px-3 py-2 text-sm text-brand-700">
        <template v-if="selectionMode === 'start'">
          <span class="font-semibold">步驟 1/2：</span> 請點選<span class="font-semibold">開始時段</span>
        </template>
        <template v-else-if="selectionMode === 'end'">
          <span class="font-semibold">步驟 2/2：</span> 已選開始 {{ selectedStart?.day.label }} {{ formatSlotTime(selectedStart?.slot) }}，請點選<span class="font-semibold">結束時段</span>
          <button class="ml-2 text-xs underline" @click="resetSelection">
            重新選擇
          </button>
        </template>
      </div>

      <!-- 無營業時段提示 -->
      <div v-else-if="selectedResources.length > 0 && !hasAllBusinessHours" class="mt-6 rounded-lg border border-slate-200 bg-slate-50 p-8 text-center">
        <svg class="mx-auto h-12 w-12 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
        <p class="mt-4 text-sm font-semibold text-slate-700">
          無法顯示預約日曆
        </p>
        <p class="mt-2 text-xs text-slate-600">
          所選資源尚未配置營業時段，請先配置營業時段後再進行預約。
        </p>
      </div>

      <!-- Google Calendar Style Grid -->
      <div v-if="selectedResources.length > 0 && commonResourceType && hasAllBusinessHours" class="mt-6">
        <div class="mb-3 flex items-center justify-between">
          <div class="text-sm font-semibold text-slate-900">
            本週時段
          </div>
          <div class="flex items-center gap-3">
            <div class="text-xs text-slate-500">
              {{ weekStart.toLocaleDateString() }} ～ {{ weekEnd.toLocaleDateString() }}
            </div>
            <button
              v-if="!selectionMode"
              class="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-50"
              :disabled="exporting"
              @click="exportCSV"
            >
              {{ exporting ? '匯出中…' : '匯出 CSV' }}
            </button>
            <button
              v-if="!selectionMode"
              class="rounded-lg bg-brand-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-brand-700"
              @click="startSelection"
            >
              新增預約
            </button>
            <button
              v-if="selectionMode"
              class="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-50"
              @click="resetSelection"
            >
              取消選擇
            </button>
          </div>
        </div>

        <div class="overflow-x-auto">
          <div class="calendar-container">
            <!-- Time column -->
            <div class="time-column">
              <div class="day-header-cell" />
              <div class="time-grid">
                <div v-for="hour in displayHours" :key="hour" class="time-label">
                  <span>{{ hour }}:00</span>
                </div>
              </div>
            </div>

            <!-- Day columns -->
            <div v-for="day in weekDays" :key="day.key" class="day-column" :class="{ 'day-unavailable': !isAnyDayAvailable(day.dayOfWeek) }">
              <div class="day-header-cell" :class="{ 'is-today': isToday(day.dateObj) }">
                <div class="day-name">
                  {{ day.label }}
                </div>
                <div class="day-date" :class="{ 'today-badge': isToday(day.dateObj) }">
                  {{ day.dateObj.getDate() }}
                </div>
              </div>
              <div
                class="day-grid"
                @click="onDayGridClick($event, day)"
                @mousemove="onDayGridHover($event, day)"
                @mouseleave="onDayGridLeave"
              >
                <!-- Hour slots background -->
                <div v-for="hour in displayHours" :key="hour" class="hour-slot">
                  <div class="half-hour-line" />
                </div>

                <!-- Past time disabled overlay (when selecting start time) -->
                <div
                  v-if="selectionMode !== 'end' && getPastTimeHeight(day) > 0"
                  class="past-time-overlay"
                  :style="{ height: `${getPastTimeHeight(day)}px` }"
                >
                  <div class="past-time-label">
                    已過時段
                  </div>
                </div>

                <!-- Hover preview (when selecting end time) -->
                <div
                  v-if="selectionMode === 'end' && selectedStart?.day.key === day.key && hoverSlot"
                  class="hover-preview-overlay"
                  :style="getHoverPreviewStyle(day)"
                >
                  <div class="hover-duration-badge">
                    {{ hoverDuration }} 分鐘
                  </div>
                </div>

                <!-- Selection overlay -->
                <div
                  v-if="isSelectionInDay(day)"
                  class="selection-overlay"
                  :style="getSelectionStyle(day)"
                />

                <!-- Events -->
                <div
                  v-for="event in getDayEvents(day)"
                  :key="event.id"
                  class="event-card"
                  :style="getEventStyle(event)"
                  @click.stop="openEditModal(event)"
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
      </div>
    </div>

    <!-- 新增預約 Modal -->
    <Teleport to="body">
      <div
        v-if="showBookingForm && selectedStart && selectedEnd"
        class="fixed inset-0 z-50 flex items-center justify-center bg-black/40"
        @click.self="resetSelection"
      >
        <div class="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl">
          <div class="flex items-center justify-between">
            <h3 class="text-lg font-semibold text-slate-900">
              確認預約
            </h3>
            <button
              class="rounded-full p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
              @click="resetSelection"
            >
              <svg class="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          <div class="mt-4 rounded-lg bg-slate-50 p-3 text-sm text-slate-600">
            <div class="grid grid-cols-2 gap-2">
              <div><span class="font-medium text-slate-500">日期：</span>{{ selectedStart.day.label }} ({{ selectedStart.day.date }})</div>
              <div><span class="font-medium text-slate-500">時長：</span>{{ calculateDuration() }} 分鐘</div>
              <div class="col-span-2">
                <span class="font-medium text-slate-500">時段：</span>{{ formatSlotTime(selectedStart.slot) }} - {{ formatSlotEndTime(selectedEnd.slot) }}
              </div>
            </div>
            <div v-if="selectedResourceIds.length > 1" class="mt-3 border-t border-slate-200 pt-3">
              <span class="font-medium text-slate-500">預約資源：</span>
              <div class="mt-2 space-y-2">
                <div
                  v-for="resId in selectedResourceIds"
                  :key="resId"
                  class="flex items-center gap-2"
                >
                  <span
                    class="inline-block rounded px-2 py-0.5 text-xs font-medium"
                    :style="{
                      backgroundColor: `${getResourceColor(resId)}20`,
                      color: getResourceColor(resId),
                      borderLeft: `3px solid ${getResourceColor(resId)}`,
                    }"
                  >
                    {{ resources.find(r => r.id === resId)?.name }}
                  </span>
                  <input
                    :value="formatDateTimeLocal(multiResourceTimes.get(resId)?.from || '')"
                    type="datetime-local"
                    class="rounded border border-slate-300 px-2 py-1 text-xs"
                    @change="(e) => updateResourceTime(resId, 'from', e.target.value)"
                  >
                  <span class="text-slate-400">-</span>
                  <input
                    :value="formatDateTimeLocal(multiResourceTimes.get(resId)?.to || '')"
                    type="datetime-local"
                    class="rounded border border-slate-300 px-2 py-1 text-xs"
                    @change="(e) => updateResourceTime(resId, 'to', e.target.value)"
                  >
                </div>
              </div>
            </div>
          </div>

          <div class="mt-4 space-y-4">
            <div>
              <label class="text-sm font-medium text-slate-700">預約名稱</label>
              <input
                v-model="bookingName"
                class="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm focus:border-brand-500 focus:ring-1 focus:ring-brand-500"
                placeholder="例如：王小明 諮詢"
                autofocus
              >
            </div>
            <div v-if="showDescriptionField">
              <label class="text-sm font-medium text-slate-700">備註</label>
              <textarea
                v-model="bookingDescription"
                class="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm focus:border-brand-500 focus:ring-1 focus:ring-brand-500"
                rows="3"
                placeholder="選填：備註資訊..."
              />
            </div>
            <div>
              <label class="text-sm font-medium text-slate-700">顏色標籤</label>
              <div class="mt-1 flex items-center gap-3">
                <input
                  v-model="bookingColor"
                  type="color"
                  class="h-10 w-16 cursor-pointer rounded border border-slate-300"
                >
                <div
                  class="flex-1 rounded-lg border px-3 py-2 text-sm"
                  :style="{ backgroundColor: `${bookingColor}15`, color: bookingColor, borderColor: bookingColor }"
                >
                  {{ bookingColor }}
                </div>
                <button
                  type="button"
                  class="rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs text-slate-600 hover:bg-slate-50"
                  @click="resetColor"
                >
                  重置
                </button>
              </div>
            </div>
          </div>

          <div class="mt-6 flex gap-3">
            <button
              class="flex-1 rounded-lg bg-brand-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-brand-700 disabled:opacity-60"
              :disabled="submitting || !bookingName.trim() || selectedResourceIds.length === 0"
              @click="submitBooking"
            >
              {{ submitting ? '送出中…' : `確認預約${selectedResourceIds.length > 1 ? ` (${selectedResourceIds.length}個)` : ''}` }}
            </button>
            <button
              class="rounded-lg border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50"
              @click="resetSelection"
            >
              取消
            </button>
          </div>
        </div>
      </div>
    </Teleport>

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
            :style="{ backgroundColor: getAssignmentColor(activePopout.assignment.id) }"
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
            class="w-full text-xs text-brand-600 hover:text-brand-700 font-medium"
            @click="openEditModal(activePopout.assignment)"
          >
            點擊編輯
          </button>
        </div>
      </div>
    </Teleport>

    <!-- 編輯預約 Modal -->
    <Teleport to="body">
      <div
        v-if="showEditModal && editingEvent"
        class="fixed inset-0 z-50 flex items-center justify-center bg-black/40"
        @click.self="closeEditModal"
      >
        <div class="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl">
          <div class="flex items-center justify-between">
            <h3 class="text-lg font-semibold text-slate-900">
              編輯預約
            </h3>
            <button
              class="rounded-full p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
              @click="closeEditModal"
            >
              <svg class="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          <div class="mt-4 rounded-lg bg-slate-50 p-3 text-sm text-slate-600">
            <div class="grid grid-cols-2 gap-2">
              <div><span class="font-medium text-slate-500">資源：</span>{{ editingEvent.resourceName }}</div>
              <div><span class="font-medium text-slate-500">時段：</span>{{ formatEventTime(editingEvent.from) }} - {{ formatEventTime(editingEvent.to || editingEvent.from) }}</div>
              <div class="col-span-2">
                <span class="font-medium text-slate-500">日期：</span>{{ formatDateTime(editingEvent.from).split(' ')[0] }}
              </div>
            </div>
          </div>

          <div class="mt-4 space-y-4">
            <div>
              <label class="text-sm font-medium text-slate-700">開始時間</label>
              <input
                v-model="editFromDate"
                type="datetime-local"
                class="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm focus:border-brand-500 focus:ring-1 focus:ring-brand-500"
              >
            </div>
            <div>
              <label class="text-sm font-medium text-slate-700">結束時間</label>
              <input
                v-model="editToDate"
                type="datetime-local"
                class="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm focus:border-brand-500 focus:ring-1 focus:ring-brand-500"
              >
            </div>
            <div>
              <label class="text-sm font-medium text-slate-700">預約名稱</label>
              <input
                v-model="editName"
                class="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm focus:border-brand-500 focus:ring-1 focus:ring-brand-500"
                placeholder="例如：王小明 諮詢"
                autofocus
              >
            </div>
            <div v-if="showDescriptionField">
              <label class="text-sm font-medium text-slate-700">備註</label>
              <textarea
                v-model="editDescription"
                class="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm focus:border-brand-500 focus:ring-1 focus:ring-brand-500"
                rows="3"
                placeholder="選填：備註資訊..."
              />
            </div>
            <div>
              <label class="text-sm font-medium text-slate-700">顏色標籤</label>
              <div class="mt-1 flex items-center gap-3">
                <input
                  v-model="editColor"
                  type="color"
                  class="h-10 w-16 cursor-pointer rounded border border-slate-300"
                >
                <div
                  class="flex-1 rounded-lg border px-3 py-2 text-sm"
                  :style="{ backgroundColor: `${editColor}15`, color: editColor, borderColor: editColor }"
                >
                  {{ editColor }}
                </div>
              </div>
            </div>
          </div>

          <div class="mt-6 flex gap-3">
            <button
              class="flex-1 rounded-lg bg-brand-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-brand-700 disabled:opacity-60"
              :disabled="submitting || !editName.trim() || !editFromDate || !editToDate"
              @click="saveEdit"
            >
              {{ submitting ? '儲存中…' : '儲存變更' }}
            </button>
            <button
              class="rounded-lg border border-rose-200 bg-rose-50 px-4 py-2.5 text-sm font-semibold text-rose-600 hover:bg-rose-100 disabled:opacity-60"
              :disabled="deleting"
              @click="confirmDelete"
            >
              {{ deleting ? '刪除中…' : '刪除' }}
            </button>
          </div>
        </div>
      </div>
    </Teleport>
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

.day-column.day-unavailable {
  background: #f1f5f9;
  cursor: not-allowed;
}

.day-column.day-unavailable .day-header-cell {
  background: #e2e8f0;
}

.day-grid {
  position: relative;
  height: calc(60px * v-bind('displayHours.length'));
  cursor: cell;
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

.past-time-overlay {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  background: repeating-linear-gradient(
    -45deg,
    rgba(148, 163, 184, 0.08),
    rgba(148, 163, 184, 0.08) 8px,
    rgba(148, 163, 184, 0.15) 8px,
    rgba(148, 163, 184, 0.15) 16px
  );
  cursor: not-allowed;
  z-index: 2;
  display: flex;
  align-items: flex-end;
  justify-content: center;
  padding-bottom: 8px;
}

.past-time-label {
  background: rgba(100, 116, 139, 0.7);
  color: white;
  font-size: 10px;
  font-weight: 500;
  padding: 2px 8px;
  border-radius: 8px;
  opacity: 0.8;
}

.hover-preview-overlay {
  position: absolute;
  left: 2px;
  right: 2px;
  background: linear-gradient(180deg, rgba(34, 197, 94, 0.25) 0%, rgba(34, 197, 94, 0.15) 100%);
  border: 2px solid rgba(34, 197, 94, 0.7);
  border-radius: 6px;
  pointer-events: none;
  z-index: 4;
  transition: all 0.1s ease-out;
  display: flex;
  align-items: flex-end;
  justify-content: center;
  padding-bottom: 4px;
}

.hover-duration-badge {
  background: rgba(34, 197, 94, 0.9);
  color: white;
  font-size: 11px;
  font-weight: 600;
  padding: 2px 8px;
  border-radius: 10px;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.2);
}

.selection-overlay {
  position: absolute;
  left: 0;
  right: 0;
  background: rgba(59, 130, 246, 0.2);
  border: 2px dashed #3b82f6;
  border-radius: 4px;
  pointer-events: none;
  z-index: 5;
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
