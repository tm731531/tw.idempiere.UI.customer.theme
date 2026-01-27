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
      $select: 'M_Product_ID,Name,Value,C_UOM_ID,UPC,M_Product_Category_ID',
      $orderby: 'Name'
    }
  })
  console.log('[QR] 產品查詢原始結果 (一條):', res.records?.[0])

  return (res.records || []).map(r => {
    // 取得分類 ID (處理物件或原始值)
    const catVal = r.M_Product_Category_ID || r.m_product_category_id || r.categoryId
    const catId = catVal?.id ?? catVal

    // 取得 UPC/EAN
    const upc = r.UPC || r.upc || r.UPCEAN || ''

    return {
      id: r.M_Product_ID?.id ?? r.M_Product_ID ?? r.id,
      value: r.Value || r.value || r.SearchKey,
      name: r.Name || r.name,
      uomId: r.C_UOM_ID?.id ?? r.C_UOM_ID ?? r.uomId,
      upc: upc,
      categoryId: catId
    }
  })
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
      $filter: `(Value eq '${value}' or UPC eq '${value}') and IsActive eq true`,
      $select: 'M_Product_ID,Name,Value,UPC,C_UOM_ID'
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
        $select: 'M_Product_ID,Name,Value,UPC,C_UOM_ID'
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
    upc: r.UPC,
    uomId: r.C_UOM_ID?.id ?? r.C_UOM_ID,
    categoryId: r.M_Product_Category_ID?.id ?? r.M_Product_Category_ID
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
  const docTypeId = await getPurchaseOrderDocTypeId(token)
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
    if (typeof data === 'object' && data !== null && data.product) {
      return { product: data.product }
    }
  } catch {
    // 非 JSON，忽略錯誤繼續往下處理
  }

  // 非 JSON 或是純數字 (Barcode)，直接回傳內容
  if (content && content.trim()) {
    return { product: content.trim() }
  }

  return null
}

/**
 * 取得所有單位 (UOM)
 */
export async function getUOMs(token: string): Promise<{ id: number, name: string }[]> {
  const res = await apiFetch<{ records: any[] }>(`${API_V1}/models/C_UOM`, {
    token,
    searchParams: {
      $filter: `IsActive eq true`,
      $select: 'C_UOM_ID,Name',
      $orderby: 'Name'
    }
  })

  return (res.records || []).map(r => ({
    id: r.C_UOM_ID?.id ?? r.C_UOM_ID ?? r.id,
    name: r.Name
  }))
}

/**
 * 取得產品分類
 */
export async function getProductCategories(token: string): Promise<{ id: number, name: string }[]> {
  const res = await apiFetch<{ records: any[] }>(`${API_V1}/models/M_Product_Category`, {
    token,
    searchParams: {
      $filter: `IsActive eq true`,
      $select: 'M_Product_Category_ID,Name',
      $orderby: 'Name'
    }
  })

  return (res.records || []).map(r => ({
    id: r.M_Product_Category_ID?.id ?? r.M_Product_Category_ID ?? r.id,
    name: r.Name
  }))
}

/**
 * 取得稅務分類列表
 */
export async function getTaxCategories(token: string): Promise<{ id: number, name: string }[]> {
  const res = await apiFetch<{ records: any[] }>(`${API_V1}/models/C_TaxCategory`, {
    token,
    searchParams: {
      $filter: `IsActive eq true`,
      $select: 'C_TaxCategory_ID,Name',
      $orderby: 'Name'
    }
  })

  return (res.records || []).map(r => ({
    id: r.C_TaxCategory_ID?.id ?? r.C_TaxCategory_ID ?? r.id,
    name: r.Name
  }))
}

/**
 * 建立新產品
 */
export async function createProduct(token: string, data: { value: string, name: string, uomId: number, categoryId: number, price?: number }): Promise<Product> {
  // 1. 取得預設稅務分類 (必填)
  const taxCats = await getTaxCategories(token)
  const taxCategoryId = taxCats[0]?.id

  if (!taxCategoryId) {
    throw new Error('系統中找不到有效的稅務分類 (C_TaxCategory)，請確認 iDempiere 設定')
  }

  // 2. 建立產品
  const productRes = await apiFetch<{ id: number }>(`${API_V1}/models/M_Product`, {
    method: 'POST',
    token,
    json: {
      Value: data.value,
      Name: data.name,
      UPC: data.value, // 同步存入 UPC/EAN 欄位
      C_UOM_ID: data.uomId,
      M_Product_Category_ID: data.categoryId,
      C_TaxCategory_ID: taxCategoryId, // 加入稅務分類
      ProductType: 'I', // Item
      IsSummary: false,
      IsStocked: true,
      IsPurchased: true,
      IsSold: true
    }
  })

  const productId = productRes.id

  // 3. 如果有價格，將產品加入價格表 (M_ProductPrice)
  if (data.price !== undefined) {
    try {
      const versionId = await getPurchasePriceVersionId(token)
      if (versionId) {
        await apiFetch(`${API_V1}/models/M_ProductPrice`, {
          method: 'POST',
          token,
          json: {
            M_PriceList_Version_ID: versionId,
            M_Product_ID: productId,
            PriceStd: data.price,
            PriceList: data.price,
            PriceLimit: 0
          }
        })
        console.log(`[QR] 已將產品 ${productId} 加入價格表版本 ${versionId}, 價格: ${data.price}`)
      }
    } catch (e) {
      console.warn('[QR] 自動加入價格表失敗 (非致命錯誤):', e)
    }
  }

  return {
    id: productId,
    value: data.value,
    name: data.name,
    uomId: data.uomId
  }
}

/**
 * 更新產品資訊
 */
export async function updateProduct(token: string, productId: number, data: { name?: string, uomId?: number, categoryId?: number, upc?: string }): Promise<void> {
  const updateData: any = {}
  if (data.name) updateData.Name = data.name
  if (data.uomId) updateData.C_UOM_ID = data.uomId
  if (data.categoryId) updateData.M_Product_Category_ID = data.categoryId
  if (data.upc !== undefined) updateData.UPC = data.upc

  await apiFetch(`${API_V1}/models/M_Product/${productId}`, {
    method: 'PUT',
    token,
    json: updateData
  })
}

/**
 * 取得產品的廠商採購歷史紀錄 (從 C_OrderLine 抓取真實交易)
 */
export async function getProductPriceHistory(token: string, productId: number): Promise<{ vendorName: string, price: number, date?: string }[]> {
  try {
    const res = await apiFetch<{ records: any[] }>(`${API_V1}/models/C_OrderLine`, {
      token,
      searchParams: {
        $filter: `M_Product_ID eq ${productId} and IsActive eq true`,
        $select: 'PriceActual,C_Order_ID',
        $expand: 'C_Order_ID($select=C_BPartner_ID,DateOrdered,IsSOTrx)',
        $orderby: 'Updated desc',
        $top: '10'
      }
    })

    if (!res.records || res.records.length === 0) return []

    // 過濾出採購單 (非銷售單)
    const poLines = res.records.filter(r => r.C_Order_ID?.IsSOTrx === false || r.C_Order_ID?.IsSOTrx === 'N')

    // 取得所有廠商名稱進行對照
    const vendors = await getVendors(token)
    const vendorMap = new Map(vendors.map(v => [v.id, v.name]))

    console.log('[QR] 採購歷史原始紀錄 (一條):', poLines[0])

    return poLines.map(r => {
      const vId = r.C_Order_ID?.C_BPartner_ID?.id ?? r.C_Order_ID?.C_BPartner_ID
      const dateVal = r.C_Order_ID?.DateOrdered || r.C_Order_ID?.dateOrdered
      const date = dateVal?.split('T')[0] || ''

      return {
        vendorName: vendorMap.get(Number(vId)) || `廠商 #${vId}`,
        price: r.PriceActual || r.priceActual || 0,
        date: date
      }
    })
  } catch (e) {
    console.warn('[QR] 取得採購歷史失敗:', e)
    return []
  }
}

/**
 * 取得採購價格表版本 ID (名稱含 '採購表')
 */
export async function getPurchasePriceVersionId(token: string): Promise<number | null> {
  try {
    // 1. 找價格表 (M_PriceList)
    const plRes = await apiFetch<{ records: any[] }>(`${API_V1}/models/M_PriceList`, {
      token,
      searchParams: {
        $filter: `Name eq '採購表' and IsActive eq true`,
        $select: 'M_PriceList_ID',
        $top: '1'
      }
    })

    const priceListId = plRes.records?.[0]?.M_PriceList_ID?.id ?? plRes.records?.[0]?.M_PriceList_ID ?? plRes.records?.[0]?.id
    if (!priceListId) return null

    // 2. 找該價格表的最新版本 (M_PriceList_Version)
    const verRes = await apiFetch<{ records: any[] }>(`${API_V1}/models/M_PriceList_Version`, {
      token,
      searchParams: {
        $filter: `M_PriceList_ID eq ${priceListId} and IsActive eq true`,
        $select: 'M_PriceList_Version_ID',
        $orderby: 'ValidFrom desc',
        $top: '1'
      }
    })

    return verRes.records?.[0]?.M_PriceList_Version_ID?.id ?? verRes.records?.[0]?.M_PriceList_Version_ID ?? verRes.records?.[0]?.id ?? null
  } catch (e) {
    console.warn('[QR] 取得價格表失敗:', e)
    return null
  }
}

/**
 * 取得產品價格
 */
export async function getProductPrice(token: string, versionId: number, productId: number): Promise<number> {
  const res = await apiFetch<{ records: any[] }>(`${API_V1}/models/M_ProductPrice`, {
    token,
    searchParams: {
      $filter: `M_PriceList_Version_ID eq ${versionId} and M_Product_ID eq ${productId} and IsActive eq true`,
      $select: 'PriceStd', // 使用標準價
      $top: '1'
    }
  })

  return res.records?.[0]?.PriceStd || 0
}
