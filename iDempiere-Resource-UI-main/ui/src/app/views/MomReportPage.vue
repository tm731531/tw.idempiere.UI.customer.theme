<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import ErrorMessage from '../../components/ErrorMessage.vue'
import { useAuth } from '../../features/auth/store'
import { listMomData, type MomData, getLatestMomRecordId, uploadMomAttachment, createMomData, updateMomData, generateGeminiContent, getGeminiApiKey, fetchMomColumnMetadata, type MomPayload, completeMomRecord, runMomCompleteProcess } from '../../features/mom/api'
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
    safetyIncident: '無'
})

// AI State
const aiResult = ref('')
const aiGenerating = ref(false)

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
        safetyIncident: resolve('safetyIncident', '')
    }
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
        safetyIncident: row.safetyIncident || ''
    }
    showModal.value = true
}

function openAiModal() { modalMode.value = 'ai'; showModal.value = true }

async function handleAiGenerate() {
    if (!auth.token.value) return
    aiGenerating.value = true
    try {
        const apiKey = await getGeminiApiKey(auth.token.value)
        if (!apiKey) throw new Error('未設定 API Key')
        const dataText = records.value.map(r => 
            `日期: ${r.documentDate}, 精神: ${getLabel('morningMentalStatus', r.morningMentalStatus)},
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
             洗澡: ${getLabel('bathing', r.bathing)}, 備註: ${r.description || '無'}`
        ).join('\n')
        aiResult.value = await generateGeminiContent(apiKey, `請彙整摘要健康狀況：\n${dataText}`)
        showModal.value = false
        successMessage.value = 'AI 摘要生成完畢！'
        setTimeout(() => successMessage.value = null, 3000)
    } catch (e: any) { error.value = e.message || 'AI 生成失敗' }
    finally { aiGenerating.value = false }
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
            Bathing: s(form.value.bathing), SafetyIncident: s(form.value.safetyIncident)
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
          <button @click="openAiModal" class="rounded bg-purple-600 px-4 py-2 text-xs text-white font-bold">✨ AI 統整</button>
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

      <!-- AI Result -->
      <div v-if="aiResult" style="margin-bottom:30px; border:2px solid #a855f7; border-radius:12px; background:#faf5ff; page-break-inside: avoid; break-inside: avoid;">
        <div style="background:#a855f7; padding:10px 20px; color:#fff; font-weight:800; font-size:15px;">✨ AI 健康統整摘要</div>
        <div style="padding:20px; white-space:pre-wrap; font-size:13px; line-height:1.6; color:#4b5563;">{{ aiResult }}</div>
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
        <!-- Summary Stats -->
        <div style="flex:1; border:1px solid #e2e8f0; border-radius:12px; padding:25px; background:#fcfcfc;">
          <h3 style="margin:0 0 20px 0; font-size:16px; font-weight:800;">數據概覽</h3>
          <div style="padding:15px; background:#fff; border:1px solid #e2e8f0; border-radius:8px; display:flex; justify-content:space-between; align-items:center;">
             <span style="font-size:12px; color:#64748b;">總紀錄天數</span>
             <span style="font-size:24px; font-weight:900; color:#2563eb;">{{ records.length }}</span>
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
                <th style="padding:10px; border-bottom:2px solid #cbd5e1;" class="no-export">操作</th>
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
                      <span v-if="getLabel('safetyIncident', row.safetyIncident) !== '無' && row.safetyIncident" style="color:#ef4444; font-weight:800;">警告: {{ getLabel('safetyIncident', row.safetyIncident) }}</span>
                   </div>
                </td>
                <!-- Description -->
                <td style="padding:10px; color:#64748b; font-style:italic; vertical-align:top; border-left:1px dashed #f1f5f9;">{{ row.description || '—' }}</td>
                <!-- Actions -->
                <td style="padding:10px; text-align:center;" class="no-export">
                   <div class="flex flex-col gap-1 items-center">
                      <button v-if="!row.isProcessed" @click="openEditModal(row)" class="text-blue-600 font-bold hover:underline text-xs">編輯</button>
                      <button v-if="!row.isProcessed" @click="handleComplete(row.id)" class="text-emerald-600 font-bold hover:underline text-xs">鎖定</button>
                      <span v-else class="text-slate-400 font-bold text-[11px] italic">🔒已鎖定</span>
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
          <h2 class="text-xl font-bold mb-4">✨ AI 健康紀錄統整</h2>
          <p class="text-sm text-slate-500 mb-6 font-bold">系統將自動分析當前篩選週期內的 <b>{{ records.length }}</b> 筆紀錄並產生摘要。</p>
          <button @click="handleAiGenerate" :disabled="aiGenerating" class="w-full rounded-xl bg-purple-600 py-3 text-white font-bold hover:bg-purple-700 transition-colors shadow-lg shadow-purple-200">
            {{ aiGenerating ? 'AI 正在思考中...' : '開始統整' }}</button>
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
            
            <div class="col-span-2 mt-2">
               <label class="block text-[10px] uppercase tracking-wider font-black text-slate-400 mb-1">備註 (Memo)</label>
               <textarea v-model="form.description" class="w-full border rounded-lg p-3 text-xs min-h-[80px] bg-slate-50 focus:bg-white transition-colors" placeholder="請輸入重要觀察事項..."></textarea>
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
