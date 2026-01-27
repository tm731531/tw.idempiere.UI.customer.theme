<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import ErrorMessage from '../../components/ErrorMessage.vue'
import { useAuth } from '../../features/auth/store'
import { listMomData, type MomData, getLatestMomRecordId, uploadMomAttachment, createMomData, updateMomData, generateGeminiContent, getGeminiApiKey, fetchMomColumnMetadata, type MomPayload, completeMomRecord, runMomCompleteProcess, getMomAttachments, uploadMomPhoto, type MomAttachment, getMomAttachmentData } from '../../features/mom/api'
import { listRequests, type Request as RequestData } from '../../features/request/api'
import { toPng } from 'html-to-image'
import jsPDF from 'jspdf'
import html2pdf from 'html2pdf.js'

const auth = useAuth()

const loading = ref(false)
const exporting = ref(false)
const error = ref<string | null>(null)
const successMessage = ref<string | null>(null)
const records = ref<MomData[]>([])
const reportArea = ref<HTMLElement | null>(null)
const showModal = ref(false)
const modalMode = ref<'create' | 'edit' | 'ai'>('create')
const editingId = ref<number | null>(null)

// Form State
const form = ref({
    documentDate: new Date().toISOString().split('T')[0],
    name: 'Mom',
    description: '',
    nightActivity: '無',
    beforeSleepStatus: '正常',
    lastNightSleep: '正常',
    morningMentalStatus: '正常',
    breakfast: '正常',
    dailyActivity: '正常',
    lunch: '正常',
    outgoing: '無',
    dinner: '正常',
    companionship: '無',
    excretionStatus: '正常',
    bathing: '正常',
    safetyIncident: '無',
    // 生理數據
    systolicBP: null as number | null,
    diastolicBP: null as number | null,
    pulse: null as number | null,
    bpNote: ''
})

// AI State
interface AiSummary {
  period: string
  overall_summary: string
  sections: Array<{
    title: string
    status: 'Stable' | 'Vigilant' | 'Observation' | 'Critical'
    content: string
  }>
  conclusion: string
  type?: 'data' | 'medical'
}
const aiDataSummary = ref<AiSummary | null>(null)
const aiMedicalSummary = ref<AiSummary | null>(null)
const aiGenerating = ref(false)
const aiTarget = ref<'data' | 'medical'>('data')

// Metadata State
const options = ref<Record<string, { value: string, label: string }[]>>({})
const fieldLabels = ref<Record<string, string>>({})
const fieldDefaults = ref<Record<string, string>>({})

const defaultStatusList = [
    { value: '', label: '' },
    { value: '正常', label: '正常' },
    { value: '異常', label: '異常' },
    { value: '無', label: '無' }
]

function getLabel(key: string, value?: string) {
    if (!value) return '—'
    const camelKey = key.charAt(0).toLowerCase() + key.slice(1)
    const list = options.value[camelKey]
    if (list) {
        const item = list.find(x => x.value === value)
        if (item) return item.label
    }
    return value
}

// Filters
const dateFrom = ref(new Date(new Date().setDate(new Date().getDate() - 30)).toISOString().split('T')[0])
const dateTo = ref(new Date().toISOString().split('T')[0])

// Charts
const chartMetric = ref<keyof MomData>('morningMentalStatus')
const availableMetrics = computed(() => [
  { label: fieldLabels.value['morningMentalStatus'] || '起床精神', value: 'morningMentalStatus' },
  { label: fieldLabels.value['lastNightSleep'] || '昨夜睡眠', value: 'lastNightSleep' },
  { label: fieldLabels.value['beforeSleepStatus'] || '睡前狀況', value: 'beforeSleepStatus' },
  { label: fieldLabels.value['breakfast'] || '早餐', value: 'breakfast' },
  { label: fieldLabels.value['lunch'] || '午餐', value: 'lunch' },
  { label: fieldLabels.value['dinner'] || '晚餐', value: 'dinner' },
  { label: fieldLabels.value['dailyActivity'] || '活動', value: 'dailyActivity' },
  { label: fieldLabels.value['excretionStatus'] || '排泄狀況', value: 'excretionStatus' },
  { label: fieldLabels.value['bathing'] || '洗澡', value: 'bathing' },
  { label: '外出狀況', value: 'outgoing' },
  { label: '陪伴狀況', value: 'companionship' },
  { label: fieldLabels.value['nightActivity'] || '夜間活動', value: 'nightActivity' },
  { label: fieldLabels.value['safetyIncident'] || '安全事件', value: 'safetyIncident' }
])

// ===== 趨勢分析 =====
const trendMetrics = ref<(keyof MomData)[]>(['morningMentalStatus', 'lastNightSleep', 'breakfast'])

// 狀態評分系統：將文字狀態轉換為數值 (1-5)
function getStatusScore(label: string): number {
  const scores: Record<string, number> = {
    // 5 = 優良
    '優良': 5, '良好': 5, '有精神': 5,
    // 4 = 正常
    '正常': 4, '穩定': 4, '完成': 4, '無': 4,
    // 3 = 一般
    '一般': 3, '尚可': 3,
    // 2 = 較差
    '疲憊': 2, '差': 2, '未完成': 2, '嗜睡': 2,
    // 1 = 異常/警告
    '異常': 1, '極差': 1, '失禁': 1, '出血': 1, '跌倒': 1, '亢奮': 1, '焦慮': 1
  }
  return scores[label] || 3
}

// 趨勢線數據
const trendData = computed(() => {
  // 按日期排序 (舊 → 新)
  const sorted = [...records.value].sort((a, b) =>
    new Date(a.documentDate).getTime() - new Date(b.documentDate).getTime()
  )

  return trendMetrics.value.map(metric => {
    const points = sorted.map((record, index) => {
      const rawValue = record[metric]
      const label = typeof rawValue === 'string' ? getLabel(metric, rawValue) : ''
      const score = getStatusScore(label)
      const isAbnormal = score <= 2
      return {
        index,
        date: record.documentDate?.split(' ')[0] || '',
        label,
        score,
        isAbnormal
      }
    })

    const metricLabel = availableMetrics.value.find(m => m.value === metric)?.label || metric
    const color = getTrendColor(metric)

    return { metric, metricLabel, points, color }
  })
})

function getTrendColor(metric: keyof MomData): string {
  const colors: Record<string, string> = {
    morningMentalStatus: '#3b82f6', // blue
    lastNightSleep: '#8b5cf6',      // purple
    beforeSleepStatus: '#6366f1',   // indigo
    breakfast: '#10b981',           // emerald
    lunch: '#14b8a6',               // teal
    dinner: '#06b6d4',              // cyan
    dailyActivity: '#f59e0b',       // amber
    excretionStatus: '#ef4444',     // red
    bathing: '#ec4899',             // pink
    outgoing: '#64748b',            // slate
    companionship: '#84cc16',       // lime
    nightActivity: '#a855f7',       // violet
    safetyIncident: '#dc2626'       // red-600
  }
  return colors[metric] || '#6b7280'
}

// SVG 折線圖路徑生成
const trendSvgData = computed(() => {
  const width = 600
  const height = 200
  const padding = { top: 20, right: 20, bottom: 30, left: 40 }
  const chartWidth = width - padding.left - padding.right
  const chartHeight = height - padding.top - padding.bottom

  const maxPoints = Math.max(...trendData.value.map(d => d.points.length), 1)
  const xStep = maxPoints > 1 ? chartWidth / (maxPoints - 1) : chartWidth

  // Y 軸：1-5 分
  const yScale = (score: number) => padding.top + chartHeight - ((score - 1) / 4) * chartHeight
  const xScale = (index: number) => padding.left + index * xStep

  // 生成每條線的路徑和點
  const lines = trendData.value.map(trend => {
    if (trend.points.length === 0) return { ...trend, path: '', circles: [] }

    const pathPoints = trend.points.map((p, i) => {
      const x = xScale(i)
      const y = yScale(p.score)
      return `${i === 0 ? 'M' : 'L'} ${x} ${y}`
    }).join(' ')

    const circles = trend.points.map((p, i) => ({
      cx: xScale(i),
      cy: yScale(p.score),
      date: p.date,
      label: p.label,
      score: p.score,
      isAbnormal: p.isAbnormal
    }))

    return { ...trend, path: pathPoints, circles }
  })

  // Y 軸刻度
  const yTicks = [1, 2, 3, 4, 5].map(score => ({
    y: yScale(score),
    label: ['異常', '較差', '一般', '正常', '優良'][score - 1]
  }))

  // X 軸日期標籤 (只顯示部分)
  const xLabels = trendData.value[0]?.points
    .filter((_, i, arr) => arr.length <= 7 || i % Math.ceil(arr.length / 7) === 0 || i === arr.length - 1)
    .map(p => ({
      x: xScale(p.index),
      label: p.date.slice(5) // MM-DD
    })) || []

  return { width, height, padding, lines, yTicks, xLabels }
})

// 新增/移除趨勢指標
function toggleTrendMetric(metric: keyof MomData) {
  const idx = trendMetrics.value.indexOf(metric)
  if (idx >= 0) {
    if (trendMetrics.value.length > 1) {
      trendMetrics.value.splice(idx, 1)
    }
  } else {
    if (trendMetrics.value.length < 5) {
      trendMetrics.value.push(metric)
    }
  }
}

// ===== 近期預約 (Request Calendar) =====
const upcomingRequests = ref<RequestData[]>([])
const requestsLoading = ref(false)

async function loadUpcomingRequests() {
  if (!auth.token.value) return
  requestsLoading.value = true
  try {
    // 載入有 StartDate 的 Request，篩選未來 7 天內的
    const result = await listRequests(auth.token.value, {
      hasStartDate: true
    }, { top: 50 })

    const today = new Date()
    today.setHours(0, 0, 0, 0)

    const nextWeek = new Date(today)
    nextWeek.setDate(nextWeek.getDate() + 7)

    // 過濾出今天到未來 7 天的預約
    upcomingRequests.value = result.records
      .filter(r => {
        if (!r.startDate) return false
        const startDate = new Date(r.startDate)
        return startDate >= today && startDate <= nextWeek
      })
      .sort((a, b) => {
        const dateA = new Date(a.startDate || '')
        const dateB = new Date(b.startDate || '')
        return dateA.getTime() - dateB.getTime()
      })
      .slice(0, 5) // 最多顯示 5 筆
  } catch (e) {
    console.error('Failed to load upcoming requests:', e)
    upcomingRequests.value = []
  } finally {
    requestsLoading.value = false
  }
}

function formatRequestDate(dateStr?: string): string {
  if (!dateStr) return ''
  const date = new Date(dateStr)
  const month = date.getMonth() + 1
  const day = date.getDate()
  const weekdays = ['日', '一', '二', '三', '四', '五', '六']
  const weekday = weekdays[date.getDay()]
  return `${month}/${day} (${weekday})`
}

function isToday(dateStr?: string): boolean {
  if (!dateStr) return false
  const date = new Date(dateStr)
  const today = new Date()
  return date.toDateString() === today.toDateString()
}

function isTomorrow(dateStr?: string): boolean {
  if (!dateStr) return false
  const date = new Date(dateStr)
  const tomorrow = new Date()
  tomorrow.setDate(tomorrow.getDate() + 1)
  return date.toDateString() === tomorrow.toDateString()
}

// ===== 照片附件 =====
const attachments = ref<MomAttachment[]>([])
const photoDataMap = ref<Record<string, string>>({}) // Store base64 data for photos
const photoLoadingMap = ref<Record<string, boolean>>({}) // Track loading state for each photo
const photoUploading = ref(false)
const photoInputRef = ref<HTMLInputElement | null>(null)
const showPhotoModal = ref(false)
const currentPhotoRecordId = ref<number | null>(null)

// 載入附件列表
async function loadAttachments(recordId: number) {
  if (!auth.token.value) return
  try {
    const list = await getMomAttachments(auth.token.value, recordId)
    attachments.value = list

    // Pre-fetch photo data for images specifically
    const photos = list.filter(a => /\.(jpg|jpeg|png|gif|webp)$/i.test(a.name))
    for (const photo of photos) {
      if (!photoDataMap.value[photo.name]) {
        fetchSpecificPhoto(recordId, photo.name)
      }
    }
  } catch (e) {
    console.error('Failed to load attachments:', e)
    attachments.value = []
  }
}

async function fetchSpecificPhoto(recordId: number, filename: string) {
  if (!auth.token.value) return
  photoLoadingMap.value[filename] = true
  try {
    const blob = await getMomAttachmentData(auth.token.value, recordId, filename)
    if (blob) {
      const reader = new FileReader()
      reader.onloadend = () => {
        photoDataMap.value[filename] = reader.result as string
      }
      reader.readAsDataURL(blob)
    }
  } catch (e) {
    console.error(`Failed to fetch photo data for ${filename}:`, e)
  } finally {
    photoLoadingMap.value[filename] = false
  }
}

// 開啟照片模態框
function openPhotoModal(recordId: number) {
  currentPhotoRecordId.value = recordId
  showPhotoModal.value = true
  loadAttachments(recordId)
}

// 上傳照片
async function handlePhotoUpload(event: Event) {
  const input = event.target as HTMLInputElement
  if (!input.files || input.files.length === 0) return
  if (!auth.token.value || !currentPhotoRecordId.value) return

  photoUploading.value = true
  try {
    for (const file of Array.from(input.files)) {
      await uploadMomPhoto(auth.token.value, currentPhotoRecordId.value, file)
    }
    successMessage.value = '照片上傳成功！'
    setTimeout(() => successMessage.value = null, 3000)
    // 重新載入附件列表
    await loadAttachments(currentPhotoRecordId.value)
  } catch (e: any) {
    error.value = `照片上傳失敗: ${e.message || e}`
  } finally {
    photoUploading.value = false
    // 清空 input
    if (input) input.value = ''
  }
}

// 過濾出照片附件
const photoAttachments = computed(() =>
  attachments.value.filter(a => /\.(jpg|jpeg|png|gif|webp)$/i.test(a.name))
)

// 過濾出 PDF 附件
const pdfAttachments = computed(() =>
  attachments.value.filter(a => /\.pdf$/i.test(a.name))
)

// 生成附件 URL (用於預覽)
function getAttachmentUrl(recordId: number, filename: string): string {
  // iDempiere REST API 附件 URL 格式
  return `/api/v1/models/Z_momSystem/${recordId}/attachments/${encodeURIComponent(filename)}`
}

// ===== 交班筆記 Merge/Split =====
type ShiftType = 'NIGHT' | 'GRAVEYARD' | 'DAY'

interface ShiftNote {
  shift: ShiftType
  time: string
  content: string
}

const shiftLabels: Record<ShiftType, string> = {
  NIGHT: '🌙 夜班 (19:00-23:00)',
  GRAVEYARD: '🌃 大夜班 (23:00-07:00)',
  DAY: '☀️ 早班 (07:00-19:00)'
}

const shiftColors: Record<ShiftType, string> = {
  NIGHT: '#6366f1',    // indigo
  GRAVEYARD: '#8b5cf6', // purple
  DAY: '#f59e0b'        // amber
}

// 解析 MEMO → 結構化筆記
function parseMemo(memo: string): ShiftNote[] {
  if (!memo) return []

  // 檢查是否有新格式標記
  if (!memo.includes('[NIGHT|') && !memo.includes('[GRAVEYARD|') && !memo.includes('[DAY|')) {
    // 舊格式：整段當作一個「未分類」筆記
    if (memo.trim()) {
      return [{
        shift: 'DAY',
        time: '00:00',
        content: memo.trim()
      }]
    }
    return []
  }

  const notes: ShiftNote[] = []
  const regex = /\[(NIGHT|GRAVEYARD|DAY)\|(\d{2}:\d{2})\]([^\[]*)/g
  let match

  while ((match = regex.exec(memo)) !== null) {
    const content = match[3].trim()
    if (content) {
      notes.push({
        shift: match[1] as ShiftType,
        time: match[2],
        content
      })
    }
  }

  return notes
}

// 結構化筆記 → MEMO 字串
function mergeMemo(notes: ShiftNote[]): string {
  if (notes.length === 0) return ''

  // 按班別順序 + 時間排序
  const order: Record<ShiftType, number> = { NIGHT: 1, GRAVEYARD: 2, DAY: 3 }
  const sorted = [...notes].sort((a, b) => {
    if (order[a.shift] !== order[b.shift]) {
      return order[a.shift] - order[b.shift]
    }
    return a.time.localeCompare(b.time)
  })

  return sorted
    .map(n => `[${n.shift}|${n.time}]${n.content}`)
    .join('\n')
}

// 自動判斷當前班別
function getCurrentShift(): ShiftType {
  const hour = new Date().getHours()
  if (hour >= 19 && hour < 23) return 'NIGHT'
  if (hour >= 23 || hour < 7) return 'GRAVEYARD'
  return 'DAY'
}

// 當前時間字串
function getCurrentTime(): string {
  const now = new Date()
  return `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`
}

// 交班筆記表單狀態
const shiftNotes = ref<ShiftNote[]>([])
const newNoteContent = ref('')
const newNoteShift = ref<ShiftType>(getCurrentShift())

// 當編輯模態框開啟時，解析現有 memo
function loadShiftNotes(memo: string) {
  shiftNotes.value = parseMemo(memo)
}

// 新增筆記
function addShiftNote() {
  if (!newNoteContent.value.trim()) return

  shiftNotes.value.push({
    shift: newNoteShift.value,
    time: getCurrentTime(),
    content: newNoteContent.value.trim()
  })

  newNoteContent.value = ''
  // 更新 form.description
  form.value.description = mergeMemo(shiftNotes.value)
}

// 刪除筆記
function deleteShiftNote(index: number) {
  shiftNotes.value.splice(index, 1)
  form.value.description = mergeMemo(shiftNotes.value)
}

// 更新筆記內容
function updateShiftNoteContent(index: number, content: string) {
  shiftNotes.value[index].content = content
  form.value.description = mergeMemo(shiftNotes.value)
}

// 依班別分組的筆記
const groupedNotes = computed(() => {
  const groups: Record<ShiftType, ShiftNote[]> = {
    NIGHT: [],
    GRAVEYARD: [],
    DAY: []
  }

  for (const note of shiftNotes.value) {
    groups[note.shift].push(note)
  }

  return groups
})

// ===== 異常警示統計 =====
const abnormalAlerts = computed(() => {
  const alerts: { date: string; metric: string; label: string; description?: string }[] = []

  for (const record of records.value) {
    const date = record.documentDate?.split(' ')[0] || ''

    // 檢查各項指標
    const checks: { key: keyof MomData; metricName: string }[] = [
      { key: 'morningMentalStatus', metricName: '起床精神' },
      { key: 'lastNightSleep', metricName: '昨夜睡眠' },
      { key: 'excretionStatus', metricName: '排泄狀況' },
      { key: 'safetyIncident', metricName: '安全事件' },
      { key: 'breakfast', metricName: '早餐' },
      { key: 'lunch', metricName: '午餐' },
      { key: 'dinner', metricName: '晚餐' }
    ]

    for (const check of checks) {
      const rawValue = record[check.key]
      if (typeof rawValue === 'string' && rawValue) {
        const label = getLabel(check.key, rawValue)
        const score = getStatusScore(label)
        if (score <= 2) {
          alerts.push({
            date,
            metric: fieldLabels.value[check.key] || check.metricName,
            label,
            description: record.description
          })
        }
      }
    }
  }

  // 按日期倒序
  return alerts.sort((a, b) => b.date.localeCompare(a.date)).slice(0, 10)
})

const stats = computed(() => {
  const map = new Map<string, number>()
  for (const r of records.value) {
    const val = r[chartMetric.value]
    if (val && typeof val === 'string') {
      const label = getLabel(chartMetric.value, val)
      map.set(label, (map.get(label) || 0) + 1)
    }
  }
  return Array.from(map.entries()).map(([label, count]) => ({ label, count }))
})

const pieSlices = computed(() => {
  const total = stats.value.reduce((sum, s) => sum + s.count, 0)
  if (total === 0) return []
  let currentAngle = 0
  const getColor = (label: string, index: number) => {
    const positive = ['正常', '穩定', '完成', '良好', '優良', '有精神']
    const neutral = ['一般', '尚可', '未完成', '無']
    const negative = ['亢奮', '疲憊', '差', '極差', '異常', '失禁', '出血', '跌倒', '嗜睡', '焦慮']
    if (positive.includes(label)) return '#10b981'
    if (negative.includes(label)) return '#f43f5e'
    if (neutral.includes(label)) return '#f59e0b'
    return ['#3b82f6', '#8b5cf6', '#ec4899', '#64748b', '#2dd4bf'][index % 5]
  }
  return stats.value.map((s, i) => {
    const angle = (s.count / total) * 360
    const startAngle = currentAngle
    currentAngle += angle
    const percent = Math.round((s.count / total) * 100)
    if (angle >= 359.9) return { label: s.label, count: s.count, isFull: true, color: getColor(s.label, i), percent }
    const x1 = 50 + 40 * Math.cos((startAngle - 90) * Math.PI / 180)
    const y1 = 50 + 40 * Math.sin((startAngle - 90) * Math.PI / 180)
    const x2 = 50 + 40 * Math.cos((currentAngle - 90) * Math.PI / 180)
    const y2 = 50 + 40 * Math.sin((currentAngle - 90) * Math.PI / 180)
    return {
      label: s.label, count: s.count, isFull: false,
      path: `M 50 50 L ${x1} ${y1} A 40 40 0 ${angle > 180 ? 1 : 0} 1 ${x2} ${y2} Z`,
      color: getColor(s.label, i),
      percent
    }
  })
})

async function loadData() {
  if (!auth.token.value) return
  loading.value = true
  try {
    const [res, meta] = await Promise.all([
        listMomData(auth.token.value, { dateFrom: dateFrom.value, dateTo: dateTo.value }),
        fetchMomColumnMetadata(auth.token.value)
    ])
    // 同時載入近期預約（不阻塞主要資料）
    loadUpcomingRequests()
    records.value = res.records
    for (const [key, list] of Object.entries(meta.options)) {
        options.value[key.charAt(0).toLowerCase() + key.slice(1)] = [{ value: '', label: '' }, ...list]
    }
    for (const [key, label] of Object.entries(meta.labels)) {
        fieldLabels.value[key.charAt(0).toLowerCase() + key.slice(1)] = label
    }
    const findValue = (key: string, def: string) => {
        const list = options.value[key.charAt(0).toLowerCase() + key.slice(1)]
        if (!list) return def
        return list.find(x => x.value === def || x.label === def)?.value || def
    }
    for (const [key, def] of Object.entries(meta.defaults)) {
        fieldDefaults.value[key.charAt(0).toLowerCase() + key.slice(1)] = findValue(key, def)
    }
  } catch (e: any) { error.value = e?.message || '載入失敗' }
  finally { loading.value = false }
}

function openCreateModal() {
    modalMode.value = 'create'
    editingId.value = null
    const resolve = (key: string, fallback: string) => {
        const val = fieldDefaults.value[key]
        if (val) return val
        return options.value[key]?.find(x => x.label === fallback)?.value || fallback
    }
    form.value = {
        documentDate: fieldDefaults.value.documentDate || new Date().toISOString().split('T')[0],
        name: fieldDefaults.value.name || '孫玉美',
        description: fieldDefaults.value.description || '',
        nightActivity: resolve('nightActivity', ''),
        beforeSleepStatus: resolve('beforeSleepStatus', ''),
        lastNightSleep: resolve('lastNightSleep', ''),
        morningMentalStatus: resolve('morningMentalStatus', ''),
        breakfast: resolve('breakfast', ''),
        dailyActivity: resolve('dailyActivity', ''),
        lunch: resolve('lunch', ''),
        outgoing: resolve('outgoing', ''),
        dinner: resolve('dinner', ''),
        companionship: resolve('companionship', ''),
        excretionStatus: resolve('excretionStatus', ''),
        bathing: resolve('bathing', ''),
        safetyIncident: resolve('safetyIncident', ''),
        // 生理數據
        systolicBP: null,
        diastolicBP: null,
        pulse: null,
        bpNote: ''
    }
    // 重置交班筆記
    shiftNotes.value = []
    newNoteContent.value = ''
    newNoteShift.value = getCurrentShift()
    showModal.value = true
}

function openEditModal(row: MomData) {
    modalMode.value = 'edit'
    editingId.value = row.id
    form.value = {
        documentDate: row.documentDate ? row.documentDate.split(' ')[0] : '',
        name: row.name,
        description: row.description || '',
        nightActivity: row.nightActivity || '',
        beforeSleepStatus: row.beforeSleepStatus || '',
        lastNightSleep: row.lastNightSleep || '',
        morningMentalStatus: row.morningMentalStatus || '',
        breakfast: row.breakfast || '',
        dailyActivity: row.dailyActivity || '',
        lunch: row.lunch || '',
        outgoing: row.outgoing || '',
        dinner: row.dinner || '',
        companionship: row.companionship || '',
        excretionStatus: row.excretionStatus || '',
        bathing: row.bathing || '',
        safetyIncident: row.safetyIncident || '',
        // 生理數據
        systolicBP: row.systolicBP ?? null,
        diastolicBP: row.diastolicBP ?? null,
        pulse: row.pulse ?? null,
        bpNote: row.bpNote || ''
    }
    // 載入交班筆記
    loadShiftNotes(row.description || '')
    newNoteContent.value = ''
    newNoteShift.value = getCurrentShift()
    showModal.value = true
}

function openAiModal(type: 'data' | 'medical') {
  aiTarget.value = type
  modalMode.value = 'ai'
  showModal.value = true
}

async function handleAiGenerate() {
  if (!auth.token.value) return
  aiGenerating.value = true
  try {
    const apiKey = await getGeminiApiKey(auth.token.value)
    if (!apiKey) throw new Error('未設定 API Key')

    const dataText = records.value.map((r) => {
      const bp = r.systolicBP || r.diastolicBP
        ? `血壓: ${r.systolicBP || '-'}/${r.diastolicBP || '-'}${r.pulse ? ` 脈搏: ${r.pulse}` : ''}${r.bpNote ? ` (${r.bpNote})` : ''}`
        : '血壓: 未測量'
      return `日期: ${r.documentDate}, 精神: ${getLabel('morningMentalStatus', r.morningMentalStatus)},
             睡眠: ${getLabel('lastNightSleep', r.lastNightSleep)},
             睡前: ${getLabel('beforeSleepStatus', r.beforeSleepStatus)},
             早餐: ${getLabel('breakfast', r.breakfast)},
             午餐: ${getLabel('lunch', r.lunch)},
             晚餐: ${getLabel('dinner', r.dinner)},
             前晚活動: ${getLabel('nightActivity', r.nightActivity)},
             早餐活動: ${getLabel('dailyActivity', r.dailyActivity)},
             午餐外出: ${getLabel('outgoing', r.outgoing)},
             晚餐陪伴: ${getLabel('companionship', r.companionship)},
             排泄: ${getLabel('excretionStatus', r.excretionStatus)},
             洗澡: ${getLabel('bathing', r.bathing)}, ${bp}, 備註: ${r.description || '無'}`
    }).join('\n')

    const isMedical = aiTarget.value === 'medical'
    const prompt = isMedical 
      ? `你是一位專業的長期照護臨床顧問。請根據以下照護紀錄，從「醫療與臨床觀點」產出一份結構化的分析報告，供主治醫師參考。
報告語言：繁體中文（台灣）。

**重要規範：**
1. 站在醫療專業角度，分析數據背後可能的臨床意涵（如：睡眠障礙對情緒的影響、生理數值與日常表現的關聯）。
2. 提供臨床觀察重點（如：建議醫師關注某項指標的變動）。
3. 報告是提供給醫師看的，請保持專業、精確且中立。
4. **精簡扼要**：醫師閱讀時間寶貴，每個章節的內容請控制在 3~4 行以內 (約 80-100 字)，直接切入重點，避免冗長敘述。

請務必以 JSON 格式回傳，結構如下：
{
  "period": "YYYY/MM/DD - YYYY/MM/DD",
  "overall_summary": "對這段期間患者健康狀態的專業臨床評估總結 (精簡扼要)",
  "sections": [
    {
      "title": "臨床觀測分組 (例如：神經精神症狀分析、循環與代謝觀察、營養與體能評估)",
      "status": "Stable / Vigilant / Observation / Critical",
      "content": "精簡扼要的臨床觀察重點與數據交叉分析 (請勿長篇大論)"
    }
  ],
  "conclusion": "給醫師的專業提示與臨床觀察建議結語 (精簡扼要)"
}`
      : `你是一位專業的健康數據分析助理。請根據以下照護紀錄，產出一份「客觀數據量化分析」報告。
報告對象：主治醫師。
報告語言：繁體中文（台灣）。

**重要規範：**
1. 僅針對現有紀錄進行客觀彙整、統計與現象描述（如：出現頻率、具體日期、數值波動、數據分布）。
2. **絕對禁止**提供任何診斷建議、治療方案或病理判斷。
3. 保持數據導向，清晰呈現各項指標的統計現況。
4. **精簡扼要**：每個章節的內容請控制在 3~4 行以內 (約 80-100 字)，僅列出關鍵數據變化，避免流水帳。

請務必以 JSON 格式回傳，結構如下：
{
  "period": "YYYY/MM/DD - YYYY/MM/DD",
  "overall_summary": "對這段期間數據現象的客觀量化總結 (精簡扼要)",
  "sections": [
    {
      "title": "數據統計類別 (例如：睡眠時數統計、異常事件頻率、飲食攝取達成率)",
      "status": "Stable / Vigilant / Observation / Critical",
      "content": "精簡扼要的數據統計現象匯總 (請勿長篇大論)"
    }
  ],
  "conclusion": "數據趨勢的客觀結語 (精簡扼要)"
}`;

    const promptWithData = `${prompt}\n\n紀錄數據：\n${dataText}`

    const responseText = await generateGeminiContent(apiKey, promptWithData)

    // 清理可能包含的 Markdown 標記 (如 ```json ... ```)
    const jsonStr = responseText.replace(/```json/g, '').replace(/```/g, '').trim()
    const parsed = JSON.parse(jsonStr)

    if (isMedical) {
      aiMedicalSummary.value = { ...parsed, type: 'medical' }
    }
    else {
      aiDataSummary.value = { ...parsed, type: 'data' }
    }

    showModal.value = false
    successMessage.value = 'AI 摘要生成完畢！'
    setTimeout(() => { successMessage.value = null }, 3000)
  }
  catch (e: any) {
    console.error('AI Error:', e)
    error.value = e.message || 'AI 生成失敗'
  }
  finally {
    aiGenerating.value = false
  }
}

async function handleSave() {
    if (!auth.token.value) return
    loading.value = true
    try {
        const s = (v: string | undefined) => (v === '' ? null : v)
        const payload: MomPayload = {
            DateDoc: form.value.documentDate, Name: form.value.name, Description: form.value.description,
            NightActivity: s(form.value.nightActivity), BeforeSleepStatus: s(form.value.beforeSleepStatus),
            LastNightSleep: s(form.value.lastNightSleep), MorningMentalStatus: s(form.value.morningMentalStatus),
            Breakfast: s(form.value.breakfast), DailyActivity: s(form.value.dailyActivity),
            Lunch: s(form.value.lunch), outgoing: s(form.value.outgoing), Dinner: s(form.value.dinner),
            Companionship: s(form.value.companionship), ExcretionStatus: s(form.value.excretionStatus),
            Bathing: s(form.value.bathing), SafetyIncident: s(form.value.safetyIncident),
            // 生理數據 (PascalCase)
            SystolicBP: form.value.systolicBP,
            DiastolicBP: form.value.diastolicBP,
            Pulse: form.value.pulse,
            BPNote: form.value.bpNote || null
        }
        if (modalMode.value === 'create') await createMomData(auth.token.value, payload)
        else if (editingId.value) await updateMomData(auth.token.value, editingId.value, payload)
        showModal.value = false
        setTimeout(() => successMessage.value = null, 3000)
        loadData()
    } catch (e: any) { error.value = e.message || '儲存失敗' }
    finally { loading.value = false }
}

async function handleComplete(id: number) {
    if (!auth.token.value) return
    if (!confirm('您確定要執行完成程序嗎？執行後紀錄將會鎖定。')) return
    loading.value = true
    try {
        // Calling the dedicated process instead of just updating the status
        await runMomCompleteProcess(auth.token.value, id)
        successMessage.value = '完成程序已成功執行！'
        setTimeout(() => successMessage.value = null, 3000)
        loadData()
    } catch (e: any) {
        error.value = `程序執行失敗: ${e.message || e}`
        setTimeout(() => error.value = null, 5000)
    } finally {
        loading.value = false
    }
}

async function exportAndAttach() {
  if (!auth.token.value || !reportArea.value || exporting.value) return
  exporting.value = true
  error.value = null
  successMessage.value = null

  try {
    const latestId = await getLatestMomRecordId(auth.token.value)
    if (!latestId) throw new Error('找不到最新的紀錄，請確認資料庫已有資料')

    // 1. Custom Filename: 失智照顧 + YYYYMMDDHHMMSS
    const now = new Date()
    const timestamp = now.getFullYear().toString() + 
                      (now.getMonth() + 1).toString().padStart(2, '0') + 
                      now.getDate().toString().padStart(2, '0') + 
                      now.getHours().toString().padStart(2, '0') + 
                      now.getMinutes().toString().padStart(2, '0') + 
                      now.getSeconds().toString().padStart(2, '0')
    const filename = `失智照顧${timestamp}.pdf`

    // 2. Setup html2pdf options
    const opt = {
      margin: 10,
      filename: filename,
      image: { type: 'jpeg' as const, quality: 0.98 },
      html2canvas: { 
        scale: 2, 
        useCORS: true, 
        logging: false,
        onclone: (doc: Document) => {
          // html2canvas crashes on oklch() colors.
          // Since the report uses inline styles, we strip all global styles to be safe.
          const styles = doc.querySelectorAll('style, link[rel="stylesheet"]');
          styles.forEach(s => s.remove());

          // Inject minimal necessary styles back
          const style = doc.createElement('style');
          style.innerHTML = `
            .no-export { display: none !important; }
            .print-only { display: block !important; }
            table { border-collapse: collapse; width: 100%; }
            th, td { border: 1px solid #e2e8f0; }
          `;
          doc.head.appendChild(style);

          // Remove oklch variables from root/body if any
          const clean = (el: HTMLElement) => {
            const s = el.getAttribute('style');
            if (s && s.includes('oklch')) {
              el.setAttribute('style', s.replace(/oklch\([^)]+\)/g, '#777'));
            }
          };
          clean(doc.documentElement);
          clean(doc.body);
        }
      },
      jsPDF: { unit: 'mm' as const, format: 'a4' as const, orientation: 'landscape' as const },
      pagebreak: { mode: ['avoid-all', 'css', 'legacy'] as any }
    }

    // 3. Generate PDF and Save Locally
    const worker = html2pdf().set(opt).from(reportArea.value)
    await worker.save()

    // 4. Output Blob for Attachment
    const pdfBlob = await worker.output('blob')

    // 5. Upload Attachment
    await uploadMomAttachment(auth.token.value, latestId, pdfBlob, filename)

    successMessage.value = `報表已成功掛載至紀錄 (#${latestId})！檔名: ${filename}`
    setTimeout(() => { successMessage.value = null }, 5000)

  } catch (e: any) {
    console.error('EXPORT CRASH:', e)
    error.value = `導出失敗: ${e?.message || '未知錯誤'}`
  } finally {
    exporting.value = false
  }
}

function formatDate(dateStr: string) { return dateStr ? dateStr.split(' ')[0] : '' }

function getBadgeStyle(label?: string) {
  if (!label || label === '—') return { backgroundColor: '#f8fafc', color: '#94a3b8' }
  const pos = ['正常', '穩定', '完成', '良好', '優良', '無']
  const neg = ['異常', '極差', '失禁', '出血', '跌倒']
  if (pos.includes(label)) return { backgroundColor: '#f0fdf4', color: '#16a34a' }
  if (neg.includes(label)) return { backgroundColor: '#fef2f2', color: '#dc2626' }
  return { backgroundColor: '#f0f9ff', color: '#0284c7' }
}

onMounted(() => loadData())
watch([dateFrom, dateTo], () => loadData())
</script>

<template>
  <div class="space-y-6">
    <!-- Top Filter & Actions -->
    <div class="rounded-2xl border bg-white p-6 shadow-sm no-export">
      <div class="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
           <h1 class="text-lg font-bold">Mom 報表數據中心</h1>
           <p class="text-xs text-slate-500">視覺化統計與 PDF 存檔工具</p>
        </div>
        <div class="flex items-center gap-3">
          <input v-model="dateFrom" type="date" class="rounded border p-2 text-xs" />
          <input v-model="dateTo" type="date" class="rounded border p-2 text-xs" />
          <button @click="openAiModal('data')" class="rounded bg-indigo-600 px-4 py-2 text-xs text-white font-bold transition-all hover:bg-indigo-700 shadow-sm">✨ 數據量化分析</button>
          <button @click="openAiModal('medical')" class="rounded bg-rose-600 px-4 py-2 text-xs text-white font-bold transition-all hover:bg-rose-700 shadow-sm">✨ 醫療專業彙整</button>
          <button @click="openCreateModal" class="rounded bg-emerald-600 px-4 py-2 text-xs text-white font-bold">➕ 新增</button>
          <button @click="exportAndAttach" :disabled="exporting || records.length === 0" class="rounded bg-blue-600 px-6 py-2 text-xs text-white font-bold">
            {{ exporting ? '處理中...' : '產出 PDF' }}</button>
        </div>
      </div>
    </div>

    <!-- Feedback -->
    <div class="no-export">
      <ErrorMessage :message="error" />
      <div v-if="successMessage" class="p-4 text-green-700 bg-green-50 rounded border border-green-200 text-sm">✅ {{ successMessage }}</div>
    </div>

    <!-- Report Area -->
    <div ref="reportArea" style="background:#fff; padding:30px; border-radius:12px; font-family:sans-serif;">
      
      <!-- Report Header -->
      <div class="print-only" style="text-align:center; margin-bottom:30px; border-bottom:2px solid #334155; padding-bottom:20px;">
        <h1 style="font-size:24px; color:#0f172a; margin:0;">Mom 每日健康維護統計報告</h1>
        <div style="font-size:12px; color:#64748b; margin-top:5px;">週期：{{ dateFrom }} ~ {{ dateTo }} | 生成日期：{{ new Date().toLocaleDateString() }}</div>
      </div>

      <!-- AI Results (Vertical Stack) -->
      <div v-if="aiDataSummary || aiMedicalSummary" style="display:flex; flex-direction:column; gap:30px; margin-bottom:30px;">
        
        <!-- Data Analysis Card -->
        <div v-if="aiDataSummary" style="border:1px solid #e2e8f0; border-radius:12px; background:#fff; overflow:hidden; box-shadow: 0 4px 6px -1px rgb(0 0 0 / 0.1); page-break-inside: avoid; max-width: 800px; margin: 0 auto; width: 100%;">
          <div style="background: linear-gradient(135deg, #4f46e5 0%, #6366f1 100%); padding:12px 20px; color:#fff; display:flex; justify-content:space-between; align-items:center;">
            <div style="display:flex; align-items:center; gap:8px;">
              <span style="font-size:18px;">📊</span>
              <span style="font-weight:800; font-size:14px; letter-spacing:0.02em;">健康數據量化分析</span>
            </div>
            <span style="font-size:10px; opacity:0.8; font-weight:600;">{{ aiDataSummary.period }}</span>
          </div>
          <div style="padding:24px;">
            <p style="margin:0 0 20px 0; font-size:15px; color:#1e293b; line-height:1.7; font-weight:500; border-left:3px solid #6366f1; padding-left:16px; letter-spacing: 0.02em;">{{ aiDataSummary.overall_summary }}</p>
            <div style="display:grid; gap:16px; margin-bottom:20px;">
              <div v-for="(section, sIdx) in aiDataSummary.sections" :key="sIdx" style="background:#f8fafc; border:1px solid #e2e8f0; border-radius:12px; padding:16px;">
                <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:10px;">
                  <h5 style="margin:0; font-size:14px; font-weight:800; color:#334155; letter-spacing: 0.02em;">{{ section.title }}</h5>
                  <span :style="{ fontSize: '10px', fontWeight: '800', padding: '2px 8px', borderRadius: '12px', color: '#fff', background: section.status === 'Stable' ? '#10b981' : (section.status === 'Vigilant' ? '#f59e0b' : (section.status === 'Critical' ? '#ef4444' : '#6366f1')) }">{{ section.status }}</span>
                </div>
                <p style="margin:0; font-size:14px; color:#475569; line-height:1.7; letter-spacing: 0.015em;">{{ section.content }}</p>
              </div>
            </div>
            <div style="background:#f1f5f9; border-radius:12px; padding:16px;">
              <h4 style="margin:0 0 8px 0; font-size:14px; color:#475569; font-weight:800; letter-spacing: 0.02em;">📝 觀測結語</h4>
              <p style="margin:0; font-size:14px; color:#1e293b; line-height:1.7; letter-spacing: 0.015em;">{{ aiDataSummary.conclusion }}</p>
            </div>
          </div>
        </div>

        <!-- Medical Perspective Card -->
        <div v-if="aiMedicalSummary" style="border:1px solid #fecaca; border-radius:12px; background:#fff; overflow:hidden; box-shadow: 0 4px 6px -1px rgb(0 0 0 / 0.1); page-break-inside: avoid; max-width: 800px; margin: 0 auto; width: 100%;">
          <div style="background: linear-gradient(135deg, #e11d48 0%, #fb7185 100%); padding:12px 20px; color:#fff; display:flex; justify-content:space-between; align-items:center;">
            <div style="display:flex; align-items:center; gap:8px;">
              <span style="font-size:18px;">🩺</span>
              <span style="font-weight:800; font-size:14px; letter-spacing:0.02em;">專業臨床觀點彙整</span>
            </div>
            <span style="font-size:10px; opacity:0.8; font-weight:600;">{{ aiMedicalSummary.period }}</span>
          </div>
          <div style="padding:24px;">
            <p style="margin:0 0 20px 0; font-size:15px; color:#1e293b; line-height:1.7; font-weight:500; border-left:3px solid #e11d48; padding-left:16px; letter-spacing: 0.02em;">{{ aiMedicalSummary.overall_summary }}</p>
            <div style="display:grid; gap:16px; margin-bottom:20px;">
              <div v-for="(section, sIdx) in aiMedicalSummary.sections" :key="sIdx" style="background:#fff1f2; border:1px solid #fecaca; border-radius:12px; padding:16px;">
                <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:10px;">
                  <h5 style="margin:0; font-size:14px; font-weight:800; color:#9f1239; letter-spacing: 0.02em;">{{ section.title }}</h5>
                  <span :style="{ fontSize: '10px', fontWeight: '800', padding: '2px 8px', borderRadius: '12px', color: '#fff', background: section.status === 'Stable' ? '#10b981' : (section.status === 'Vigilant' ? '#f59e0b' : (section.status === 'Critical' ? '#e11d48' : '#fb7185')) }">{{ section.status }}</span>
                </div>
                <p style="margin:0; font-size:14px; color:#be123c; line-height:1.7; letter-spacing: 0.015em;">{{ section.content }}</p>
              </div>
            </div>
            <div style="background:#fff5f5; border-radius:12px; padding:16px; border:1px dashed #fecaca;">
              <h4 style="margin:0 0 8px 0; font-size:14px; color:#9f1239; font-weight:800; letter-spacing: 0.02em;">🏥 臨床追蹤與提示</h4>
              <p style="margin:0; font-size:14px; color:#881337; line-height:1.7; letter-spacing: 0.015em;">{{ aiMedicalSummary.conclusion }}</p>
            </div>
          </div>
        </div>

      </div>

      <!-- Analysis Section -->
      <div style="display:flex; gap:20px; margin-bottom:30px; page-break-inside: avoid; break-inside: avoid;">
        <!-- Pie Chart -->
        <div style="flex:2; border:1px solid #e2e8f0; border-radius:12px; padding:25px;">
          <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:20px;">
             <h3 style="margin:0; font-size:16px; font-weight:800;">{{ availableMetrics.find(m => m.value === chartMetric)?.label }}分佈統計</h3>
             <select v-model="chartMetric" class="no-export" style="border:1px solid #e2e8f0; border-radius:4px; padding:4px 10px; font-size:12px;">
                <option v-for="m in availableMetrics" :key="m.value" :value="m.value">{{ m.label }}</option>
             </select>
          </div>
          <div style="display:flex; align-items:center; justify-content:space-around;" v-if="pieSlices.length > 0">
            <svg viewBox="0 0 100 100" style="width:160px; height:160px; transform:rotate(-90deg);">
              <template v-for="(slice, i) in pieSlices" :key="i">
                <circle v-if="slice.isFull" cx="50" cy="50" r="40" :fill="slice.color" />
                <path v-else :d="slice.path" :fill="slice.color" />
              </template>
            </svg>
            <div style="display:grid; gap:8px;">
              <div v-for="slice in pieSlices" :key="slice.label" style="display:flex; align-items:center; gap:10px;">
                <div :style="{ width:'12px', height:'12px', background:slice.color, borderRadius:'2px' }"></div>
                <span style="font-size:12px; font-weight:700; color:#334155;">{{ slice.label }}</span>
                <span style="font-size:12px; color:#94a3b8;">{{ slice.count }} 筆 ({{ slice.percent }}%)</span>
              </div>
            </div>
          </div>
        </div>
        <!-- Summary Stats & Upcoming -->
        <div style="flex:1; display:flex; flex-direction:column; gap:15px;">
          <!-- 數據概覽 -->
          <div style="border:1px solid #e2e8f0; border-radius:12px; padding:20px; background:#fcfcfc;">
            <h3 style="margin:0 0 15px 0; font-size:14px; font-weight:800;">數據概覽</h3>
            <div style="padding:12px; background:#fff; border:1px solid #e2e8f0; border-radius:8px; display:flex; justify-content:space-between; align-items:center;">
               <span style="font-size:12px; color:#64748b;">總紀錄天數</span>
               <span style="font-size:22px; font-weight:900; color:#2563eb;">{{ records.length }}</span>
            </div>
          </div>

          <!-- 📅 近期預約 -->
          <div style="border:1px solid #e2e8f0; border-radius:12px; padding:20px; background:#fcfcfc;">
            <h3 style="margin:0 0 15px 0; font-size:14px; font-weight:800;">📅 近期預約</h3>
            <div v-if="requestsLoading" style="text-align:center; padding:20px; color:#94a3b8;">
              載入中...
            </div>
            <div v-else-if="upcomingRequests.length === 0" style="text-align:center; padding:20px; color:#94a3b8; font-size:12px;">
              未來 7 天無預約
            </div>
            <div v-else style="display:flex; flex-direction:column; gap:8px;">
              <div
                v-for="req in upcomingRequests"
                :key="req.id"
                :style="{
                  padding: '10px 12px',
                  background: isToday(req.startDate) ? '#fef3c7' : (isTomorrow(req.startDate) ? '#dbeafe' : '#fff'),
                  border: '1px solid ' + (isToday(req.startDate) ? '#fcd34d' : (isTomorrow(req.startDate) ? '#93c5fd' : '#e2e8f0')),
                  borderRadius: '8px'
                }"
              >
                <div style="display:flex; justify-content:space-between; align-items:center;">
                  <div>
                    <span
                      v-if="isToday(req.startDate)"
                      style="font-size:10px; font-weight:700; color:#d97706; margin-right:6px;"
                    >今天</span>
                    <span
                      v-else-if="isTomorrow(req.startDate)"
                      style="font-size:10px; font-weight:700; color:#2563eb; margin-right:6px;"
                    >明天</span>
                    <span style="font-size:12px; font-weight:700; color:#334155;">{{ req.requestTypeName || '預約' }}</span>
                  </div>
                  <span style="font-size:11px; color:#64748b;">{{ formatRequestDate(req.startDate) }}</span>
                </div>
                <div v-if="req.name" style="font-size:11px; color:#64748b; margin-top:4px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">
                  {{ req.name }}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- 📈 趨勢分析區塊 -->
      <div style="border:1px solid #e2e8f0; border-radius:12px; padding:25px; margin-bottom:30px; page-break-inside: avoid; break-inside: avoid;">
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:20px;">
          <div>
            <h3 style="margin:0; font-size:16px; font-weight:800;">📈 健康趨勢分析</h3>
            <p style="margin:4px 0 0 0; font-size:12px; color:#64748b;">追蹤各項指標隨時間的變化趨勢</p>
          </div>
          <!-- 指標選擇器 -->
          <div class="no-export" style="display:flex; gap:6px; flex-wrap:wrap; max-width:400px;">
            <button
              v-for="m in availableMetrics.slice(0, 8)"
              :key="m.value"
              @click="toggleTrendMetric(m.value as keyof MomData)"
              :style="{
                padding: '4px 10px',
                borderRadius: '12px',
                fontSize: '11px',
                fontWeight: '600',
                border: trendMetrics.includes(m.value as keyof MomData) ? 'none' : '1px solid #e2e8f0',
                background: trendMetrics.includes(m.value as keyof MomData) ? getTrendColor(m.value as keyof MomData) : '#fff',
                color: trendMetrics.includes(m.value as keyof MomData) ? '#fff' : '#64748b',
                cursor: 'pointer'
              }"
            >{{ m.label }}</button>
          </div>
        </div>

        <!-- SVG 趨勢折線圖 -->
        <div v-if="records.length > 1" style="overflow-x:auto;">
          <svg :viewBox="`0 0 ${trendSvgData.width} ${trendSvgData.height}`" style="width:100%; min-width:500px; height:220px;">
            <!-- 背景網格 -->
            <defs>
              <pattern id="grid" width="50" height="40" patternUnits="userSpaceOnUse">
                <path d="M 50 0 L 0 0 0 40" fill="none" stroke="#f1f5f9" stroke-width="1"/>
              </pattern>
            </defs>
            <rect :x="trendSvgData.padding.left" :y="trendSvgData.padding.top"
                  :width="trendSvgData.width - trendSvgData.padding.left - trendSvgData.padding.right"
                  :height="trendSvgData.height - trendSvgData.padding.top - trendSvgData.padding.bottom"
                  fill="url(#grid)" />

            <!-- Y 軸刻度線和標籤 -->
            <g v-for="tick in trendSvgData.yTicks" :key="tick.label">
              <line :x1="trendSvgData.padding.left" :y1="tick.y"
                    :x2="trendSvgData.width - trendSvgData.padding.right" :y2="tick.y"
                    stroke="#e2e8f0" stroke-dasharray="4,4" />
              <text :x="trendSvgData.padding.left - 8" :y="tick.y + 4"
                    text-anchor="end" font-size="10" fill="#94a3b8">{{ tick.label }}</text>
            </g>

            <!-- X 軸日期標籤 -->
            <g v-for="label in trendSvgData.xLabels" :key="label.x">
              <text :x="label.x" :y="trendSvgData.height - 8"
                    text-anchor="middle" font-size="10" fill="#94a3b8">{{ label.label }}</text>
            </g>

            <!-- 趨勢線 -->
            <g v-for="line in trendSvgData.lines" :key="line.metric">
              <!-- 線條 -->
              <path :d="line.path" fill="none" :stroke="line.color" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" />

              <!-- 數據點 -->
              <g v-for="(circle, ci) in line.circles" :key="ci">
                <!-- 異常點用大紅圈 -->
                <circle v-if="circle.isAbnormal" :cx="circle.cx" :cy="circle.cy" r="8" fill="#fef2f2" stroke="#ef4444" stroke-width="2" />
                <!-- 正常點 -->
                <circle :cx="circle.cx" :cy="circle.cy" r="4" :fill="line.color" stroke="#fff" stroke-width="2" />

                <!-- 懸浮提示（簡化版，用 title） -->
                <title>{{ circle.date }}: {{ circle.label }} ({{ circle.score }}分)</title>
              </g>
            </g>
          </svg>

          <!-- 圖例 -->
          <div style="display:flex; gap:16px; justify-content:center; margin-top:12px; flex-wrap:wrap;">
            <div v-for="line in trendSvgData.lines" :key="line.metric" style="display:flex; align-items:center; gap:6px;">
              <div :style="{ width:'20px', height:'3px', background:line.color, borderRadius:'2px' }"></div>
              <span style="font-size:12px; color:#475569; font-weight:600;">{{ line.metricLabel }}</span>
            </div>
            <div style="display:flex; align-items:center; gap:6px;">
              <div style="width:12px; height:12px; border:2px solid #ef4444; border-radius:50%; background:#fef2f2;"></div>
              <span style="font-size:12px; color:#ef4444; font-weight:600;">異常警示</span>
            </div>
          </div>
        </div>

        <!-- 數據不足提示 -->
        <div v-else style="text-align:center; padding:40px; color:#94a3b8;">
          <p style="font-size:14px;">📊 需要至少 2 筆記錄才能顯示趨勢圖</p>
          <p style="font-size:12px;">目前記錄數：{{ records.length }}</p>
        </div>
      </div>

      <!-- 🚨 異常警示區塊 (給醫師看) -->
      <div v-if="abnormalAlerts.length > 0" style="border:2px solid #fecaca; border-radius:12px; padding:25px; margin-bottom:30px; background:#fef2f2; page-break-inside: avoid; break-inside: avoid;">
        <div style="display:flex; align-items:center; gap:10px; margin-bottom:15px;">
          <span style="font-size:20px;">🚨</span>
          <div>
            <h3 style="margin:0; font-size:16px; font-weight:800; color:#dc2626;">異常狀況警示</h3>
            <p style="margin:2px 0 0 0; font-size:12px; color:#ef4444;">以下為近期需要關注的異常記錄（共 {{ abnormalAlerts.length }} 筆）</p>
          </div>
        </div>

        <div style="display:grid; gap:10px;">
          <div v-for="(alert, idx) in abnormalAlerts" :key="idx"
               style="background:#fff; border:1px solid #fecaca; border-radius:8px; padding:12px 16px; display:flex; align-items:center; gap:16px;">
            <div style="min-width:80px;">
              <span style="font-size:12px; color:#64748b;">{{ alert.date }}</span>
            </div>
            <div style="flex:1;">
              <span style="font-size:13px; font-weight:700; color:#334155;">{{ alert.metric }}</span>
              <span style="margin-left:8px; padding:2px 8px; background:#fef2f2; border:1px solid #fecaca; border-radius:4px; font-size:11px; font-weight:600; color:#dc2626;">{{ alert.label }}</span>
            </div>
            <div v-if="alert.description" style="flex:1; font-size:12px; color:#64748b; font-style:italic;">
              {{ alert.description.length > 50 ? alert.description.slice(0, 50) + '...' : alert.description }}
            </div>
          </div>
        </div>
      </div>

      <!-- Information List (Expanded) -->
      <div style="border:1px solid #e2e8f0; border-radius:12px; overflow:hidden;">
        <div style="padding:15px 20px; background:#f8fafc; border-bottom:1px solid #e2e8f0; font-weight:800; font-size:14px;">每日健康紀錄完整清單</div>
        <div style="overflow-x:auto;">
          <table style="width:100%; border-collapse:collapse; font-size:14px; min-width:1400px;">
            <thead style="background:#f1f5f9; color:#475569;">
              <tr>
                <th style="padding:10px; text-align:left; border-bottom:2px solid #cbd5e1;">日期</th>
                <th style="padding:10px; text-align:left; border-bottom:2px solid #cbd5e1;">姓名</th>
                <th style="padding:10px; border-bottom:2px solid #cbd5e1;">起床精神</th>
                <th style="padding:10px; border-bottom:2px solid #cbd5e1;">昨夜睡眠</th>
                <th style="padding:10px; border-bottom:2px solid #cbd5e1;">三餐狀況</th>
                <th style="padding:10px; border-bottom:2px solid #cbd5e1;">活動狀況</th>
                <th style="padding:10px; border-bottom:2px solid #cbd5e1;">生理維護</th>
                <th style="padding:10px; text-align:left; border-bottom:2px solid #cbd5e1;">備註 (Memo)</th>
                <th style="padding:10px; border-bottom:2px solid #cbd5e1; position:sticky; right:0; background:#f1f5f9; z-index:10; box-shadow:-2px 0 5px rgba(0,0,0,0.05);" class="no-export">操作</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="row in records" :key="row.id" style="border-top:1px solid #e2e8f0; page-break-inside: avoid; break-inside: avoid;">
                <td style="padding:10px; white-space:nowrap;">{{ formatDate(row.documentDate) }}</td>
                <td style="padding:10px; font-weight:800; white-space:nowrap;">{{ row.name }}</td>
                <!-- Morning Mental -->
                <td style="padding:10px; text-align:center;">
                  {{ getLabel('morningMentalStatus', row.morningMentalStatus) }}
                </td>
                
                <!-- Sleep -->
                <td style="padding:10px; text-align:center;">
                  <div style="margin-bottom:4px;">{{ getLabel('lastNightSleep', row.lastNightSleep) }}</div>
                  <div style="font-size:12px; color:#94a3b8;">睡前: {{ getLabel('beforeSleepStatus', row.beforeSleepStatus) }}</div>
                </td>

                <!-- Meals -->
                <td style="padding:10px; text-align:center;">
                   <div style="display:flex; justify-content:center; gap:4px; margin-bottom:4px;">
                      <span :style="{ ...getBadgeStyle(getLabel('breakfast', row.breakfast)), padding:'1px 5px', borderRadius:'3px' }">早</span>
                      <span :style="{ ...getBadgeStyle(getLabel('lunch', row.lunch)), padding:'1px 5px', borderRadius:'3px' }">午</span>
                      <span :style="{ ...getBadgeStyle(getLabel('dinner', row.dinner)), padding:'1px 5px', borderRadius:'3px' }">晚</span>
                   </div>
                   <div style="font-size:12px; color:#94a3b8;">{{ getLabel('breakfast', row.breakfast) }}/{{ getLabel('lunch', row.lunch) }}/{{ getLabel('dinner', row.dinner) }}</div>
                </td>

                <!-- Activity -->
                <td style="padding:10px; text-align:center;">
                   <div style="display:flex; flex-direction:column; gap:2px;">
                      <span>夜間: {{ getLabel('nightActivity', row.nightActivity) }}</span>
                      <span>活動: {{ getLabel('dailyActivity', row.dailyActivity) }}</span>
                      <span>外出: {{ getLabel('outgoing', row.outgoing) }}</span>
                      <span>陪伴: {{ getLabel('companionship', row.companionship) }}</span>
                   </div>
                </td>

                <!-- Physical -->
                <td style="padding:10px; text-align:center;">
                   <div style="display:flex; flex-direction:column; gap:2px;">
                      <span>排泄: {{ getLabel('excretionStatus', row.excretionStatus) }}</span>
                      <span>洗澡: {{ getLabel('bathing', row.bathing) }}</span>
                      <!-- 血壓顯示 -->
                      <span v-if="row.systolicBP || row.diastolicBP"
                            :style="{
                              color: (row.systolicBP && (row.systolicBP > 140 || row.systolicBP < 90)) ||
                                     (row.diastolicBP && (row.diastolicBP > 90 || row.diastolicBP < 60))
                                     ? '#ef4444' : '#10b981',
                              fontWeight: '700'
                            }">
                        🩺 {{ row.systolicBP || '-' }}/{{ row.diastolicBP || '-' }}
                        <span v-if="row.pulse" style="font-weight:400; color:#64748b;"> ({{ row.pulse }})</span>
                      </span>
                      <span v-if="getLabel('safetyIncident', row.safetyIncident) !== '無' && row.safetyIncident" style="color:#ef4444; font-weight:800;">警告: {{ getLabel('safetyIncident', row.safetyIncident) }}</span>
                   </div>
                </td>
                <!-- Description (交班筆記) -->
                <td style="padding:10px; vertical-align:top; border-left:1px dashed #f1f5f9; min-width:200px;">
                  <template v-if="row.description">
                    <div v-for="(note, ni) in parseMemo(row.description)" :key="ni" style="margin-bottom:6px;">
                      <span :style="{
                        display:'inline-block',
                        padding:'1px 6px',
                        borderRadius:'4px',
                        fontSize:'10px',
                        fontWeight:'700',
                        marginRight:'6px',
                        color:'#fff',
                        background: shiftColors[note.shift]
                      }">{{ note.shift === 'NIGHT' ? '夜' : note.shift === 'GRAVEYARD' ? '夜' : '早' }}</span>
                      <span style="font-size:10px; color:#94a3b8; margin-right:4px;">{{ note.time }}</span>
                      <span style="font-size:12px; color:#475569;">{{ note.content }}</span>
                    </div>
                    <span v-if="parseMemo(row.description).length === 0" style="color:#94a3b8; font-style:italic; font-size:12px;">{{ row.description }}</span>
                  </template>
                  <span v-else style="color:#94a3b8;">—</span>
                </td>
                <!-- Actions -->
                <td style="padding:10px; text-align:center; position:sticky; right:0; background:#fff; z-index:5; box-shadow:-2px 0 5px rgba(0,0,0,0.05);" class="no-export">
                   <div class="flex flex-col gap-1 items-center">
                      <button v-if="!row.isProcessed" @click="openEditModal(row)" class="text-blue-600 font-bold hover:underline text-xs">編輯</button>
                      <button @click="openPhotoModal(row.id)" class="text-purple-600 font-bold hover:underline text-xs">📷 照片</button>
                      <button v-if="!row.isProcessed" @click="handleComplete(row.id)" class="text-emerald-600 font-bold hover:underline text-xs">鎖定</button>
                      <span v-if="row.isProcessed" class="text-slate-400 font-bold text-[11px] italic">🔒已鎖定</span>
                   </div>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>

    <!-- Modal Overlay -->
    <div v-if="showModal" class="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 no-export" style="backdrop-filter: blur(2px);">
      <div class="w-full max-w-2xl rounded-2xl bg-white p-8 shadow-2xl relative max-h-[90vh] overflow-y-auto">
        
        <!-- AI Prompt -->
        <div v-if="modalMode === 'ai'">
          <h2 class="text-xl font-bold mb-4">✨ AI {{ aiTarget === 'data' ? '數據量化分析' : '醫療分析' }}統整</h2>
          <p class="text-sm text-slate-500 mb-6 font-bold">系統將分析現有 <b>{{ records.length }}</b> 筆紀錄。{{ aiTarget === 'medical' ? '本報告提供臨床觀察點，供醫師診斷參考。' : '本報告僅做客觀數據彙整。' }}</p>
          <button @click="handleAiGenerate" :disabled="aiGenerating" class="w-full rounded-xl py-3 text-white font-bold transition-all shadow-lg" :class="aiTarget === 'data' ? 'bg-indigo-600 hover:bg-indigo-700 shadow-indigo-200' : 'bg-rose-600 hover:bg-rose-700 shadow-rose-200'">
            {{ aiGenerating ? 'AI 正在分析數據中...' : '開始統整' }}</button>
        </div>

        <!-- Data Entry -->
        <div v-else>
          <h2 class="text-xl font-bold mb-6 text-slate-800">{{ modalMode === 'create' ? '➕ 新增健康紀錄' : '📝 編輯健康紀錄' }}</h2>
          <div class="grid grid-cols-2 gap-x-6 gap-y-4">
            <div class="col-span-1 border-b pb-2"><label class="text-[10px] uppercase tracking-wider font-black text-slate-400">日期</label><input v-model="form.documentDate" type="date" class="w-full border-none p-0 focus:ring-0 text-sm font-bold" /></div>
            <div class="col-span-1 border-b pb-2"><label class="text-[10px] uppercase tracking-wider font-black text-slate-400">姓名</label><input v-model="form.name" type="text" class="w-full border-none p-0 focus:ring-0 text-sm font-bold" /></div>
            
            <div v-for="(val, key) in form" :key="key">
              <template v-if="!['documentDate', 'name', 'description'].includes(key)">
                <div class="border-b pb-1">
                  <label class="block text-[10px] uppercase tracking-wider font-black text-slate-400 mb-1">{{ fieldLabels[key] || key }}</label>
                  <select v-model="form[key as keyof typeof form]" class="w-full border-none p-0 focus:ring-0 text-xs font-bold bg-transparent">
                    <option v-for="opt in (options[key] || defaultStatusList)" :key="opt.value" :value="opt.value">{{ opt.label }}</option>
                  </select>
                </div>
              </template>
            </div>
            
            <!-- 🩺 生理數據區塊 -->
            <div class="col-span-2 mt-4 border-t pt-4">
               <label class="block text-[10px] uppercase tracking-wider font-black text-slate-400 mb-3">🩺 生理數據 (選填)</label>
               <div class="grid grid-cols-4 gap-4">
                 <div>
                   <label class="block text-[10px] text-slate-400 mb-1">收縮壓 (mmHg)</label>
                   <input
                     v-model.number="form.systolicBP"
                     type="number"
                     min="60" max="250"
                     placeholder="120"
                     class="w-full text-sm border rounded-lg px-3 py-2"
                     :class="{ 'border-red-400 bg-red-50': form.systolicBP && (form.systolicBP > 140 || form.systolicBP < 90) }"
                   />
                 </div>
                 <div>
                   <label class="block text-[10px] text-slate-400 mb-1">舒張壓 (mmHg)</label>
                   <input
                     v-model.number="form.diastolicBP"
                     type="number"
                     min="40" max="150"
                     placeholder="80"
                     class="w-full text-sm border rounded-lg px-3 py-2"
                     :class="{ 'border-red-400 bg-red-50': form.diastolicBP && (form.diastolicBP > 90 || form.diastolicBP < 60) }"
                   />
                 </div>
                 <div>
                   <label class="block text-[10px] text-slate-400 mb-1">脈搏 (次/分)</label>
                   <input
                     v-model.number="form.pulse"
                     type="number"
                     min="40" max="200"
                     placeholder="72"
                     class="w-full text-sm border rounded-lg px-3 py-2"
                     :class="{ 'border-red-400 bg-red-50': form.pulse && (form.pulse > 100 || form.pulse < 50) }"
                   />
                 </div>
                 <div>
                   <label class="block text-[10px] text-slate-400 mb-1">備註</label>
                   <input
                     v-model="form.bpNote"
                     type="text"
                     placeholder="無法測量/拒絕..."
                     class="w-full text-sm border rounded-lg px-3 py-2"
                   />
                 </div>
               </div>
               <p class="text-[10px] text-slate-400 mt-2">💡 紅框表示異常值。留空表示今日未測量。</p>
            </div>

            <!-- 交班筆記區塊 -->
            <div class="col-span-2 mt-4 border-t pt-4">
               <label class="block text-[10px] uppercase tracking-wider font-black text-slate-400 mb-3">📋 交班筆記</label>

               <!-- 現有筆記列表 (依班別分組) -->
               <div class="space-y-4 mb-4">
                 <template v-for="shiftType in (['NIGHT', 'GRAVEYARD', 'DAY'] as ShiftType[])" :key="shiftType">
                   <div v-if="groupedNotes[shiftType].length > 0" class="rounded-lg border overflow-hidden">
                     <div class="px-3 py-2 text-xs font-bold text-white" :style="{ background: shiftColors[shiftType] }">
                       {{ shiftLabels[shiftType] }}
                     </div>
                     <div class="divide-y">
                       <div v-for="(note, idx) in shiftNotes.filter(n => n.shift === shiftType)"
                            :key="`${shiftType}-${idx}`"
                            class="flex items-start gap-3 p-3 bg-slate-50 hover:bg-white transition-colors">
                         <span class="text-[10px] text-slate-400 font-mono mt-1">{{ note.time }}</span>
                         <input
                           type="text"
                           v-model="note.content"
                           @change="updateShiftNoteContent(shiftNotes.indexOf(note), note.content)"
                           class="flex-1 text-xs bg-transparent border-none p-0 focus:ring-0"
                         />
                         <button
                           @click="deleteShiftNote(shiftNotes.indexOf(note))"
                           class="text-red-400 hover:text-red-600 text-xs font-bold"
                         >✕</button>
                       </div>
                     </div>
                   </div>
                 </template>
               </div>

               <!-- 新增筆記 -->
               <div class="flex gap-2 items-center">
                 <select v-model="newNoteShift" class="text-xs border rounded-lg px-2 py-2 bg-white">
                   <option value="NIGHT">🌙 夜班</option>
                   <option value="GRAVEYARD">🌃 大夜</option>
                   <option value="DAY">☀️ 早班</option>
                 </select>
                 <input
                   v-model="newNoteContent"
                   type="text"
                   placeholder="輸入交班筆記..."
                   class="flex-1 text-xs border rounded-lg px-3 py-2"
                   @keyup.enter="addShiftNote"
                 />
                 <button
                   @click="addShiftNote"
                   :disabled="!newNoteContent.trim()"
                   class="px-4 py-2 text-xs font-bold rounded-lg bg-emerald-500 text-white hover:bg-emerald-600 disabled:opacity-50 disabled:cursor-not-allowed"
                 >+ 新增</button>
               </div>

               <!-- 顯示原始 memo (摺疊) -->
               <details v-if="form.description" class="mt-3">
                 <summary class="text-[10px] text-slate-400 cursor-pointer hover:text-slate-600">查看原始資料</summary>
                 <pre class="mt-2 text-[10px] bg-slate-100 p-2 rounded overflow-x-auto">{{ form.description }}</pre>
               </details>
            </div>
          </div>
          <div class="mt-8 flex justify-end gap-3">
            <button @click="showModal = false" class="px-6 py-2 text-sm font-bold text-slate-400 hover:text-slate-600 transition-colors">取消</button>
            <button @click="handleSave" :disabled="loading" class="rounded-xl bg-blue-600 px-8 py-2 text-white font-bold hover:bg-blue-700 transition-colors shadow-lg shadow-blue-200">
               {{ loading ? '儲存中...' : '確認發布' }}
            </button>
          </div>
        </div>
        <button @click="showModal = false" class="absolute top-6 right-6 text-slate-300 hover:text-slate-600 transition-colors font-bold text-lg">✕</button>
      </div>
    </div>

    <!-- 📷 照片模態框 -->
    <div v-if="showPhotoModal" class="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 no-export" style="backdrop-filter: blur(2px);">
      <div class="w-full max-w-3xl rounded-2xl bg-white p-8 shadow-2xl relative max-h-[90vh] overflow-y-auto">
        <h2 class="text-xl font-bold mb-4">📷 照片附件</h2>
        <p class="text-sm text-slate-500 mb-6">記錄 ID: {{ currentPhotoRecordId }}</p>

        <!-- 上傳區域 -->
        <div class="mb-6 p-4 border-2 border-dashed border-slate-200 rounded-xl text-center hover:border-purple-400 transition-colors">
          <input
            ref="photoInputRef"
            type="file"
            accept="image/*"
            multiple
            @change="handlePhotoUpload"
            class="hidden"
          />
          <button
            @click="photoInputRef?.click()"
            :disabled="photoUploading"
            class="px-6 py-3 bg-purple-600 text-white font-bold rounded-xl hover:bg-purple-700 disabled:opacity-50"
          >
            {{ photoUploading ? '上傳中...' : '📷 選擇照片上傳' }}
          </button>
          <p class="text-xs text-slate-400 mt-2">支援 JPG、PNG、GIF 格式，可多選</p>
        </div>

        <!-- 照片列表 -->
        <div v-if="photoAttachments.length > 0" class="mb-6">
          <h3 class="text-sm font-bold text-slate-700 mb-3">已上傳照片 ({{ photoAttachments.length }})</h3>
          <div class="grid grid-cols-3 gap-4">
            <div v-for="photo in photoAttachments" :key="photo.name" class="relative group">
              <div v-if="photoLoadingMap[photo.name]" class="aspect-square bg-slate-100 rounded-lg flex items-center justify-center">
                <span class="loading loading-spinner loading-sm text-slate-300"></span>
              </div>
              <template v-else>
                <a
                  v-if="photoDataMap[photo.name]"
                  :href="photoDataMap[photo.name]"
                  target="_blank"
                  class="block aspect-square bg-slate-100 rounded-lg overflow-hidden border hover:border-purple-400 transition-colors"
                >
                  <img
                    :src="photoDataMap[photo.name]"
                    :alt="photo.name"
                    class="w-full h-full object-cover"
                    loading="lazy"
                  />
                </a>
                <div v-else class="aspect-square bg-slate-100 rounded-lg flex flex-col items-center justify-center">
                   <span class="text-xs text-slate-400">無法讀取</span>
                   <button @click="fetchSpecificPhoto(currentPhotoRecordId!, photo.name)" class="text-[10px] text-purple-600 hover:underline">重試</button>
                </div>
              </template>
              <div class="absolute bottom-0 left-0 right-0 bg-black/60 text-white text-[10px] p-1 truncate opacity-0 group-hover:opacity-100 transition-opacity">
                {{ photo.name }}
              </div>
            </div>
          </div>
        </div>

        <!-- PDF 列表 -->
        <div v-if="pdfAttachments.length > 0" class="mb-6">
          <h3 class="text-sm font-bold text-slate-700 mb-3">PDF 報告 ({{ pdfAttachments.length }})</h3>
          <div class="space-y-2">
            <a
              v-for="pdf in pdfAttachments"
              :key="pdf.name"
              :href="getAttachmentUrl(currentPhotoRecordId!, pdf.name)"
              target="_blank"
              class="flex items-center gap-3 p-3 bg-slate-50 rounded-lg hover:bg-slate-100 transition-colors"
            >
              <span class="text-2xl">📄</span>
              <span class="text-sm text-slate-700">{{ pdf.name }}</span>
            </a>
          </div>
        </div>

        <!-- 無附件提示 -->
        <div v-if="attachments.length === 0 && !photoUploading" class="text-center py-8 text-slate-400">
          <p class="text-lg mb-2">📭</p>
          <p>尚無附件</p>
        </div>

        <button @click="showPhotoModal = false" class="absolute top-6 right-6 text-slate-300 hover:text-slate-600 transition-colors font-bold text-lg">✕</button>
      </div>
    </div>
  </div>
</template>

<style scoped>
@media screen { .print-only { display: none !important; } }

/* Customize scrollbar for the wide table */
::-webkit-scrollbar { height: 6px; }
::-webkit-scrollbar-track { background: #f1f5f9; }
::-webkit-scrollbar-thumb { background: #cbd5e1; border-radius: 10px; }
::-webkit-scrollbar-thumb:hover { background: #94a3b8; }
</style>
