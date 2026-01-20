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

// Pie Chart Statistics (的精神狀態 - morningMentalStatus)
const stats = computed(() => {
  const map = new Map<string, number>()
  for (const r of records.value) {
    if (r.morningMentalStatus) {
      map.set(r.morningMentalStatus, (map.get(r.morningMentalStatus) || 0) + 1)
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
    if (label === '正常' || label === '穩定') return '#10b981' // emerald-500
    if (label === '亢奮') return '#fbbf24' // amber-400
    if (label === '疲憊') return '#94a3b8' // slate-400
    
    const colors = ['#60a5fa', '#a78bfa', '#f472b6', '#f87171']
    return colors[index % colors.length]
  }

  return stats.value.map((s, i) => {
    const angle = (s.count / total) * 360
    const startAngle = currentAngle
    currentAngle += angle

    // Handle 100% case
    if (angle >= 359.9) {
      return {
        label: s.label,
        count: s.count,
        isFull: true,
        color: getColor(s.label, i),
        percent: 100
      }
    }

    // SVG arc calculation
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

    <ErrorMessage :message="error" />

    <!-- Chart and Stats Summary -->
    <div class="grid gap-6 lg:grid-cols-3">
      <!-- Pie Chart -->
      <div class="lg:col-span-2 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <h2 class="text-base font-semibold mb-6">精神狀態分佈 (起床時刻)</h2>
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
          <div class="grid grid-cols-2 gap-4">
            <div v-for="(slice, i) in pieSlices" :key="i" class="flex items-center gap-2">
              <div class="w-3 h-3 rounded-full" :style="{ backgroundColor: slice.color }"></div>
              <span class="text-sm text-slate-700 font-medium">{{ slice.label }}</span>
              <span class="text-sm text-slate-500">({{ slice.count }})</span>
            </div>
          </div>
        </div>
      </div>

      <!-- Quick Summary Card -->
      <div class="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <h2 class="text-base font-semibold mb-4">本週概覽</h2>
        <div class="space-y-4">
          <div class="flex items-center justify-between p-3 rounded-xl bg-slate-50">
            <span class="text-sm text-slate-600">總記錄天數</span>
            <span class="text-lg font-bold">{{ records.length }}</span>
          </div>
        </div>
      </div>
    </div>

    <!-- Data Table -->
    <div class="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden">
      <div class="p-6 border-b border-slate-100">
        <h2 class="text-base font-semibold">每日明細</h2>
      </div>
      <div class="overflow-x-auto">
        <table class="w-full text-left text-sm">
          <thead>
            <tr class="bg-slate-50 text-slate-600 font-medium">
              <th class="px-6 py-3">日期</th>
              <th class="px-6 py-3">姓名</th>
              <th class="px-6 py-3">夜間活動</th>
              <th class="px-6 py-3">睡前狀況</th>
              <th class="px-6 py-3">昨夜睡眠</th>
              <th class="px-6 py-3">起床精神</th>
              <th class="px-6 py-3">早餐</th>
              <th class="px-6 py-3">午餐</th>
              <th class="px-6 py-3">晚餐</th>
              <th class="px-6 py-3">排泄狀況</th>
              <th class="px-6 py-3">洗澡</th>
              <th class="px-6 py-3">活動</th>
              <th class="px-6 py-3">備註</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-slate-100">
            <tr v-for="row in records" :key="row.id" class="hover:bg-slate-50 transition-colors">
              <td class="px-6 py-4 whitespace-nowrap">{{ formatDate(row.documentDate) }}</td>
              <td class="px-6 py-4 font-medium text-slate-900">{{ row.name }}</td>
              <td class="px-6 py-4">{{ row.nightActivity || '—' }}</td>
              <td class="px-6 py-4">{{ row.beforeSleepStatus || '—' }}</td>
              <td class="px-6 py-4">{{ row.lastNightSleep || '—' }}</td>
              <td class="px-6 py-4">
                <span 
                  class="px-2 py-1 rounded-full text-xs font-medium"
                  :class="{
                    'bg-emerald-100 text-emerald-700': row.morningMentalStatus === '穩定' || row.morningMentalStatus === '正常',
                    'bg-amber-100 text-amber-700': row.morningMentalStatus === '亢奮',
                    'bg-slate-100 text-slate-700': row.morningMentalStatus === '疲憊'
                  }"
                >
                  {{ row.morningMentalStatus || '—' }}
                </span>
              </td>
              <td class="px-6 py-4">{{ row.breakfast || '—' }}</td>
              <td class="px-6 py-4">{{ row.lunch || '—' }}</td>
              <td class="px-6 py-4">{{ row.dinner || '—' }}</td>
              <td class="px-6 py-4">{{ row.excretionStatus || '—' }}</td>
              <td class="px-6 py-4">{{ row.bathing || '—' }}</td>
              <td class="px-6 py-4">{{ row.dailyActivity || '—' }}</td>
              <td class="px-6 py-4 text-slate-500 max-w-xs truncate">{{ row.description || '—' }}</td>
            </tr>
            <tr v-if="records.length === 0 && !loading">
              <td colspan="13" class="px-6 py-8 text-center text-slate-500">尚無相關記錄</td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  </div>
</template>
