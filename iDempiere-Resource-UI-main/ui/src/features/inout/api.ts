import { apiFetch } from '../../shared/api/http'

const API_V1 = '/api/v1'

export interface InOut {
  id: number
  documentNo: string
  orderId: number
  orderNo: string
  bpartnerId: number
  bpartnerName: string
  isSOTrx: boolean
  movementDate: string
  docStatus: string
}

export interface InOutLine {
  id: number
  inOutId: number
  orderLineId: number
  productId: number
  productName: string
  qtyOrdered: number
  movementQty: number
}

export async function getPendingPurchaseOrders(token: string): Promise<any[]> {
  const res = await apiFetch<{ records: any[] }>(`${API_V1}/models/C_Order`, {
    token,
    searchParams: {
      $select: 'C_Order_ID,DocumentNo,C_BPartner_ID,C_BPartner_Location_ID,DateOrdered,GrandTotal,DocStatus,M_Warehouse_ID,AD_Org_ID,C_DocType_ID,C_DocTypeTarget_ID',
      $filter: `IsSOTrx eq 'N' and (DocStatus eq 'IP' or DocStatus eq 'CO')`,
      $orderby: 'DateOrdered desc,DocumentNo desc',
    },
  })
  return res.records ?? []
}

export async function getOrderLines(token: string, orderId: number): Promise<any[]> {
  const res = await apiFetch<{ records: any[] }>(`${API_V1}/models/C_OrderLine`, {
    token,
    searchParams: {
      $select: 'C_OrderLine_ID,C_Order_ID,M_Product_ID,QtyEntered,QtyDelivered,PriceEntered,LineNetAmt,C_Tax_ID,C_UOM_ID',
      $filter: `C_Order_ID eq ${orderId}`,
      $orderby: 'Line',
    },
  })
  return res.records ?? []
}

export async function getReceiptDocType(token: string): Promise<number> {
  // Fetch all DocTypes without filter to debug
  const res = await apiFetch<any>(`${API_V1}/models/C_DocType`, {
    token,
    searchParams: {
      $select: 'C_DocType_ID,Name,DocBaseType,IsSOTrx',
      $filter: 'IsActive eq true', // 只取得啟用的單據類型
    },
  })

  // Handle different response formats
  const records = res.records ?? res ?? []

  if (!Array.isArray(records) || records.length === 0) {
    throw new Error('找不到任何單據類型，請聯繫系統管理員')
  }

  // Look for Material Receipt (MMR) first - this is the standard for vendor receipts
  let doc = records.find((r: any) => r.DocBaseType === 'MMR')
  if (doc)
    return doc.id

  // Look for Material Receipt by name with various patterns
  const receiptPatterns = [
    (r: any) => r.Name?.toLowerCase()?.includes('material receipt'),
    (r: any) => r.Name?.includes('收貨') || r.Name?.includes('收單'),
    (r: any) => r.Name?.toLowerCase()?.includes('vendor receipt'),
    (r: any) => r.Name?.toLowerCase()?.includes('purchase receipt'),
    (r: any) => r.Name?.includes('MM') && !r.IsSOTrx, // Material Management, not Sales
  ]

  for (const pattern of receiptPatterns) {
    doc = records.find(pattern)
    if (doc)
      return doc.id
  }

  // Last resort: return first non-sales DocType as fallback
  const nonSalesDoc = records.find((r: any) => !r.IsSOTrx)
  if (nonSalesDoc) {
    console.warn('使用非銷貨單據類型作為收貨單據:', nonSalesDoc.Name)
    return nonSalesDoc.id
  }

  throw new Error('找不到適合的收貨單據類型，請聯繫系統管理員設定')
}

export async function createInOut(
  token: string,
  order: any,
  movementDate: string,
  docTypeId: number,
): Promise<any> {
  // Always get a valid receipt DocType
  const receiptDocTypeId = docTypeId > 0 ? docTypeId : await getReceiptDocType(token)

  // Extract and validate organization ID
  // iDempiere may return org as object or plain ID
  let orgId: number | undefined
  if (order.AD_Org_ID) {
    if (typeof order.AD_Org_ID === 'object') {
      orgId = order.AD_Org_ID.id
    }
    else if (typeof order.AD_Org_ID === 'string' || typeof order.AD_Org_ID === 'number') {
      orgId = Number(order.AD_Org_ID)
    }
  }

  if (!orgId || orgId <= 0) {
    console.error('Missing or invalid AD_Org_ID in order:', order)
    throw new Error('採購訂單缺少有效的組織資訊，無法建立收貨單')
  }

  // Helper function to extract ID from iDempiere response
  const extractId = (field: any): number | undefined => {
    if (!field)
      return undefined
    if (typeof field === 'object') {
      return field.id ? Number(field.id) : undefined
    }
    if (typeof field === 'string' || typeof field === 'number') {
      return Number(field)
    }
    return undefined
  }

  // Extract other required fields with validation
  const bpartnerId = extractId(order.C_BPartner_ID)
  const warehouseId = extractId(order.M_Warehouse_ID)
  const bpartnerLocationId = extractId(order.C_BPartner_Location_ID)

  if (!bpartnerId || bpartnerId <= 0) {
    throw new Error('採購訂單缺少有效的客戶資訊')
  }
  if (!warehouseId || warehouseId <= 0) {
    throw new Error('採購訂單缺少有效的倉庫資訊')
  }

  // Build body with required fields - all fields must be explicitly set
  const body: Record<string, any> = {
    AD_Org_ID: orgId,
    C_BPartner_ID: bpartnerId,
    C_BPartner_Location_ID: bpartnerLocationId,
    M_Warehouse_ID: warehouseId,
    MovementDate: movementDate,
    DateAcct: movementDate,
    IsSOTrx: 'N',
    C_DocType_ID: receiptDocTypeId, // Always set DocType - it's required
    C_Order_ID: order.id, // Include order reference
  }

  console.log('Creating M_InOut with body:', body)

  try {
    // Create M_InOut with all required fields
    const res = await apiFetch<any>(`${API_V1}/models/M_InOut`, {
      method: 'POST',
      token,
      json: body,
    })

    return res
  }
  catch (error: any) {
    console.error('Create M_InOut error:', error)
    throw new Error(`建立收貨單失敗: ${error?.detail || error?.message || '未知錯誤'}`)
  }
}

export async function getInOut(token: string, id: number): Promise<InOut> {
  const res = await apiFetch<any>(`${API_V1}/models/M_InOut/${id}`, { token })
  return {
    id: Number(res.id),
    documentNo: String(res.DocumentNo ?? ''),
    orderId: Number(res.C_Order_ID?.id ?? res.C_Order_ID ?? 0),
    orderNo: String(res.C_Order_ID?.identifier ?? res.C_Order_ID?.documentNo ?? ''),
    bpartnerId: Number(res.C_BPartner_ID?.id ?? res.C_BPartner_ID ?? 0),
    bpartnerName: String(res.C_BPartner_ID?.identifier ?? res.C_BPartner_ID?.name ?? ''),
    isSOTrx: res.IsSOTrx === true || res.IsSOTrx === 'Y',
    movementDate: String(res.MovementDate ?? ''),
    docStatus: String(res.DocStatus ?? ''),
  }
}

export async function getInOutLines(token: string, inOutId: number): Promise<InOutLine[]> {
  const res = await apiFetch<{ records: any[] }>(`${API_V1}/models/M_InOutLine`, {
    token,
    searchParams: {
      $select: 'M_InOutLine_ID,M_InOut_ID,C_OrderLine_ID,M_Product_ID,MovementQty,QtyEntered',
      $filter: `M_InOut_ID eq ${inOutId}`,
      $orderby: 'Line',
    },
  })

  return (res.records ?? []).map(r => ({
    id: Number(r.id),
    inOutId: Number(r.M_InOut_ID?.id ?? r.M_InOut_ID ?? 0),
    orderLineId: Number(r.C_OrderLine_ID?.id ?? r.C_OrderLine_ID ?? 0),
    productId: Number(r.M_Product_ID?.id ?? r.M_Product_ID ?? 0),
    productName: String(r.M_Product_ID?.name ?? r.M_Product_ID?.identifier ?? ''),
    qtyOrdered: Number(r.QtyEntered ?? 0),
    movementQty: Number(r.MovementQty ?? 0),
  }))
}

export async function createInOutLine(
  token: string,
  inOutId: number,
  orderLine: any,
  quantity: number,
  locatorId: number,
  orgId: number,
): Promise<any> {
  const body = {
    AD_Org_ID: orgId,
    M_InOut_ID: inOutId,
    C_OrderLine_ID: orderLine.id,
    M_Product_ID: orderLine.M_Product_ID?.id ?? orderLine.M_Product_ID,
    MovementQty: quantity,
    QtyEntered: quantity,
    M_Locator_ID: locatorId,
  }

  return await apiFetch<any>(`${API_V1}/models/M_InOutLine`, {
    method: 'POST',
    token,
    json: body,
  })
}

export async function updateInOutLine(
  token: string,
  inOutLineId: number,
  quantity: number,
): Promise<any> {
  return await apiFetch<any>(`${API_V1}/models/M_InOutLine/${inOutLineId}`, {
    method: 'PUT',
    token,
    json: {
      MovementQty: quantity,
      QtyEntered: quantity,
    },
  })
}

export async function completeInOut(token: string, inOutId: number): Promise<any> {
  // Use 'doc-action' field per iDempiere REST API
  // https://groups.google.com/g/idempiere/c/SUSZZDxPvXM
  return await apiFetch<any>(`${API_V1}/models/M_InOut/${inOutId}`, {
    method: 'PUT',
    token,
    json: {
      'doc-action': 'CO',
    },
  })
}

export async function getDefaultLocator(token: string, warehouseId: number): Promise<number> {
  try {
    const res = await apiFetch<any>(`${API_V1}/models/M_Locator`, {
      token,
      searchParams: {
        $select: 'M_Locator_ID',
        $filter: `M_Warehouse_ID eq ${warehouseId} and IsDefault eq 'Y'`,
        $top: 1,
      },
    })

    if (res?.records?.length > 0) {
      return res.records[0].id
    }

    // Fallback: get any locator for the warehouse
    const fallbackRes = await apiFetch<any>(`${API_V1}/models/M_Locator`, {
      token,
      searchParams: {
        $select: 'M_Locator_ID',
        $filter: `M_Warehouse_ID eq ${warehouseId}`,
        $top: 1,
      },
    })

    return fallbackRes?.records?.[0]?.id ?? 0
  }
  catch (e) {
    console.error('Failed to get default locator:', e)
    return 0
  }
}
