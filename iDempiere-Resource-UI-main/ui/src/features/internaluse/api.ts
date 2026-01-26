/**
 * Internal Use 掃描領用系統 - API 函數
 * 使用 M_Inventory + QtyInternalUse 進行庫存增減（非盤點的絕對數量方式）
 */

import { apiFetch } from '../../shared/api/http'
import type {
  Charge,
  InternalUseData,
  CreateInventoryResult,
  Locator
} from './types'

const API_V1 = '/api/v1'

/**
 * 取得費用科目列表
 */
export async function getCharges(token: string): Promise<Charge[]> {
  console.log('[InternalUse] 開始查詢費用科目...')
  const res = await apiFetch<{ records: any[] }>(`${API_V1}/models/C_Charge`, {
    token,
    searchParams: {
      $filter: `IsActive eq true`,
      $select: 'C_Charge_ID,Name',
      $orderby: 'Name'
    }
  })
  console.log('[InternalUse] 費用科目查詢結果:', res)

  return (res.records || []).map(r => ({
    id: r.C_Charge_ID?.id ?? r.C_Charge_ID ?? r.id,
    name: r.Name
  }))
}

/**
 * 取得 Inventory Decrease 的 DocType ID
 * 查詢 DocBaseType = 'MMI' 且 DocSubTypeInv = 'I' (Internal Use) 的 DocType
 * 優先找名稱包含 "Decrease" 的
 */
export async function getInventoryDecreaseDocTypeId(token: string): Promise<number> {
  // 查詢所有 MMI (Material Physical Inventory) 類型的 DocType
  const res = await apiFetch<{ records: any[] }>(`${API_V1}/models/C_DocType`, {
    token,
    searchParams: {
      $filter: `DocBaseType eq 'MMI' and IsActive eq true`,
      $select: 'C_DocType_ID,Name,DocBaseType,DocSubTypeInv',
      $orderby: 'Name'
    }
  })

  console.log('[InternalUse] Inventory DocType 查詢結果:', res)

  if (res.records && res.records.length > 0) {
    // 優先找名稱包含 "Decrease" 或 "減少" 的
    let doc = res.records.find((r: any) =>
      r.Name?.toLowerCase()?.includes('decrease') ||
      r.Name?.includes('減少') ||
      r.Name?.includes('領用')
    )
    if (doc) {
      console.log('[InternalUse] 找到 Inventory Decrease DocType:', doc.Name)
      return doc.C_DocType_ID?.id ?? doc.C_DocType_ID ?? doc.id
    }

    // 其次找 DocSubTypeInv = 'I' (Internal Use) 的
    doc = res.records.find((r: any) => r.DocSubTypeInv === 'I')
    if (doc) {
      console.log('[InternalUse] 找到 Internal Use DocType:', doc.Name)
      return doc.C_DocType_ID?.id ?? doc.C_DocType_ID ?? doc.id
    }

    // 再找名稱包含 "Internal Use" 的
    doc = res.records.find((r: any) =>
      r.Name?.toLowerCase()?.includes('internal use') ||
      r.Name?.includes('內部')
    )
    if (doc) {
      console.log('[InternalUse] 找到 Internal Use Inventory DocType:', doc.Name)
      return doc.C_DocType_ID?.id ?? doc.C_DocType_ID ?? doc.id
    }

    // 最後取第一個 MMI 類型
    const first = res.records[0]
    console.log('[InternalUse] 使用第一個 MMI DocType:', first.Name)
    return first.C_DocType_ID?.id ?? first.C_DocType_ID ?? first.id
  }

  throw new Error('找不到 Inventory Decrease 單據類型，請確認系統已設定 DocBaseType=MMI 的單據')
}

/**
 * 取得倉庫的預設庫位
 */
export async function getLocatorByWarehouse(token: string, warehouseId: number): Promise<Locator | null> {
  const res = await apiFetch<{ records: any[] }>(`${API_V1}/models/M_Locator`, {
    token,
    searchParams: {
      $filter: `M_Warehouse_ID eq ${warehouseId} and IsActive eq true and IsDefault eq true`,
      $select: 'M_Locator_ID,Value,M_Warehouse_ID',
      $top: '1'
    }
  })

  // 如果找不到預設庫位，找任何一個庫位
  if (!res.records || res.records.length === 0) {
    const fallbackRes = await apiFetch<{ records: any[] }>(`${API_V1}/models/M_Locator`, {
      token,
      searchParams: {
        $filter: `M_Warehouse_ID eq ${warehouseId} and IsActive eq true`,
        $select: 'M_Locator_ID,Value,M_Warehouse_ID',
        $top: '1'
      }
    })

    if (!fallbackRes.records || fallbackRes.records.length === 0) {
      return null
    }

    const r = fallbackRes.records[0]
    return {
      id: r.M_Locator_ID?.id ?? r.M_Locator_ID ?? r.id,
      value: r.Value,
      warehouseId: r.M_Warehouse_ID?.id ?? r.M_Warehouse_ID
    }
  }

  const r = res.records[0]
  return {
    id: r.M_Locator_ID?.id ?? r.M_Locator_ID ?? r.id,
    value: r.Value,
    warehouseId: r.M_Warehouse_ID?.id ?? r.M_Warehouse_ID
  }
}

/**
 * 建立 Inventory Decrease 並完成
 * 使用 M_Inventory + QtyInternalUse 進行庫存增減
 *
 * 重要差異：
 * - Physical Inventory (盤點): 使用 QtyCount 設定絕對數量
 * - Inventory Decrease/Increase (增減): 使用 QtyInternalUse 增減數量
 *   - 正數 = 減少庫存 (Decrease)
 *   - 負數 = 增加庫存 (Increase)
 */
export async function createInternalUseInventory(
  token: string,
  data: InternalUseData
): Promise<CreateInventoryResult> {
  console.log('[InternalUse] 開始建立庫存減少單 (Inventory Decrease):', data)

  // 1. 取得 Inventory Decrease DocType (MMI with DocSubTypeInv='I')
  const docTypeId = await getInventoryDecreaseDocTypeId(token)

  // 2. 取得庫位
  const locator = await getLocatorByWarehouse(token, data.warehouseId)
  if (!locator) {
    throw new Error('找不到倉庫的庫位，請先設定庫位')
  }

  // 3. 建立 M_Inventory Header
  const movementDate = data.movementDate || new Date().toISOString().split('T')[0]
  const inventoryRes = await apiFetch<{ id: number }>(`${API_V1}/models/M_Inventory`, {
    method: 'POST',
    token,
    json: {
      AD_Org_ID: data.orgId,
      M_Warehouse_ID: data.warehouseId,
      C_DocType_ID: docTypeId,
      MovementDate: movementDate,
      Description: data.description || '掃描領用'
    }
  })

  const inventoryId = inventoryRes.id
  console.log('[InternalUse] 建立 M_Inventory Header 成功, ID:', inventoryId)

  // 4. 建立 M_InventoryLine (使用 QtyInternalUse 進行增減)
  for (const item of data.items) {
    await apiFetch(`${API_V1}/models/M_InventoryLine`, {
      method: 'POST',
      token,
      json: {
        AD_Org_ID: data.orgId,  // 必填欄位
        M_Inventory_ID: inventoryId,
        M_Locator_ID: locator.id,
        M_Product_ID: item.productId,
        // QtyInternalUse: 正數表示減少庫存，負數表示增加庫存
        // 這是「增減」方式，不是「設定絕對數量」的盤點方式
        QtyInternalUse: item.qty,
        C_Charge_ID: data.chargeId
      }
    })
    console.log('[InternalUse] 建立 M_InventoryLine 成功:', item.productName, '數量:', item.qty)
  }

  // 5. 完成單據 (使用 doc-action: CO)
  await apiFetch(`${API_V1}/models/M_Inventory/${inventoryId}`, {
    method: 'PUT',
    token,
    json: {
      'doc-action': 'CO'
    }
  })
  console.log('[InternalUse] 完成單據成功')

  // 6. 取得單號回傳
  const inventoryInfo = await apiFetch<{ records: any[] }>(`${API_V1}/models/M_Inventory`, {
    token,
    searchParams: {
      $filter: `M_Inventory_ID eq ${inventoryId}`,
      $select: 'M_Inventory_ID,DocumentNo'
    }
  })

  return {
    id: inventoryId,
    documentNo: inventoryInfo.records?.[0]?.DocumentNo || `INV-${inventoryId}`
  }
}

// 復用 qrpurchase 的函數
export { getWarehouses, getProductByValue, getUOMName, parseQRCode } from '../qrpurchase/api'
export type { Warehouse, Product } from '../qrpurchase/types'
