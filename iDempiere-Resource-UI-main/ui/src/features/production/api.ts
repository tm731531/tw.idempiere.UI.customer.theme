import { apiFetch } from '../../shared/api/http'

const API_V1 = '/api/v1'

export interface Production {
  id: number
  documentNo: string
  orderId: number
  orderLineId: number
  bpartnerId: number
  bpartnerName: string
  productId: number
  productName: string
  productionQty: number
  datePromised: string
  processed: boolean
  docStatus: string
}

export interface ProductionLine {
  id: number
  productionId: number
  productId: number
  productName: string
  movementQty: number
  isEndProduct: boolean
}

export async function listProductions(
  token: string,
  options: { filter?: string, top?: number, skip?: number } = {},
): Promise<{ records: Production[], totalCount: number }> {
  const searchParams: Record<string, string | number> = {
    $select: 'M_Production_ID,DocumentNo,C_BPartner_ID,M_Product_ID,DatePromised,Processed,DocStatus',
    $expand: 'M_ProductionLine($select=M_ProductionLine_ID,MovementQty,IsEndProduct)',
    $orderby: 'DatePromised desc,DocumentNo desc',
  }

  if (options.top)
    searchParams.$top = options.top
  if (options.skip)
    searchParams.$skip = options.skip
  if (options.filter)
    searchParams.$filter = options.filter

  const res = await apiFetch<{ 'records': any[], 'row-count'?: number }>(`${API_V1}/models/M_Production`, {
    token,
    searchParams,
  })

  const records = (res.records ?? []).map((r) => {
    // Calculate production quantity from lines (sum of end product quantities)
    const lines = Array.isArray(r.M_ProductionLine) ? r.M_ProductionLine : []
    const productionQty = lines
      .filter((line: any) => line.IsEndProduct === true || line.IsEndProduct === 'Y')
      .reduce((sum: number, line: any) => sum + Number(line.MovementQty ?? 0), 0)

    return {
      id: Number(r.id),
      documentNo: String(r.DocumentNo ?? ''),
      orderId: 0,
      orderLineId: 0,
      bpartnerId: Number(r.C_BPartner_ID?.id ?? r.C_BPartner_ID ?? 0),
      bpartnerName: String(r.C_BPartner_ID?.identifier ?? r.C_BPartner_ID?.name ?? ''),
      productId: Number(r.M_Product_ID?.id ?? r.M_Product_ID ?? 0),
      productName: String(r.M_Product_ID?.identifier ?? r.M_Product_ID?.name ?? ''),
      productionQty,
      datePromised: String(r.DatePromised ?? ''),
      processed: r.Processed === true || r.Processed === 'Y',
      docStatus: String(r.DocStatus ?? ''),
    }
  })

  return {
    records,
    totalCount: res['row-count'] ?? res.records?.length ?? 0,
  }
}

export async function getProduction(token: string, id: number): Promise<Production> {
  const res = await apiFetch<any>(`${API_V1}/models/M_Production/${id}`, { token })

  // Get production quantity from lines (sum of end product quantities)
  let productionQty = 0
  try {
    const lines = await getProductionLines(token, id)
    productionQty = lines
      .filter(line => line.isEndProduct)
      .reduce((sum, line) => sum + line.movementQty, 0)
  }
  catch (e) {
    console.warn('Failed to load production lines for quantity:', e)
  }

  return {
    id: Number(res.id),
    documentNo: String(res.DocumentNo ?? ''),
    orderId: 0,
    orderLineId: 0,
    bpartnerId: Number(res.C_BPartner_ID?.id ?? res.C_BPartner_ID ?? 0),
    bpartnerName: String(res.C_BPartner_ID?.identifier ?? res.C_BPartner_ID?.name ?? ''),
    productId: Number(res.M_Product_ID?.id ?? res.M_Product_ID ?? 0),
    productName: String(res.M_Product_ID?.identifier ?? res.M_Product_ID?.name ?? ''),
    productionQty,
    datePromised: String(res.DatePromised ?? ''),
    processed: res.Processed === true || res.Processed === 'Y',
    docStatus: String(res.DocStatus ?? ''),
  }
}

export async function getProductionLines(token: string, productionId: number): Promise<ProductionLine[]> {
  const res = await apiFetch<{ records: any[] }>(`${API_V1}/models/M_ProductionLine`, {
    token,
    searchParams: {
      $select: 'M_ProductionLine_ID,M_Production_ID,M_Product_ID,MovementQty,IsEndProduct',
      $filter: `M_Production_ID eq ${productionId}`,
      $orderby: 'Line',
    },
  })

  return (res.records ?? []).map(r => ({
    id: Number(r.id),
    productionId: Number(r.M_Production_ID?.id ?? r.M_Production_ID ?? 0),
    productId: Number(r.M_Product_ID?.id ?? r.M_Product_ID ?? 0),
    productName: String(r.M_Product_ID?.identifier ?? r.M_Product_ID?.name ?? ''),
    movementQty: Number(r.MovementQty ?? 0),
    isEndProduct: r.IsEndProduct === true || r.IsEndProduct === 'Y',
  }))
}

export async function getOrdersForProduction(token: string, options?: { filter?: string, top?: number, skip?: number }): Promise<any[]> {
  const searchParams: Record<string, string | number> = {
    $select: 'C_Order_ID,DocumentNo,C_BPartner_ID,DateOrdered,GrandTotal,DocStatus',
    $orderby: 'DateOrdered desc,DocumentNo desc',
    $filter: 'IsSOTrx eq true and DocStatus eq \'CO\'',
  }

  if (options?.filter)
    searchParams.$filter += ` and (${options.filter})`
  if (options?.top)
    searchParams.$top = options.top
  if (options?.skip)
    searchParams.$skip = options.skip

  const res = await apiFetch<{ records: any[] }>(`${API_V1}/models/C_Order`, {
    token,
    searchParams,
  })

  return res.records ?? []
}

export async function createProduction(
  token: string,
  order: {
    orderId: number
    orderLineId: number
    bpartnerId: number
    productId: number
    productionQty: number
    datePromised: string
  },
  lines: Array<{ productId: number, movementQty: number, isEndProduct: boolean }>,
): Promise<any> {
  const orderRes = await apiFetch<any>(`${API_V1}/models/M_Production`, {
    method: 'POST',
    token,
    json: {
      C_BPartner_ID: order.bpartnerId,
      M_Product_ID: order.productId,
      DatePromised: order.datePromised,
      Processed: false,
      DocStatus: 'DR',
      DocAction: 'CO',
    },
  })

  const productionId = orderRes.id || orderRes.M_Production_ID

  if (!productionId) {
    throw new Error('Failed to create production: no ID returned')
  }

  for (const line of lines) {
    await apiFetch<any>(`${API_V1}/models/M_ProductionLine`, {
      method: 'POST',
      token,
      json: {
        M_Production_ID: productionId,
        M_Product_ID: line.productId,
        MovementQty: line.movementQty,
        IsEndProduct: line.isEndProduct,
      },
    })
  }

  return orderRes
}

export async function updateProduction(
  token: string,
  id: number,
  data: { processed?: boolean },
): Promise<any> {
  const json: Record<string, any> = {}
  if (data.processed !== undefined)
    json.Processed = data.processed

  return await apiFetch<any>(`${API_V1}/models/M_Production/${id}`, {
    method: 'PUT',
    token,
    json,
  })
}
