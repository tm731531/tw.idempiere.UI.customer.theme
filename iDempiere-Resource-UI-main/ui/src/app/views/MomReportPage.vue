<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import ErrorMessage from '../../components/ErrorMessage.vue'
import { useAuth } from '../../features/auth/store'
import { listMomData, type MomData, getLatestMomRecordId, uploadMomAttachment } from '../../features/mom/api'
import { toPng } from 'html-to-image'
import jsPDF from 'jspdf'

const auth = useAuth()

const loading = ref(false)
const exporting = ref(false)
const error = ref<string | null>(null)
const successMessage = ref<string | null>(null)
const records = ref<MomData[]>([])
const reportArea = ref<HTMLElement | null>(null)

// Filters
const dateFrom = ref(new Date(new Date().setDate(new Date().getDate() - 7)).toISOString().split('T')[0])
const dateTo = ref(new Date().toISOString().split('T')[0])

// Chart Metric Selection
const chartMetric = ref<keyof MomData>('morningMentalStatus')
const availableMetrics = [
  { label: '起床精神', value: 'morningMentalStatus' },
  { label: '昨夜睡眠', value: 'lastNightSleep' },
  { label: '睡前狀況', value: 'beforeSleepStatus' },
  { label: '早餐', value: 'breakfast' },
  { label: '午餐', value: 'lunch' },
  { label: '晚餐', value: 'dinner' },
  { label: '活動', value: 'dailyActivity' },
  { label: '排泄狀況', value: 'excretionStatus' },
  { label: '洗澡', value: 'bathing' },
]

// Pie Chart Statistics
const stats = computed(() => {
  const map = new Map<string, number>()
  const metricKey = chartMetric.value
  for (const r of records.value) {
    const val = r[metricKey]
    if (val && typeof val === 'string') {
      map.set(val, (map.get(val) || 0) + 1)
    }
  }
  return Array.from(map.entries()).map(([label, count]) => ({ label, count }))
})

// Pie Chart Calculations
const pieSlices = computed(() => {
  const total = stats.value.reduce((sum, s) => sum + s.count, 0)
  if (total === 0) return []
  let currentAngle = 0
  
  const getColor = (label: string, index: number) => {
    const positive = ['正常', '穩定', '完成', '良好', '優良']
    const neutral = ['一般', '尚可', '未完成']
    const negative = ['亢奮', '疲憊', '差', '極差', '異常', '失禁', '出血', '跌倒']
    
    if (positive.includes(label)) return '#10b981'
    if (negative.includes(label)) return '#f43f5e'
    if (neutral.includes(label)) return '#f59e0b'
    
    const colors = ['#3b82f6', '#8b5cf6', '#ec4899', '#64748b']
    return colors[index % colors.length]
  }

  return stats.value.map((s, i) => {
    const angle = (s.count / total) * 360
    const startAngle = currentAngle
    currentAngle += angle
    if (angle >= 359.9) return { label: s.label, count: s.count, isFull: true, color: getColor(s.label, i), percent: 100 }
    const x1 = 50 + 40 * Math.cos((startAngle - 90) * Math.PI / 180)
    const y1 = 50 + 40 * Math.sin((startAngle - 90) * Math.PI / 180)
    const x2 = 50 + 40 * Math.cos((currentAngle - 90) * Math.PI / 180)
    const y2 = 50 + 40 * Math.sin((currentAngle - 90) * Math.PI / 180)
    const largeArcFlag = angle > 180 ? 1 : 0
    return {
      label: s.label,
      count: s.count,
      isFull: false,
      path: `M 50 50 L ${x1} ${y1} A 40 40 0 ${largeArcFlag} 1 ${x2} ${y2} Z`,
      color: getColor(s.label, i),
      percent: Math.round((s.count / total) * 100)
    }
  })
})

async function loadData() {
  if (!auth.token.value) return
  loading.value = true
  error.value = null
  try {
    const res = await listMomData(auth.token.value, { dateFrom: dateFrom.value, dateTo: dateTo.value })
    records.value = res.records
  } catch (e: any) {
    error.value = e?.detail || e?.message || '載入失敗'
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
    // 1. Get Latest iDempiere Record
    const latestId = await getLatestMomRecordId(auth.token.value)
    if (!latestId) throw new Error('找不到最新的紀錄，請確認資料庫已有資料')

    // 2. Capture DOM to Image (Using html-to-image to bypass html2canvas oklch bug)
    const dataUrl = await toPng(reportArea.value, {
      backgroundColor: '#ffffff',
      cacheBust: true,
      // Filter out UI elements that should not be in the PDF
      filter: (node) => {
        const exclusionClasses = ['no-export', 'data-html2canvas-ignore']
        const el = node as HTMLElement
        if (el.classList) {
          return !exclusionClasses.some(cls => el.classList.contains(cls))
        }
        return true
      }
    })

    // 3. Create PDF with jsPDF
    const pdf = new jsPDF({
      orientation: 'landscape',
      unit: 'mm',
      format: 'a4'
    })

    const imgProps = pdf.getImageProperties(dataUrl)
    const pdfWidth = pdf.internal.pageSize.getWidth()
    const pdfHeight = (imgProps.height * pdfWidth) / imgProps.width
    
    // If table is long, it might overflow. For now we scale to width.
    // In landscape A4, width is 297mm.
    pdf.addImage(dataUrl, 'PNG', 0, 0, pdfWidth, Math.min(pdfHeight, 210))

    const pdfBlob = pdf.output('blob')
    const now = new Date()
    const timestamp = now.toISOString().replace(/[:T-]/g, '').slice(0, 14)
    const filename = `${timestamp}_MomReport.pdf`

    // 4. Upload Attachment
    await uploadMomAttachment(auth.token.value, latestId, pdfBlob, filename)

    successMessage.value = `報表已成功掛載至紀錄 (#${latestId})！`
    setTimeout(() => { successMessage.value = null }, 5000)

  } catch (e: any) {
    console.error('EXPORT CRASH:', e)
    error.value = `導出失敗: ${e?.message || '連線逾時或編碼異常'}`
  } finally {
    exporting.value = false
  }
}

function formatDate(dateStr: string) { return dateStr ? dateStr.split(' ')[0] : '' }

function getStatusBadgeStyle(label?: string) {
  if (!label) return { backgroundColor: '#f1f5f9', color: '#94a3b8' }
  const positive = ['正常', '穩定', '完成', '良好', '優良']
  const neutral = ['一般', '尚可', '未完成']
  const negative = ['亢奮', '疲憊', '差', '極差', '異常', '失禁', '出血', '跌倒']
  if (positive.includes(label)) return { backgroundColor: '#dcfce7', color: '#166534' }
  if (negative.includes(label)) return { backgroundColor: '#fee2e2', color: '#991b1b' }
  if (neutral.includes(label)) return { backgroundColor: '#fef3c7', color: '#92400e' }
  return { backgroundColor: '#dbeafe', color: '#1e40af' }
}

onMounted(() => loadData())
watch([dateFrom, dateTo], () => loadData())
</script>

<template>
  <div class="space-y-6">
    <!-- UI Controls -->
    <div class="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm no-export">
      <div class="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 class="text-lg font-bold" style="color: #1e293b;">Mom 報表數據中心</h1>
          <p class="mt-1 text-sm text-slate-500">視覺化統計與 PDF 存檔工具</p>
        </div>
        <div class="flex items-center gap-3">
          <input v-model="dateFrom" type="date" class="rounded-lg border border-slate-300 px-3 py-2 text-sm" />
          <span class="text-slate-400">至</span>
          <input v-model="dateTo" type="date" class="rounded-lg border border-slate-300 px-3 py-2 text-sm" />
          <button 
            @click="exportAndAttach" 
            :disabled="exporting || records.length === 0"
            class="rounded-lg bg-blue-600 px-6 py-2 text-sm font-bold text-white shadow-lg hover:bg-blue-700 disabled:opacity-50 transition-all active:scale-95"
            style="background-color: #2563eb;"
          >
            <span v-if="exporting" class="animate-spin mr-2 h-4 w-4 border-2 border-white border-t-transparent inline-block rounded-full"></span>
            {{ exporting ? '處理中...' : '產出 PDF 並掛載' }}
          </button>
        </div>
      </div>
    </div>

    <!-- UI Overlay / Notifications -->
    <div class="no-export">
      <ErrorMessage :message="error" />
      <div v-if="successMessage" class="rounded-xl p-4 text-sm font-bold text-green-700 border border-green-200" style="background-color: #f0fdf4;">
        ✅ {{ successMessage }}
      </div>
    </div>

    <!-- The Report Area (Captured as Image -> PDF) -->
    <div ref="reportArea" style="background: #ffffff; padding: 30px; border: 1px solid #f1f5f9; border-radius: 12px; font-family: sans-serif;">
      
      <!-- PDF Only Title -->
      <div class="hidden print-only" style="display: block; text-align: center; margin-bottom: 30px; border-bottom: 2px solid #334155; padding-bottom: 20px;">
        <h1 style="font-size: 28px; margin: 0; font-weight: 900; color: #0f172a;">Mom 每每日健康維護統計報告</h1>
        <div style="font-size: 13px; color: #64748b; margin-top: 8px; font-weight: 600;">
          查詢週期：{{ dateFrom }} ~ {{ dateTo }} | 產生時間：{{ new Date().toLocaleString() }}
        </div>
      </div>

      <!-- Stats Grid -->
      <div style="display: flex; gap: 20px; margin-bottom: 30px">
        <!-- Pie -->
        <div style="flex: 2; border: 1px solid #e2e8f0; border-radius: 12px; padding: 25px;">
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 25px;">
            <h3 style="margin: 0; color: #1e293b; font-size: 18px; font-weight: 800;">{{ availableMetrics.find(m => m.value === chartMetric)?.label }}分佈統計</h3>
            <select v-model="chartMetric" class="no-export" style="border: 1px solid #e2e8f0; border-radius: 4px; padding: 4px 10px;">
              <option v-for="m in availableMetrics" :key="m.value" :value="m.value">{{ m.label }}</option>
            </select>
          </div>
          <div style="display: flex; align-items: center; justify-content: space-around;" v-if="pieSlices.length > 0">
            <div style="width: 180px; height: 180px;">
              <svg viewBox="0 0 100 100" style="transform: rotate(-90deg);">
                <template v-for="(slice, i) in pieSlices" :key="i">
                  <circle v-if="slice.isFull" cx="50" cy="50" r="40" :fill="slice.color" />
                  <path v-else :d="slice.path" :fill="slice.color" />
                </template>
              </svg>
            </div>
            <div style="display: grid; gap: 8px;">
              <div v-for="slice in pieSlices" :key="slice.label" style="display: flex; align-items: center; gap: 12px;">
                <div :style="{ width: '12px', height: '12px', borderRadius: '3px', backgroundColor: slice.color }"></div>
                <span style="font-weight: 700; color: #334155; font-size: 14px;">{{ slice.label }}</span>
                <span style="color: #94a3b8; font-size: 14px;">{{ slice.count }} 筆 ({{ slice.percent }}%)</span>
              </div>
            </div>
          </div>
        </div>

        <!-- Summary -->
        <div style="flex: 1; border: 1px solid #e2e8f0; border-radius: 12px; padding: 25px; background: #fcfcfc;">
          <h3 style="margin: 0 0 20px 0; color: #1e293b; font-size: 18px; font-weight: 800;">數據總結</h3>
          <div style="padding: 15px; background: #ffffff; border-radius: 12px; border: 1px solid #e2e8f0; margin-bottom: 20px; display: flex; justify-content: space-between; align-items: center;">
            <span style="font-size: 13px; color: #64748b; font-weight: 800;">紀錄總天數</span>
            <span style="font-size: 32px; font-weight: 900; color: #2563eb;">{{ records.length }}</span>
          </div>
          <div style="padding: 15px; background: #eff6ff; border-radius: 12px; border: 1px solid #dbeafe;">
            <div style="font-size: 11px; color: #1d4ed8; font-weight: 900; margin-bottom: 10px;">強勢指標</div>
            <div style="display: grid; gap: 6px;">
              <div v-for="slice in pieSlices.slice(0, 3)" :key="slice.label" style="display: flex; justify-content: space-between; font-size: 13px;">
                <span style="font-weight: 800; color: #1e40af;">{{ slice.label }}</span>
                <span style="font-weight: 900; color: #1d4ed8;">{{ slice.percent }}%</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- Table Section -->
      <div style="border: 1px solid #e2e8f0; border-radius: 12px; overflow: hidden;">
        <div style="padding: 15px 25px; background: #f8fafc; border-bottom: 1px solid #e2e8f0;">
          <h3 style="margin: 0; color: #1e293b; font-size: 16px; font-weight: 800;">每日健康明細清單</h3>
        </div>
        <table style="width: 100%; border-collapse: collapse; font-size: 11px;">
          <thead>
            <tr>
              <th style="padding: 12px 10px; color: #94a3b8; border-bottom: 2px solid #e2e8f0; text-align: left;">日期</th>
              <th style="padding: 12px 10px; color: #94a3b8; border-bottom: 2px solid #e2e8f0; text-align: left;">姓名</th>
              <th style="padding: 12px 10px; color: #94a3b8; border-bottom: 2px solid #e2e8f0; text-align: center;">核心狀態</th>
              <th style="padding: 12px 10px; color: #94a3b8; border-bottom: 2px solid #e2e8f0; text-align: center;">三餐紀錄</th>
              <th style="padding: 12px 10px; color: #94a3b8; border-bottom: 2px solid #e2e8f0; text-align: center;">生理/活動</th>
              <th style="padding: 12px 10px; color: #94a3b8; border-bottom: 2px solid #e2e8f0; text-align: left;">備註</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="row in records" :key="row.id" style="border-bottom: 1px solid #f1f5f9;">
              <td style="padding: 12px 10px; color: #64748b; white-space: nowrap">{{ formatDate(row.documentDate) }}</td>
              <td style="padding: 12px 10px; font-weight: 900; color: #000000; white-space: nowrap">{{ row.name }}</td>
              <td style="padding: 12px 10px; text-align: center;">
                <span :style="{ ...getStatusBadgeStyle(row.morningMentalStatus), padding: '2px 8px', borderRadius: '4px', fontWeight: '900', border: '1px solid currentColor' }">
                  {{ row.morningMentalStatus || '—' }}
                </span>
                <span :style="{ ...getStatusBadgeStyle(row.lastNightSleep), padding: '2px 8px', borderRadius: '4px', fontWidth: 'bold', marginLeft: '4px' }">
                  {{ row.lastNightSleep || '—' }}
                </span>
              </td>
              <td style="padding: 12px 10px; text-align: center;">
                <span :style="{ ...getStatusBadgeStyle(row.breakfast), padding: '2px 6px', borderRadius: '4px' }">{{ row.breakfast || '—' }}</span>
                <span :style="{ ...getStatusBadgeStyle(row.lunch), padding: '2px 6px', borderRadius: '4px', marginLeft: '4px' }">{{ row.lunch || '—' }}</span>
                <span :style="{ ...getStatusBadgeStyle(row.dinner), padding: '2px 6px', borderRadius: '4px', marginLeft: '4px' }">{{ row.dinner || '—' }}</span>
              </td>
              <td style="padding: 12px 10px; text-align: center;">
                <span :style="{ ...getStatusBadgeStyle(row.excretionStatus), padding: '2px 8px', borderRadius: '4px' }">{{ row.excretionStatus || '—' }}</span>
                <span :style="{ ...getStatusBadgeStyle(row.dailyActivity), padding: '2px 8px', borderRadius: '4px', marginLeft: '4px' }">{{ row.dailyActivity || '—' }}</span>
              </td>
              <td style="padding: 12px 10px; color: #94a3b8; font-style: italic; max-width: 150px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">{{ row.description || '—' }}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  </div>
</template>

<style scoped>
@media screen { .print-only { display: none !important; } }
</style>
