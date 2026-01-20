/**
 * 權限狀態管理
 */

import type { MenuItem, UserType } from './types'
import { computed, ref } from 'vue'
import { getFieldVisibility, getUserMenuPermissions, getUserType } from './api'
import { MENU_ITEMS, SYSTEM_MENU_ITEMS } from './types'

// 狀態
const userType = ref<UserType>('User')
const enabledMenuIds = ref<string[]>([])
const permissionsLoaded = ref(false)
const clientId = ref<number | null>(null)
const orgId = ref<number | null>(null)

// 欄位可見性快取
const fieldVisibilityCache = ref<Record<string, boolean | null>>({})

/**
 * 權限 composable
 */
export function usePermission() {
  // 是否為 System 用戶
  const isSystem = computed(() => userType.value === 'System')

  // 可見選單列表
  const visibleMenuItems = computed<MenuItem[]>(() => {
    if (userType.value === 'System') {
      // System 用戶看到所有選單 + System 專用選單
      return [...MENU_ITEMS, ...SYSTEM_MENU_ITEMS]
    }

    // User：如果沒有設定任何權限，預設開放所有選單
    // 有設定權限時，只看到已啟用的選單
    if (enabledMenuIds.value.length === 0) {
      return MENU_ITEMS
    }
    return MENU_ITEMS.filter(item => enabledMenuIds.value.includes(item.id))
  })

  // 檢查選單是否可見
  function canAccessMenu(menuId: string): boolean {
    if (userType.value === 'System')
      return true
    // 沒設定權限時，預設全開放
    if (enabledMenuIds.value.length === 0)
      return true
    return enabledMenuIds.value.includes(menuId)
  }

  // 檢查路徑是否可存取
  function canAccessPath(path: string): boolean {
    if (userType.value === 'System')
      return true

    // 找到對應的選單項目
    const menuItem = [...MENU_ITEMS, ...SYSTEM_MENU_ITEMS].find(m => m.path === path)
    if (!menuItem)
      return true // 未定義的路徑預設允許

    // System 專用選單，User 不可存取
    if (SYSTEM_MENU_ITEMS.some(m => m.id === menuItem.id))
      return false

    // 沒設定權限時，預設全開放
    if (enabledMenuIds.value.length === 0)
      return true
    return enabledMenuIds.value.includes(menuItem.id)
  }

  // 載入權限
  async function loadPermissions(token: string, roleId: number, userId: number, pClientId: number, pOrgId: number) {
    try {
      // 判斷用戶類型
      userType.value = await getUserType(token, roleId)

      // 如果是 User，載入選單權限
      if (userType.value === 'User') {
        enabledMenuIds.value = await getUserMenuPermissions(token, userId)
      }
      else {
        // System 用戶有所有權限
        enabledMenuIds.value = MENU_ITEMS.map(m => m.id)
      }

      clientId.value = pClientId
      orgId.value = pOrgId
      fieldVisibilityCache.value = {}

      permissionsLoaded.value = true
    }
    catch (error) {
      console.error('Failed to load permissions:', error)
      userType.value = 'User'
      enabledMenuIds.value = []
      permissionsLoaded.value = true
    }
  }

  // 檢查欄位是否可見
  async function isFieldVisible(
    token: string,
    tableName: string,
    fieldName: string,
  ): Promise<boolean> {
    const key = `${tableName}.${fieldName}`

    // 已快取
    if (key in fieldVisibilityCache.value) {
      return fieldVisibilityCache.value[key] ?? true // null 預設為 true
    }

    // 未載入權限
    if (!clientId.value || !orgId.value) {
      return true
    }

    try {
      const visibility = await getFieldVisibility(token, tableName, fieldName, clientId.value, orgId.value)
      fieldVisibilityCache.value[key] = visibility
      return visibility ?? true // null 預設為 true (public)
    }
    catch (error) {
      console.error('Failed to check field visibility:', error)
      return true
    }
  }

  // 重設權限
  function resetPermissions() {
    userType.value = 'User'
    enabledMenuIds.value = []
    permissionsLoaded.value = false
    clientId.value = null
    orgId.value = null
    fieldVisibilityCache.value = {}
  }

  return {
    // 狀態
    userType: computed(() => userType.value),
    isSystem,
    enabledMenuIds: computed(() => enabledMenuIds.value),
    permissionsLoaded: computed(() => permissionsLoaded.value),
    visibleMenuItems,

    // 方法
    canAccessMenu,
    canAccessPath,
    loadPermissions,
    isFieldVisible,
    resetPermissions,

    // 常數
    allMenuItems: MENU_ITEMS,
    systemMenuItems: SYSTEM_MENU_ITEMS,
  }
}
