/**
 * Resource 相關工具函數
 */

import { apiFetch } from '../../shared/api/http'

const API_V1 = '/api/v1'

/**
 * SysConfig 操作的通用輔助函數
 */
export async function getSysConfig(
  token: string,
  configName: string,
): Promise<{ id: number, value: string } | null> {
  try {
    const res = await apiFetch<{ records: any[] }>(
      `${API_V1}/models/AD_SysConfig?$filter=Name eq '${configName}'&$select=id,Value&$top=1`,
      { token },
    )

    if (res.records && res.records.length > 0) {
      return {
        id: res.records[0].id,
        value: res.records[0].Value || '',
      }
    }
    return null
  }
  catch (error) {
    console.error(`Failed to get sysconfig ${configName}:`, error)
    throw error
  }
}

/**
 * 創建或更新 SysConfig
 */
export async function setSysConfig(
  token: string,
  configName: string,
  value: string,
  description: string,
  configLevel: 'S' | 'C' | 'O' = 'S',
): Promise<boolean> {
  try {
    const existing = await getSysConfig(token, configName)

    if (existing) {
      // 更新現有配置
      const response = await fetch(`${API_V1}/models/AD_SysConfig/${existing.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({ Value: value }),
      })

      if (!response.ok) {
        const errText = await response.text()
        throw new Error(`PUT failed: ${response.status} ${errText}`)
      }

      return true
    }
    else {
      // 創建新配置
      const body = {
        Name: configName,
        Value: value,
        ConfigurationLevel: configLevel,
        Description: description,
      }

      const response = await fetch(`${API_V1}/models/AD_SysConfig`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify(body),
      })

      if (!response.ok) {
        const errText = await response.text()
        throw new Error(`POST failed: ${response.status} ${errText}`)
      }

      return true
    }
  }
  catch (error) {
    console.error(`Failed to set sysconfig ${configName}:`, error)
    throw error
  }
}

/**
 * 批量獲取 SysConfig
 */
export async function batchGetSysConfig(
  token: string,
  configNames: string[],
): Promise<Map<string, string>> {
  const configMap = new Map<string, string>()

  if (configNames.length === 0)
    return configMap

  try {
    const filter = configNames.map(name => `Name eq '${name}'`).join(' or ')
    const res = await apiFetch<{ records: any[] }>(
      `${API_V1}/models/AD_SysConfig?$filter=${filter}&$select=Name,Value`,
      { token },
    )

    for (const record of res.records ?? []) {
      if (record.Name && record.Value) {
        configMap.set(record.Name, String(record.Value))
      }
    }
  }
  catch (error) {
    console.error('Failed to batch get sysconfig:', error)
  }

  return configMap
}
