/**
 * 錯誤處理工具函數
 */

import type { ApiError } from '../api/http'

/**
 * 檢查是否為外鍵約束錯誤
 */
function isForeignKeyConstraintError(error: unknown): boolean {
  if (error && typeof error === 'object') {
    const apiError = error as ApiError
    const detail = apiError.detail || ''
    const title = apiError.title || ''
    const message = (apiError as any).message || ''

    const errorText = `${detail} ${title} ${message}`.toLowerCase()

    // 檢查常見的外鍵約束錯誤關鍵字
    return (
      errorText.includes('foreign key')
      || errorText.includes('外鍵')
      || errorText.includes('constraint')
      || errorText.includes('constraint violation')
      || errorText.includes('referenced')
      || errorText.includes('被引用')
      || errorText.includes('cannot delete')
      || errorText.includes('無法刪除')
    )
  }
  return false
}

/**
 * 從錯誤對象中提取用戶友好的錯誤消息
 */
export function getErrorMessage(error: unknown, defaultMessage: string = '操作失敗'): string {
  // 檢查是否為外鍵約束錯誤
  if (isForeignKeyConstraintError(error)) {
    return '無法刪除此記錄，因為它被其他記錄引用。這是系統保護數據完整性的正常行為。如需刪除，請先刪除相關的引用記錄。'
  }

  if (error && typeof error === 'object') {
    const apiError = error as ApiError
    if (apiError.detail)
      return apiError.detail
    if (apiError.title)
      return apiError.title
    if (apiError.message && typeof apiError.message === 'string')
      return apiError.message
  }

  if (error instanceof Error) {
    return error.message
  }

  return defaultMessage
}
