/**
 * 日期時間格式化工具函數
 */

/**
 * 格式化日期時間為本地顯示格式 (M/d HH:mm)
 */
export function formatDateTime(dateStr: string): string {
  const d = new Date(dateStr)
  return `${d.getMonth() + 1}/${d.getDate()} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
}

/**
 * 格式化日期時間為本地顯示格式 (YYYY/M/d HH:mm)
 */
export function formatDateTimeLong(dateStr?: string): string {
  if (!dateStr)
    return '—'
  const d = new Date(dateStr)
  return `${d.getFullYear()}/${d.getMonth() + 1}/${d.getDate()} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
}

/**
 * 將 Date 對象轉換為 datetime-local 輸入框所需的格式 (YYYY-MM-DDTHH:mm)
 */
export function formatDateTimeLocal(d: Date): string {
  const offset = d.getTimezoneOffset() * 60000
  const localISOTime = new Date(d.getTime() - offset).toISOString().slice(0, 16)
  return localISOTime
}

/**
 * 格式化時間為 HH:mm
 */
export function formatEventTime(dateStr: string): string {
  const d = new Date(dateStr)
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
}

/**
 * 解析時間字串 (HH:mm) 為小時和分鐘
 */
export function parseTimeString(timeStr?: string): { hour: number, minute: number } | null {
  if (!timeStr)
    return null
  const match = timeStr.match(/^(\d{2}):(\d{2})/)
  if (!match)
    return null
  return { hour: Number.parseInt(match[1], 10), minute: Number.parseInt(match[2], 10) }
}

/**
 * 格式化時間字串為 HH:mm
 */
export function formatTime(timeStr?: string): string {
  const t = parseTimeString(timeStr)
  if (!t)
    return '--:--'
  return `${String(t.hour).padStart(2, '0')}:${String(t.minute).padStart(2, '0')}`
}

/**
 * 計算本週開始日期（週一）
 */
export function getWeekStart(now: Date = new Date()): Date {
  const weekStart = new Date(now)
  weekStart.setDate(now.getDate() - ((now.getDay() + 6) % 7))
  weekStart.setHours(0, 0, 0, 0)
  return weekStart
}

/**
 * 計算本週結束日期（下週一）
 */
export function getWeekEnd(weekStart: Date): Date {
  const weekEnd = new Date(weekStart)
  weekEnd.setDate(weekStart.getDate() + 7)
  return weekEnd
}
