import { apiFetch } from '../../shared/api/http'

const API_V1 = '/api/v1'

export interface Order {
  id: number
  documentNo: string
  bpartnerId: number
  bpartnerName: string
  isSOTrx: boolean
  dateOrdered: string
  grandTotal: number
  docStatus: string
  warehouseId?: number
}

export interface OrderLine {
  id: number
  orderId: number
  productId: number
  productName: string
  qtyEntered: number
  priceEntered: number
  lineNetAmt: number
  taxId?: number
}

export interface Product {
  id: number
  name: string
  value?: string
  uom?: string
}

export interface Warehouse {
  id: number
  name: string
  orgId: number // AD_Org_ID
}

export interface Tax {
  id: number
  name: string
  rate: number
}

export async function listOrders(
  token: string,
  options: { isSOTrx: boolean, filter?: string, top?: number, skip?: number } = { isSOTrx: false },
): Promise<{ records: Order[], totalCount: number }> {
  const searchParams: Record<string, string | number> = {
    $select: 'C_Order_ID,DocumentNo,C_BPartner_ID,DateOrdered,GrandTotal,DocStatus,M_Warehouse_ID',
    $orderby: 'DateOrdered desc,DocumentNo desc',
    $filter: `IsSOTrx eq ${options.isSOTrx}`,
  }

  if (options.top)
    searchParams.$top = options.top
  if (options.skip)
    searchParams.$skip = options.skip
  if (options.filter)
    searchParams.$filter += ` and (${options.filter})`

  const res = await apiFetch<{ 'records': any[], 'row-count'?: number }>(`${API_V1}/models/C_Order`, {
    token,
    searchParams,
  })

  const records = (res.records ?? []).map((r) => {
    // 处理 DocStatus，可能是对象或字符串
    let docStatus = ''
    if (r.DocStatus) {
      if (typeof r.DocStatus === 'object' && r.DocStatus !== null) {
        // 对象可能有 id、value、name 等属性
        docStatus = String(r.DocStatus.id ?? r.DocStatus.value ?? r.DocStatus.name ?? r.DocStatus.identifier ?? '')
      }
      else {
        docStatus = String(r.DocStatus)
      }
    }

    return {
      id: Number(r.id),
      documentNo: String(r.DocumentNo ?? ''),
      bpartnerId: Number(r.C_BPartner_ID?.id ?? r.C_BPartner_ID ?? 0),
      bpartnerName: String(r.C_BPartner_ID?.identifier ?? r.C_BPartner_ID?.name ?? ''),
      isSOTrx: r.IsSOTrx === true || r.IsSOTrx === 'Y',
      dateOrdered: String(r.DateOrdered ?? ''),
      grandTotal: Number(r.GrandTotal ?? 0),
      docStatus,
      warehouseId: r.M_Warehouse_ID?.id ? Number(r.M_Warehouse_ID.id) : undefined,
    }
  })

  return {
    records,
    totalCount: res['row-count'] ?? res.records?.length ?? 0,
  }
}

export async function getOrder(token: string, id: number): Promise<Order> {
  const res = await apiFetch<any>(`${API_V1}/models/C_Order/${id}`, { token })

  // 处理 DocStatus，可能是对象或字符串
  let docStatus = ''
  if (res.DocStatus) {
    if (typeof res.DocStatus === 'object' && res.DocStatus !== null) {
      // 对象可能有 id、value、name 等属性
      docStatus = String(res.DocStatus.id ?? res.DocStatus.value ?? res.DocStatus.name ?? res.DocStatus.identifier ?? '')
    }
    else {
      docStatus = String(res.DocStatus)
    }
  }

  return {
    id: Number(res.id),
    documentNo: String(res.DocumentNo ?? ''),
    bpartnerId: Number(res.C_BPartner_ID?.id ?? res.C_BPartner_ID ?? 0),
    bpartnerName: String(res.C_BPartner_ID?.identifier ?? res.C_BPartner_ID?.name ?? ''),
    isSOTrx: res.IsSOTrx === true || res.IsSOTrx === 'Y',
    dateOrdered: String(res.DateOrdered ?? ''),
    grandTotal: Number(res.GrandTotal ?? 0),
    docStatus,
    warehouseId: res.M_Warehouse_ID?.id ? Number(res.M_Warehouse_ID.id) : undefined,
  }
}

export async function getOrderLines(token: string, orderId: number): Promise<OrderLine[]> {
  const res = await apiFetch<{ records: any[] }>(`${API_V1}/models/C_OrderLine`, {
    token,
    searchParams: {
      $select: 'C_OrderLine_ID,C_Order_ID,M_Product_ID,QtyEntered,PriceEntered,LineNetAmt,C_Tax_ID',
      $filter: `C_Order_ID eq ${orderId}`,
      $orderby: 'Line',
    },
  })

  return (res.records ?? []).map(r => ({
    id: Number(r.id),
    orderId: Number(r.C_Order_ID?.id ?? r.C_Order_ID ?? 0),
    productId: Number(r.M_Product_ID?.id ?? r.M_Product_ID ?? 0),
    productName: String(r.M_Product_ID?.identifier ?? r.M_Product_ID?.name ?? ''),
    qtyEntered: Number(r.QtyEntered ?? 0),
    priceEntered: Number(r.PriceEntered ?? 0),
    lineNetAmt: Number(r.LineNetAmt ?? 0),
    taxId: r.C_Tax_ID?.id ? Number(r.C_Tax_ID.id) : undefined,
  }))
}

export async function listProducts(token: string, options?: { filter?: string, top?: number }): Promise<Product[]> {
  const searchParams: Record<string, string | number> = {
    $select: 'M_Product_ID,Name,Value,C_UOM_ID',
    $orderby: 'Name',
  }

  if (options?.filter)
    searchParams.$filter = options.filter
  if (options?.top)
    searchParams.$top = options.top

  const res = await apiFetch<{ records: any[] }>(`${API_V1}/models/M_Product`, {
    token,
    searchParams,
  })

  return (res.records ?? []).map(r => ({
    id: Number(r.id),
    name: String(r.Name ?? ''),
    value: r.Value ? String(r.Value) : undefined,
    uom: r.C_UOM_ID?.name ? String(r.C_UOM_ID.name) : undefined,
  }))
}

export async function listWarehouses(token: string): Promise<Warehouse[]> {
  const res = await apiFetch<{ records: any[] }>(`${API_V1}/models/M_Warehouse`, {
    token,
    searchParams: {
      $select: 'M_Warehouse_ID,Name,AD_Org_ID',
      $orderby: 'Name',
    },
  })

  return (res.records ?? []).map(r => ({
    id: Number(r.id),
    name: String(r.Name ?? ''),
    orgId: Number(r.AD_Org_ID?.id ?? r.AD_Org_ID ?? 0),
  }))
}

export async function listTaxes(token: string): Promise<Tax[]> {
  const res = await apiFetch<{ records: any[] }>(`${API_V1}/models/C_Tax`, {
    token,
    searchParams: {
      $select: 'C_Tax_ID,Name,Rate',
      $orderby: 'Name',
    },
  })

  return (res.records ?? []).map(r => ({
    id: Number(r.id),
    name: String(r.Name ?? ''),
    rate: Number(r.Rate ?? 0),
  }))
}

// 辅助函数：确保ID字段是纯数字（整数）
function ensureNumberId(value: number | string | undefined | null): number | null {
  if (value === undefined || value === null || value === '' || value === 0) {
    return null
  }
  if (typeof value === 'number') {
    return Number.isNaN(value) ? null : Math.floor(Math.abs(value))
  }
  if (typeof value === 'string') {
    // 只保留数字字符，移除所有非数字字符（包括小数点、负号等）
    const cleaned = value.replace(/\D/g, '')
    if (!cleaned || cleaned.length === 0) {
      return null
    }
    const num = Number.parseInt(cleaned, 10)
    return Number.isNaN(num) || num <= 0 ? null : num
  }
  return null
}

// 辅助函数：确保数值字段是纯数字
function ensureNumber(value: number | string | undefined | null): number {
  if (value === undefined || value === null || value === '') {
    return 0
  }
  if (typeof value === 'number') {
    return Number.isNaN(value) ? 0 : value
  }
  if (typeof value === 'string') {
    const cleaned = value.replace(/[^\d.-]/g, '')
    const num = Number.parseFloat(cleaned)
    return Number.isNaN(num) ? 0 : num
  }
  return 0
}

export async function createOrder(
  token: string,
  order: {
    bpartnerId: number
    isSOTrx: boolean
    dateOrdered: string
    warehouseId: number // 改为必填字段
    bpartnerLocationId?: number // 业务伙伴收货地点
    orgId: number // AD_Org_ID - 组织ID (必填)
    description?: string
  },
  lines: Array<{ productId: number, qtyEntered: number, priceEntered: number, taxId?: number }>,
): Promise<any> {
  // 确保所有ID字段都是纯数字
  const bpartnerId = ensureNumberId(order.bpartnerId)
  const warehouseId = ensureNumberId(order.warehouseId) // 仓库现在是必填的
  const bpartnerLocationId = order.bpartnerLocationId ? ensureNumberId(order.bpartnerLocationId) : null
  const orgId = ensureNumberId(order.orgId)

  if (!bpartnerId || bpartnerId <= 0) {
    throw new Error('客戶/供應商ID無效')
  }

  if (!warehouseId || warehouseId <= 0) {
    throw new Error('倉庫ID無效，必須填寫倉庫')
  }

  if (!orgId || orgId <= 0) {
    throw new Error('組織ID無效')
  }

  // 最终验证：确保 bpartnerId 是有效的数字
  const finalBpartnerId = Number(bpartnerId)
  if (Number.isNaN(finalBpartnerId) || finalBpartnerId <= 0) {
    throw new Error(`无效的客户/供应商ID: ${bpartnerId} (类型: ${typeof bpartnerId})`)
  }

  // 构建请求体，只包含非null的字段，并确保所有类型正确
  // 注意：DocAction 可能在创建时不应该设置，让后端使用默认值
  const finalWarehouseId = Number(warehouseId)
  if (Number.isNaN(finalWarehouseId) || finalWarehouseId <= 0) {
    throw new Error(`无效的仓库ID: ${warehouseId} (类型: ${typeof warehouseId})`)
  }

  const finalOrgId = Number(orgId)
  if (Number.isNaN(finalOrgId) || finalOrgId <= 0) {
    throw new Error(`无效的组织ID: ${orgId} (类型: ${typeof orgId})`)
  }

  const orderBody: Record<string, any> = {
    AD_Org_ID: finalOrgId, // 组织ID (必填)
    C_BPartner_ID: finalBpartnerId, // 确保是数字类型
    IsSOTrx: order.isSOTrx ? 'Y' : 'N', // iDempiere expects 'Y'/'N' string, not boolean
    DateOrdered: String(order.dateOrdered), // 确保是字符串
    M_Warehouse_ID: finalWarehouseId, // 仓库是必填字段
    DocStatus: 'DR', // 草稿状态
    // 不设置 DocAction，让后端使用默认值
  }

  // 如果有业务伙伴收货地点，添加到请求中
  if (bpartnerLocationId && bpartnerLocationId > 0) {
    const finalBpartnerLocationId = Number(bpartnerLocationId)
    if (!Number.isNaN(finalBpartnerLocationId) && finalBpartnerLocationId > 0) {
      orderBody.C_BPartner_Location_ID = finalBpartnerLocationId
    }
  }
  if (order.description && order.description.trim()) {
    orderBody.Description = String(order.description.trim()) // 确保是字符串
  }

  // 最终验证：确保所有数值字段都是有效的数字
  for (const [key, value] of Object.entries(orderBody)) {
    if (key.includes('_ID') && typeof value !== 'number') {
      throw new Error(`字段 ${key} 必须是数字类型，但得到: ${typeof value} (值: ${value})`)
    }
  }

  // 调试：在开发环境中打印请求体
  console.log('Creating C_Order with body:', JSON.stringify(orderBody, null, 2))
  console.log('Body types:', Object.entries(orderBody).map(([k, v]) => `${k}: ${typeof v}`).join(', '))

  const orderRes = await apiFetch<any>(`${API_V1}/models/C_Order`, {
    method: 'POST',
    token,
    json: orderBody,
  })

  const orderId = orderRes.id || orderRes.C_Order_ID

  if (!orderId) {
    throw new Error('Failed to create order: no ID returned')
  }

  // 确保orderId是数字
  const numericOrderId = ensureNumberId(orderId)
  if (!numericOrderId) {
    throw new Error('訂單ID無效')
  }

  for (const line of lines) {
    // 确保所有数值字段都是纯数字
    const productId = ensureNumberId(line.productId)
    const qtyEntered = ensureNumber(line.qtyEntered)
    const priceEntered = ensureNumber(line.priceEntered)
    const taxId = line.taxId ? ensureNumberId(line.taxId) : null

    if (!productId || productId <= 0) {
      throw new Error('商品ID無效')
    }

    if (qtyEntered <= 0) {
      throw new Error('數量必須大於0')
    }

    if (priceEntered < 0) {
      throw new Error('單價不能為負數')
    }

    // 构建订单行请求体，只包含非null的字段，并确保所有类型正确
    const lineBody: Record<string, any> = {
      C_Order_ID: Number(numericOrderId), // 确保是数字类型
      M_Product_ID: Number(productId), // 确保是数字类型
      QtyEntered: Number(qtyEntered), // 确保是数字类型
      PriceEntered: Number(priceEntered), // 确保是数字类型
    }

    // 只在有值时才添加税ID（避免发送 null）
    if (taxId && taxId > 0) {
      lineBody.C_Tax_ID = Number(taxId) // 确保是数字类型
    }

    // 调试：在开发环境中打印请求体
    if (import.meta.env.DEV) {
      console.log('Creating C_OrderLine with body:', JSON.stringify(lineBody, null, 2))
    }

    await apiFetch<any>(`${API_V1}/models/C_OrderLine`, {
      method: 'POST',
      token,
      json: lineBody,
    })
  }

  return orderRes
}
