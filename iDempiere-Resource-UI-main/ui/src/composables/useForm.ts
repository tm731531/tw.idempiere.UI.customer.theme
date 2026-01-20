/**
 * 表单管理 Composable
 * 提供通用的表单状态、验证、提交等功能
 */

import { reactive, ref } from 'vue'
import { getErrorMessage } from '../shared/utils/error'

export interface FormOptions<T> {
  initialValues?: Partial<T>
  onSubmit: (data: T) => Promise<void>
  onSuccess?: () => void
  validate?: (data: T) => string[]
}

export function useForm<T extends Record<string, unknown>>(options: FormOptions<T>) {
  const { initialValues = {}, onSubmit, onSuccess, validate } = options

  const formData = reactive<T>({ ...initialValues } as T)
  const submitting = ref(false)
  const error = ref<string | null>(null)
  const successMessage = ref<string | null>(null)

  async function handleSubmit() {
    error.value = null
    successMessage.value = null

    // 验证
    if (validate) {
      const errors = validate(formData)
      if (errors.length > 0) {
        error.value = errors.join('\n')
        return
      }
    }

    submitting.value = true

    try {
      await onSubmit(formData)
      successMessage.value = '操作成功'

      if (onSuccess) {
        onSuccess()
      }
      else {
        // 默认在 1 秒后清除成功消息
        setTimeout(() => {
          successMessage.value = null
        }, 1000)
      }
    }
    catch (e: unknown) {
      error.value = getErrorMessage(e, '操作失敗')
    }
    finally {
      submitting.value = false
    }
  }

  function resetForm() {
    Object.assign(formData, initialValues)
    error.value = null
    successMessage.value = null
  }

  function setFormData(data: Partial<T>) {
    Object.assign(formData, data)
  }

  return {
    formData,
    submitting,
    error,
    successMessage,
    handleSubmit,
    resetForm,
    setFormData,
  }
}
