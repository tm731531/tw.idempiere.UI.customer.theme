/**
 * QR Code 採購系統 - API 函數
 */

import { apiFetch } from '../../shared/api/http'
import type {
  Product,
  PurchaseOrderData,
  Vendor,
  CreateVendorRequest,
  Warehouse,
  CreateOrderResult
} from './types'

const API_V1 = '/api/v1'

/**
 * 取得所有可採購的產品
 * 註：移除 IsPurchased 過濾，顯示所有啟用的產品
 */
export async function getPurchasableProducts(token: string): Promise<Product[]> {
  console.log('[QR] 開始查詢產品...')
  const res = await apiFetch<{ records: any[] }>(`${API_V1}/models/M_Product`, {
    token,
    searchParams: {
      $filter: `IsActive eq true`,
      $select: 'M_Product_ID,Name,Value,C_UOM_ID',
      $orderby: 'Name'
    }
  })
  console.log('[QR] 產品查詢結果:', res)

  return (res.records || []).map(r => ({
    id: r.M_Product_ID?.id ?? r.M_Product_ID ?? r.id,
    value: r.Value,
    name: r.Name,
    uomId: r.C_UOM_ID?.id ?? r.C_UOM_ID
  }))
}

/**
 * 依產品編碼查詢產品
 * 支援精確匹配 Value 或 Name
 */
export async function getProductByValue(token: string, value: string): Promise<Product | null> {
  console.log('[QR] 查詢產品:', value)

  // 先嘗試精確匹配 Value
  let res = await apiFetch<{ records: any[] }>(`${API_V1}/models/M_Product`, {
    token,
    searchParams: {
      $filter: `Value eq '${value}' and IsActive eq true`,
      $select: 'M_Product_ID,Name,Value,C_UOM_ID'
    }
  })
  console.log('[QR] 按 Value 查詢結果:', res)

  // 如果找不到，嘗試匹配 Name
  if (!res.records || res.records.length === 0) {
    console.log('[QR] Value 找不到，嘗試按 Name 查詢...')
    res = await apiFetch<{ records: any[] }>(`${API_V1}/models/M_Product`, {
      token,
      searchParams: {
        $filter: `Name eq '${value}' and IsActive eq true`,
        $select: 'M_Product_ID,Name,Value,C_UOM_ID'
      }
    })
    console.log('[QR] 按 Name 查詢結果:', res)
  }

  if (!res.records || res.records.length === 0) {
    return null
  }

  const r = res.records[0]
  return {
    id: r.M_Product_ID?.id ?? r.M_Product_ID ?? r.id,
    value: r.Value,
    name: r.Name,
    uomId: r.C_UOM_ID?.id ?? r.C_UOM_ID
  }
}

/**
 * 取得 UOM 名稱
 */
export async function getUOMName(token: string, uomId: number): Promise<string> {
  const res = await apiFetch<{ records: any[] }>(`${API_V1}/models/C_UOM`, {
    token,
    searchParams: {
      $filter: `C_UOM_ID eq ${uomId}`,
      $select: 'C_UOM_ID,Name'
    }
  })

  return res.records?.[0]?.Name || '單位'
}

/**
 * 取得供應商清單
 * 註：移除 IsVendor 過濾，顯示所有啟用的 BP
 */
export async function getVendors(token: string): Promise<Vendor[]> {
  console.log('[QR] 開始查詢供應商...')
  const res = await apiFetch<{ records: any[] }>(`${API_V1}/models/C_BPartner`, {
    token,
    searchParams: {
      $filter: `IsActive eq true`,
      $select: 'C_BPartner_ID,Value,Name',
      $orderby: 'Name'
    }
  })
  console.log('[QR] 供應商查詢結果:', res)

  return (res.records || []).map(r => ({
    id: r.C_BPartner_ID?.id ?? r.C_BPartner_ID ?? r.id,
    value: r.Value,
    name: r.Name
  }))
}

/**
 * 新增供應商 (含地址)
 */
export async function createVendor(token: string, data: CreateVendorRequest): Promise<Vendor> {
  const value = data.value || `V-${new Date().toISOString().slice(0, 10).replace(/-/g, '')}-${Date.now().toString().slice(-3)}`

  // 1. 建立地址 (C_Location)
  const locationRes = await apiFetch<{ id: number }>(`${API_V1}/models/C_Location`, {
    method: 'POST',
    token,
    json: {
      Address1: data.name,
      C_Country_ID: 316  // 台灣
    }
  })
  const locationId = locationRes.id

  // 2. 建立供應商 (C_BPartner)
  const bpartnerRes = await apiFetch<{ id: number }>(`${API_V1}/models/C_BPartner`, {
    method: 'POST',
    token,
    json: {
      Value: value,
      Name: data.name,
      IsVendor: true,
      IsCustomer: false
    }
  })
  const bpartnerId = bpartnerRes.id

  // 3. 建立供應商地址關聯 (C_BPartner_Location)
  await apiFetch(`${API_V1}/models/C_BPartner_Location`, {
    method: 'POST',
    token,
    json: {
      C_BPartner_ID: bpartnerId,
      C_Location_ID: locationId,
      Name: '預設地址'
    }
  })

  return { id: bpartnerId, value, name: data.name }
}

/**
 * 取得倉庫清單
 */
export async function getWarehouses(token: string): Promise<Warehouse[]> {
  const res = await apiFetch<{ records: any[] }>(`${API_V1}/models/M_Warehouse`, {
    token,
    searchParams: {
      $filter: `IsActive eq true`,
      $select: 'M_Warehouse_ID,Name,AD_Org_ID',
      $orderby: 'Name'
    }
  })

  return (res.records || []).map(r => ({
    id: r.M_Warehouse_ID?.id ?? r.M_Warehouse_ID ?? r.id,
    name: r.Name,
    orgId: r.AD_Org_ID?.id ?? r.AD_Org_ID
  }))
}

/**
 * 取得採購單 DocType ID
 */
export async function getPurchaseOrderDocTypeId(token: string): Promise<number> {
  const res = await apiFetch<{ records: any[] }>(`${API_V1}/models/C_DocType`, {
    token,
    searchParams: {
      $filter: `DocBaseType eq 'POO' and IsActive eq true and docsubtypeso eq 'WR'`,
      $select: 'C_DocType_ID,Name',
      $top: '1'
    }
  })
  const docTypeId = res.records?.[0]?.C_DocType_ID?.id ?? res.records?.[0]?.C_DocType_ID ?? res.records?.[0]?.id

  console.log(res)
  if (!docTypeId) {
    throw new Error('找不到採購單單據類型')
  }
  return docTypeId
}

/**
 * 取得預設稅率 (Standard)
 */
export async function getDefaultTaxId(token: string): Promise<number> {
  // 先找名稱含 'Standard' 的
  let res = await apiFetch<{ records: any[] }>(`${API_V1}/models/C_Tax`, {
    token,
    searchParams: {
      $filter: `Name eq 'Standard' and IsActive eq true`,
      $select: 'C_Tax_ID',
      $top: '1'
    }
  })

  // 如果找不到，找任何一個有效的
  if (!res.records || res.records.length === 0) {
    res = await apiFetch<{ records: any[] }>(`${API_V1}/models/C_Tax`, {
      token,
      searchParams: {
        $filter: `IsActive eq true`,
        $select: 'C_Tax_ID',
        $top: '1'
      }
    })
  }

  const taxId = res.records?.[0]?.C_Tax_ID?.id ?? res.records?.[0]?.C_Tax_ID ?? res.records?.[0]?.id

  if (!taxId) {
    throw new Error('找不到稅率設定')
  }

  return taxId
}

/**
 * 建立採購單並完成
 */
export async function createPurchaseOrder(token: string, data: PurchaseOrderData): Promise<CreateOrderResult> {
  // 1. 取得 DocType
  const docTypeId =  await getPurchaseOrderDocTypeId(token)
  console.log(data)
  // 2. 建立 Order Header
  const dateOrdered = data.dateOrdered || new Date().toISOString().split('T')[0]
  const orderRes = await apiFetch<{ id: number }>(`${API_V1}/models/C_Order`, {
    method: 'POST',
    token,
    json: {
      AD_Org_ID: data.orgId,
      C_BPartner_ID: data.vendorId,
      IsSOTrx: false,
      M_Warehouse_ID: data.warehouseId,
      C_DocTypeTarget_ID: docTypeId,
      DateOrdered: dateOrdered
    }
  })

  const orderId = orderRes.id

  // 3. 取得預設稅率 (Standard)
  const taxId = await getDefaultTaxId(token)

  // 4. 建立 Order Lines
  for (const item of data.items) {
    await apiFetch(`${API_V1}/models/C_OrderLine`, {
      method: 'POST',
      token,
      json: {
        C_Order_ID: orderId,
        M_Product_ID: item.productId,
        QtyOrdered: item.qty,
        PriceActual: item.price,
        C_Tax_ID: taxId
      }
    })
  }

  // 5. 完成採購單 (透過 Process 呼叫)
  // table-id 259 = C_Order 的 AD_Table_ID
  await apiFetch(`${API_V1}/processes/c_order-process`, {
    method: 'POST',
    token,
    json: {
      'table-id': 259,
      'record-id': orderId
    }
  })

  // 5. 取得單號回傳
  const orderInfo = await apiFetch<{ records: any[] }>(`${API_V1}/models/C_Order`, {
    token,
    searchParams: {
      $filter: `C_Order_ID eq ${orderId}`,
      $select: 'C_Order_ID,DocumentNo'
    }
  })

  return {
    id: orderId,
    documentNo: orderInfo.records?.[0]?.DocumentNo || `PO-${orderId}`
  }
}

/**
 * 解析 QR Code 內容
 */
export function parseQRCode(content: string): { product: string } | null {
  try {
    // 嘗試 JSON 格式: {"product":"BANANA"}
    const data = JSON.parse(content)
    if (data.product) {
      return { product: data.product }
    }
  } catch {
    // 非 JSON，可能是純文字產品編碼
    if (content && content.trim()) {
      return { product: content.trim() }
    }
  }
  return null
}
