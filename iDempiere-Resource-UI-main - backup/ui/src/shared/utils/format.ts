/**
 * 格式化工具函数
 */

/**
 * 格式化日期为本地显示格式 (YYYY/MM/DD)
 */
export function formatDate(dateStr?: string | null): string {
  if (!dateStr)
    return '—'
  try {
    const d = new Date(dateStr)
    if (Number.isNaN(d.getTime()))
      return '無效日期'
    return d.toLocaleDateString('zh-TW', { year: 'numeric', month: '2-digit', day: '2-digit' })
  }
  catch (e) {
    console.error('Date parsing error:', dateStr, e)
    return '格式錯誤'
  }
}

/**
 * 格式化金额
 */
export function formatMoney(amount: number | string | null | undefined): string {
  if (amount === null || amount === undefined || amount === '')
    return '0.00'
  const num = typeof amount === 'string' ? Number.parseFloat(amount) : amount
  if (Number.isNaN(num))
    return '0.00'
  return new Intl.NumberFormat('zh-TW', {
    style: 'decimal',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(num)
}

/**
 * 获取文档状态的 CSS 类名
 */
export function getDocStatusClass(status: string | null | undefined): string {
  if (!status)
    return 'bg-slate-100 text-slate-500'

  switch (status) {
    case 'CO':
      return 'bg-emerald-100 text-emerald-700'
    case 'DR':
      return 'bg-amber-100 text-amber-700'
    case 'VO':
      return 'bg-rose-100 text-rose-700'
    case 'IP':
      return 'bg-blue-100 text-blue-700'
    case 'CL':
      return 'bg-slate-100 text-slate-700'
    default:
      return 'bg-slate-100 text-slate-500'
  }
}

/**
 * 获取文档状态的显示文本
 */
export function getDocStatusText(status: string | null | undefined): string {
  if (!status)
    return status || '—'

  const statusMap: Record<string, string> = {
    CO: '完成',
    DR: '草稿',
    VO: '作廢',
    IP: '進行中',
    CL: '關閉',
  }

  return statusMap[status] || status
}

/**
 * 获取请求状态的 CSS 类名
 */
export function getRequestStatusClass(statusName?: string | null): string {
  if (!statusName)
    return 'bg-slate-100 text-slate-700'

  const map: Record<string, string> = {
    開啟: 'bg-emerald-100 text-emerald-700',
    進行中: 'bg-blue-100 text-blue-700',
    已關閉: 'bg-slate-100 text-slate-700',
    待處理: 'bg-amber-100 text-amber-700',
  }

  return map[statusName] || 'bg-slate-100 text-slate-700'
}

/**
 * 获取请求状态的颜色（用于图表等）
 */
export function getRequestStatusColor(statusName?: string | null): string {
  if (!statusName)
    return '#3b82f6'

  const statusColors: Record<string, string> = {
    開啟: '#10b981',
    進行中: '#3b82f6',
    已關閉: '#6b7280',
    待處理: '#f59e0b',
  }

  return statusColors[statusName] || '#3b82f6'
}
