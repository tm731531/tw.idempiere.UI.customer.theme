<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import ErrorMessage from '../../components/ErrorMessage.vue'
import { useAuth } from '../../features/auth/store'
import { listMomData, type MomData } from '../../features/mom/api'

const auth = useAuth()

const loading = ref(false)
const error = ref<string | null>(null)
const records = ref<MomData[]>([])

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

// Pie Chart Statistics based on selected metric
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
  
  // Semantic Color Mapping
  const getColor = (label: string, index: number) => {
    const positive = ['正常', '穩定', '完成', '良好', '優良']
    const neutral = ['一般', '尚可', '未完成']
    const negative = ['亢奮', '疲憊', '差', '極差', '異常']

    if (positive.includes(label)) return '#10b981' // emerald-500
    if (negative.includes(label)) return '#f87171' // red-500
    if (neutral.includes(label)) return '#fbbf24' // amber-400
    
    const colors = ['#60a5fa', '#a78bfa', '#f472b6', '#94a3b8']
    return colors[index % colors.length]
  }

  return stats.value.map((s, i) => {
    const angle = (s.count / total) * 360
    const startAngle = currentAngle
    currentAngle += angle

    if (angle >= 359.9) {
      return {
        label: s.label,
        count: s.count,
        isFull: true,
        color: getColor(s.label, i),
        percent: 100
      }
    }

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
    const res = await listMomData(auth.token.value, {
      dateFrom: dateFrom.value,
      dateTo: dateTo.value
    })
    records.value = res.records
  } catch (e: any) {
    error.value = e?.detail || e?.message || '載入失敗'
  } finally {
    loading.value = false
  }
}

function formatDate(dateStr: string) {
  if (!dateStr) return ''
  return dateStr.split(' ')[0]
}

function getStatusBadgeClass(label?: string) {
  if (!label) return 'bg-slate-50 text-slate-400'
  const positive = ['正常', '穩定', '完成', '良好', '優良']
  const neutral = ['一般', '尚可', '未完成']
  const negative = ['亢奮', '疲憊', '差', '極差', '異常']

  if (positive.includes(label)) return 'bg-emerald-100 text-emerald-700'
  if (negative.includes(label)) return 'bg-rose-100 text-rose-700'
  if (neutral.includes(label)) return 'bg-amber-100 text-amber-700'
  return 'bg-blue-100 text-blue-700'
}

onMounted(() => {
  loadData()
})

watch([dateFrom, dateTo], () => {
  loadData()
})
</script>

<template>
  <div class="space-y-6">
    <!-- Header -->
    <div class="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
      <div class="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 class="text-lg font-semibold">Mom 報表</h1>
          <p class="mt-1 text-sm text-slate-600">管理與回顧每日健康狀態</p>
        </div>
        <div class="flex items-center gap-3">
          <div class="flex items-center gap-2">
            <input 
              v-model="dateFrom"
              type="date"
              class="rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-brand-500 focus:ring-1 focus:ring-brand-500"
            />
            <span class="text-slate-400">至</span>
            <input 
              v-model="dateTo"
              type="date"
              class="rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-brand-500 focus:ring-1 focus:ring-brand-500"
            />
          </div>
        </div>
      </div>
    </div>

    <ErrorMessage :message="error" />

    <!-- Chart and Stats Summary -->
    <div class="grid gap-6 lg:grid-cols-3">
      <!-- Pie Chart Section -->
      <div class="lg:col-span-2 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <div class="flex items-center justify-between mb-6">
          <h2 class="text-base font-semibold">
            {{ availableMetrics.find(m => m.value === chartMetric)?.label }}分佈
          </h2>
          <select 
            v-model="chartMetric"
            class="rounded-lg border border-slate-300 px-3 py-1.5 text-sm font-medium focus:border-brand-500 focus:ring-1 focus:ring-brand-500"
          >
            <option v-for="m in availableMetrics" :key="m.value" :value="m.value">
              {{ m.label }}
            </option>
          </select>
        </div>

        <div v-if="loading" class="flex h-64 items-center justify-center">
          <div class="animate-spin rounded-full h-8 w-8 border-b-2 border-brand-500"></div>
        </div>
        <div v-else-if="pieSlices.length === 0" class="flex h-64 items-center justify-center text-slate-500">
          目前無資料
        </div>
        <div v-else class="flex flex-col md:flex-row items-center justify-around gap-8">
          <div class="relative w-64 h-64">
            <svg viewBox="0 0 100 100" class="w-full h-full -rotate-90">
              <template v-for="(slice, i) in pieSlices" :key="i">
                <circle 
                  v-if="slice.isFull"
                  cx="50" cy="50" r="40"
                  :fill="slice.color"
                  class="hover:opacity-80 transition-opacity cursor-pointer"
                >
                  <title>{{ slice.label }}: {{ slice.count }} ({{ slice.percent }}%)</title>
                </circle>
                <path 
                  v-else
                  :d="slice.path"
                  :fill="slice.color"
                  class="hover:opacity-80 transition-opacity cursor-pointer"
                >
                  <title>{{ slice.label }}: {{ slice.count }} ({{ slice.percent }}%)</title>
                </path>
              </template>
            </svg>
          </div>
          <div class="grid grid-cols-2 gap-x-8 gap-y-4">
            <div v-for="(slice, i) in pieSlices" :key="i" class="flex items-center gap-2">
              <div class="w-3 h-3 rounded-full" :style="{ backgroundColor: slice.color }"></div>
              <span class="text-sm text-slate-700 font-medium">{{ slice.label }}</span>
              <span class="text-sm text-slate-500">({{ slice.count }} 筆, {{ slice.percent }}%)</span>
            </div>
          </div>
        </div>
      </div>

      <!-- Quick Summary Card -->
      <div class="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <h2 class="text-base font-semibold mb-6">統計概覽</h2>
        <div class="space-y-4">
          <div class="flex items-center justify-between p-4 rounded-xl bg-slate-50 border border-slate-100">
            <span class="text-sm text-slate-600 font-medium">總記錄天數</span>
            <span class="text-xl font-bold text-brand-600">{{ records.length }}</span>
          </div>
          <div class="p-4 rounded-xl bg-slate-50 border border-slate-100">
            <div class="text-xs text-slate-400 mb-2 uppercase tracking-wider font-semibold">熱門指標</div>
            <div class="space-y-2">
              <div v-for="slice in pieSlices.slice(0, 3)" :key="slice.label" class="flex items-center justify-between text-sm">
                <span class="text-slate-700">{{ slice.label }}</span>
                <span class="font-semibold text-slate-900">{{ slice.percent }}%</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Data Table -->
    <div class="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden">
      <div class="p-6 border-b border-slate-100 flex items-center justify-between">
        <h2 class="text-base font-semibold">每日明細紀錄</h2>
        <div class="text-xs text-slate-400">共 {{ records.length }} 筆記錄</div>
      </div>
      <div class="overflow-x-auto">
        <table class="w-full text-left text-sm border-collapse">
          <thead>
            <tr class="bg-slate-50 text-slate-600 font-semibold border-b border-slate-100">
              <th class="px-6 py-4">日期</th>
              <th class="px-6 py-4">姓名</th>
              <th class="px-6 py-4">夜間活動</th>
              <th class="px-6 py-4">睡前狀況</th>
              <th class="px-6 py-4">昨夜睡眠</th>
              <th class="px-6 py-4">起床精神</th>
              <th class="px-6 py-4">早餐</th>
              <th class="px-6 py-4">午餐</th>
              <th class="px-6 py-4">晚餐</th>
              <th class="px-6 py-4">排泄狀況</th>
              <th class="px-6 py-4">洗澡</th>
              <th class="px-6 py-4">活動</th>
              <th class="px-6 py-4">備註</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-slate-100">
            <tr v-for="row in records" :key="row.id" class="hover:bg-slate-50/50 transition-colors">
              <td class="px-6 py-4 whitespace-nowrap text-slate-500 font-medium">{{ formatDate(row.documentDate) }}</td>
              <td class="px-6 py-4 font-bold text-slate-900">{{ row.name }}</td>
              <td class="px-6 py-4"><span :class="['px-2 py-0.5 rounded-full text-xs font-medium', getStatusBadgeClass(row.nightActivity)]">{{ row.nightActivity || '—' }}</span></td>
              <td class="px-6 py-4"><span :class="['px-2 py-0.5 rounded-full text-xs font-medium', getStatusBadgeClass(row.beforeSleepStatus)]">{{ row.beforeSleepStatus || '—' }}</span></td>
              <td class="px-6 py-4"><span :class="['px-2 py-0.5 rounded-full text-xs font-medium', getStatusBadgeClass(row.lastNightSleep)]">{{ row.lastNightSleep || '—' }}</span></td>
              <td class="px-6 py-4"><span :class="['px-2 py-0.5 rounded-full text-xs font-medium shadow-sm', getStatusBadgeClass(row.morningMentalStatus)]">{{ row.morningMentalStatus || '—' }}</span></td>
              <td class="px-6 py-4"><span :class="['px-2 py-0.5 rounded-full text-xs font-medium', getStatusBadgeClass(row.breakfast)]">{{ row.breakfast || '—' }}</span></td>
              <td class="px-6 py-4"><span :class="['px-2 py-0.5 rounded-full text-xs font-medium', getStatusBadgeClass(row.lunch)]">{{ row.lunch || '—' }}</span></td>
              <td class="px-6 py-4"><span :class="['px-2 py-0.5 rounded-full text-xs font-medium', getStatusBadgeClass(row.dinner)]">{{ row.dinner || '—' }}</span></td>
              <td class="px-6 py-4"><span :class="['px-2 py-0.5 rounded-full text-xs font-medium', getStatusBadgeClass(row.excretionStatus)]">{{ row.excretionStatus || '—' }}</span></td>
              <td class="px-6 py-4"><span :class="['px-2 py-0.5 rounded-full text-xs font-medium', getStatusBadgeClass(row.bathing)]">{{ row.bathing || '—' }}</span></td>
              <td class="px-6 py-4"><span :class="['px-2 py-0.5 rounded-full text-xs font-medium', getStatusBadgeClass(row.dailyActivity)]">{{ row.dailyActivity || '—' }}</span></td>
              <td class="px-6 py-4 text-slate-500 max-w-xs truncate italic text-xs">{{ row.description || '—' }}</td>
            </tr>
            <tr v-if="records.length === 0 && !loading">
              <td colspan="13" class="px-6 py-12 text-center text-slate-400 italic">目前區間尚無相關健康紀錄</td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  </div>
</template>
