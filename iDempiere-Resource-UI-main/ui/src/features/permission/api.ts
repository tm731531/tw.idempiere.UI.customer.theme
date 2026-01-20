/**
 * 權限系統 API
 * 使用 AD_SysConfig 存儲選單權限
 */

import type { UserType } from './types'
import { apiFetch } from '../../shared/api/http'

const API_V1 = '/api/v1'

// SysConfig 名稱格式
const MENU_PERMISSION_PREFIX = 'EMUI_MENU_PERMISSION' // EMUI_MENU_PERMISSION_{userId}_{menuId}
const SYSTEM_ROLE_CONFIG = 'EMUI_SYSTEM_ROLES' // 逗號分隔的 System Role ID 列表
const FIELD_VISIBILITY_PREFIX = 'EMUI_FIELD_VISIBILITY' // EMUI_FIELD_VISIBILITY_{clientId}_{orgId}_{tableName}_{fieldName}

/**
 * 判斷使用者類型（System 或 User）
 * 根據 Role ID 是否在 EMUI_SYSTEM_ROLES 設定中
 */
export async function getUserType(token: string, roleId: number): Promise<UserType> {
  try {
    const res = await apiFetch<{ records: any[] }>(
      `${API_V1}/models/AD_SysConfig`,
      {
        token,
        searchParams: {
          $filter: `Name eq '${SYSTEM_ROLE_CONFIG}'`,
          $select: 'Value',
          $top: '1',
        },
      },
    )

    if (res.records && res.records.length > 0) {
      const systemRoleIds = (res.records[0].Value || '')
        .split(',')
        .map((s: string) => Number.parseInt(s.trim(), 10))
        .filter((n: number) => !Number.isNaN(n))

      if (systemRoleIds.includes(roleId)) {
        return 'System'
      }
    }

    return 'User'
  }
  catch (error) {
    console.error('Failed to get user type:', error)
    return 'User' // 預設為 User
  }
}

/**
 * 取得使用者的選單權限
 * @returns 已啟用的 menuId 列表
 */
export async function getUserMenuPermissions(
  token: string,
  userId: number,
): Promise<string[]> {
  try {
    const filter = `startswith(Name, '${MENU_PERMISSION_PREFIX}_${userId}_')`
    const res = await apiFetch<{ records: any[] }>(
      `${API_V1}/models/AD_SysConfig`,
      {
        token,
        searchParams: {
          $filter: filter,
          $select: 'Name,Value',
        },
      },
    )

    const enabledMenus: string[] = []
    for (const record of res.records ?? []) {
      if (record.Value === 'Y') {
        // 從 Name 提取 menuId: EMUI_MENU_PERMISSION_{userId}_{menuId}
        const parts = record.Name.split('_')
        const menuId = parts[parts.length - 1]
        if (menuId) {
          enabledMenus.push(menuId)
        }
      }
    }

    return enabledMenus
  }
  catch (error) {
    console.error('Failed to get user menu permissions:', error)
    return []
  }
}

/**
 * 設定使用者的選單權限
 */
export async function setUserMenuPermission(
  token: string,
  userId: number,
  menuId: string,
  enabled: boolean,
): Promise<boolean> {
  try {
    const configName = `${MENU_PERMISSION_PREFIX}_${userId}_${menuId}`
    const value = enabled ? 'Y' : 'N'

    // 檢查是否已存在
    const existing = await apiFetch<{ records: any[] }>(
      `${API_V1}/models/AD_SysConfig`,
      {
        token,
        searchParams: {
          $filter: `Name eq '${configName}'`,
          $top: '1',
        },
      },
    )

    if (existing.records && existing.records.length > 0) {
      // 更新
      const id = existing.records[0].id
      await apiFetch(`${API_V1}/models/AD_SysConfig/${id}`, {
        method: 'PUT',
        token,
        json: { Value: value },
      })
    }
    else {
      // 新增
      await apiFetch(`${API_V1}/models/AD_SysConfig`, {
        method: 'POST',
        token,
        json: {
          Name: configName,
          Value: value,
          ConfigurationLevel: 'C', // Client level
          Description: `Menu permission for user ${userId}, menu ${menuId}`,
        },
      })
    }

    return true
  }
  catch (error) {
    console.error('Failed to set menu permission:', error)
    return false
  }
}

/**
 * 批量設定使用者的選單權限
 */
export async function setUserMenuPermissions(
  token: string,
  userId: number,
  permissions: { menuId: string, enabled: boolean }[],
): Promise<boolean> {
  try {
    await Promise.all(
      permissions.map(p => setUserMenuPermission(token, userId, p.menuId, p.enabled)),
    )
    return true
  }
  catch (error) {
    console.error('Failed to set menu permissions:', error)
    return false
  }
}

/**
 * 取得所有使用者列表（用於權限設定 UI）
 */
export async function listUsers(token: string): Promise<{ id: number, name: string }[]> {
  try {
    const res = await apiFetch<{ records: any[] }>(
      `${API_V1}/models/AD_User`,
      {
        token,
        searchParams: {
          $select: 'AD_User_ID,Name',
          $filter: 'IsActive eq true',
          $orderby: 'Name',
        },
      },
    )

    return (res.records ?? []).map(r => ({
      id: Number(r.id || r.AD_User_ID),
      name: String(r.Name || ''),
    }))
  }
  catch (error) {
    console.error('Failed to list users:', error)
    return []
  }
}

/**
 * 設定 System Role（哪些 Role 是 System 權限）
 */
export async function setSystemRoles(token: string, roleIds: number[]): Promise<boolean> {
  try {
    const value = roleIds.join(',')

    const existing = await apiFetch<{ records: any[] }>(
      `${API_V1}/models/AD_SysConfig`,
      {
        token,
        searchParams: {
          $filter: `Name eq '${SYSTEM_ROLE_CONFIG}'`,
          $top: '1',
        },
      },
    )

    if (existing.records && existing.records.length > 0) {
      const id = existing.records[0].id
      await apiFetch(`${API_V1}/models/AD_SysConfig/${id}`, {
        method: 'PUT',
        token,
        json: { Value: value },
      })
    }
    else {
      await apiFetch(`${API_V1}/models/AD_SysConfig`, {
        method: 'POST',
        token,
        json: {
          Name: SYSTEM_ROLE_CONFIG,
          Value: value,
          ConfigurationLevel: 'S', // System level
          Description: 'Role IDs that have System permission (comma-separated)',
        },
      })
    }

    return true
  }
  catch (error) {
    console.error('Failed to set system roles:', error)
    return false
  }
}

/**
 * 取得 System Role 列表
 */
export async function getSystemRoles(token: string): Promise<number[]> {
  try {
    const res = await apiFetch<{ records: any[] }>(
      `${API_V1}/models/AD_SysConfig`,
      {
        token,
        searchParams: {
          $filter: `Name eq '${SYSTEM_ROLE_CONFIG}'`,
          $select: 'Value',
          $top: '1',
        },
      },
    )

    if (res.records && res.records.length > 0) {
      return (res.records[0].Value || '')
        .split(',')
        .map((s: string) => Number.parseInt(s.trim(), 10))
        .filter((n: number) => !Number.isNaN(n))
    }

    return []
  }
  catch (error) {
    console.error('Failed to get system roles:', error)
    return []
  }
}

/**
 * 設定欄位可見性
 * @param token - Auth token
 * @param tableName - 資料表名稱
 * @param fieldName - 欄位名稱
 * @param visible - 是否可見
 * @param clientId - AD_Client_ID
 * @param orgId - AD_Org_ID
 */
export async function setFieldVisibility(
  token: string,
  tableName: string,
  fieldName: string,
  visible: boolean,
  clientId: number,
  orgId: number,
): Promise<boolean> {
  try {
    const configName = `${FIELD_VISIBILITY_PREFIX}_${clientId}_${orgId}_${tableName}_${fieldName}`
    const value = visible ? 'Y' : 'N'

    const existing = await apiFetch<{ records: any[] }>(
      `${API_V1}/models/AD_SysConfig`,
      {
        token,
        searchParams: {
          $filter: `Name eq '${configName}'`,
          $top: '1',
        },
      },
    )

    if (existing.records && existing.records.length > 0) {
      const id = existing.records[0].id
      await apiFetch(`${API_V1}/models/AD_SysConfig/${id}`, {
        method: 'PUT',
        token,
        json: { Value: value },
      })
    }
    else {
      await apiFetch(`${API_V1}/models/AD_SysConfig`, {
        method: 'POST',
        token,
        json: {
          Name: configName,
          Value: value,
          ConfigurationLevel: 'C',
          Description: `Field visibility for ${tableName}.${fieldName} in client ${clientId}, org ${orgId}`,
        },
      })
    }

    return true
  }
  catch (error) {
    console.error('Failed to set field visibility:', error)
    return false
  }
}

/**
 * 批量設定欄位可見性
 */
export async function setFieldVisibilities(
  token: string,
  visibilities: {
    tableName: string
    fieldName: string
    visible: boolean
    clientId: number
    orgId: number
  }[],
): Promise<boolean> {
  try {
    await Promise.all(
      visibilities.map(v =>
        setFieldVisibility(token, v.tableName, v.fieldName, v.visible, v.clientId, v.orgId),
      ),
    )
    return true
  }
  catch (error) {
    console.error('Failed to set field visibilities:', error)
    return false
  }
}

/**
 * 取得欄位可見性
 */
export async function getFieldVisibility(
  token: string,
  tableName: string,
  fieldName: string,
  clientId: number,
  orgId: number,
): Promise<boolean | null> {
  try {
    const configName = `${FIELD_VISIBILITY_PREFIX}_${clientId}_${orgId}_${tableName}_${fieldName}`
    const res = await apiFetch<{ records: any[] }>(
      `${API_V1}/models/AD_SysConfig`,
      {
        token,
        searchParams: {
          $filter: `Name eq '${configName}'`,
          $select: 'Value',
          $top: '1',
        },
      },
    )

    if (res.records && res.records.length > 0) {
      return res.records[0].Value === 'Y'
    }

    return null // 未設定，預設為 public
  }
  catch (error) {
    console.error('Failed to get field visibility:', error)
    return null
  }
}

/**
 * 取得表格的所有欄位可見性設定
 */
export async function getFieldVisibilitiesForTable(
  token: string,
  tableName: string,
  clientId: number,
  orgId: number,
): Promise<Record<string, boolean>> {
  try {
    const filter = `startswith(Name, '${FIELD_VISIBILITY_PREFIX}_${clientId}_${orgId}_${tableName}_')`
    const res = await apiFetch<{ records: any[] }>(
      `${API_V1}/models/AD_SysConfig`,
      {
        token,
        searchParams: {
          $filter: filter,
          $select: 'Name,Value',
        },
      },
    )

    const visibilities: Record<string, boolean> = {}
    for (const record of res.records ?? []) {
      if (record.Name && record.Value) {
        const parts = record.Name.split('_')
        const fieldName = parts[parts.length - 1]
        if (fieldName) {
          visibilities[fieldName] = record.Value === 'Y'
        }
      }
    }

    return visibilities
  }
  catch (error) {
    console.error('Failed to get field visibilities:', error)
    return {}
  }
}
