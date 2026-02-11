import { apiFetch } from '../../shared/api/http'

const API_V1 = '/api/v1'

type SearchParams = Record<string, string | number | boolean | undefined>

export interface Request {
  id: number
  name?: string
  description?: string
  bPartnerId: number
  bPartnerName?: string
  salesRepId?: number
  salesRepName?: string
  requestTypeId?: number
  requestTypeName?: string
  requestStatusId?: number
  requestStatusName?: string
  startDate?: string
  closeDate?: string
  created: string
}

export interface RequestType {
  id: number
  name: string
}

export interface RequestStatus {
  id: number
  name: string
  isActive?: boolean
  seqNo?: number
}

export async function listRequests(
  token: string,
  filter?: {
    bPartnerId?: number
    salesRepId?: number
    requestTypeId?: number
    requestStatusId?: number
    hasStartDate?: boolean
    hasCloseDate?: boolean
    createdAfter?: Date
  },
  pagination?: { top?: number, skip?: number },
): Promise<{ records: Request[], totalCount?: number }> {
  const searchParams: SearchParams = {
    $select: 'R_Request_ID,Summary,Result,C_BPartner_ID,SalesRep_ID,R_RequestType_ID,R_Status_ID,StartDate,CloseDate,Created',
    $expand: 'C_BPartner_ID($select=C_BPartner_ID,Name),SalesRep_ID($select=AD_User_ID,Name),R_RequestType_ID($select=R_RequestType_ID,Name),R_Status_ID($select=R_Status_ID,Name)',
    $orderby: 'Created desc',
  }

  if (pagination?.top)
    searchParams.$top = pagination.top
  if (pagination?.skip)
    searchParams.$skip = pagination.skip

  const filters: string[] = []

  if (filter?.bPartnerId)
    filters.push(`C_BPartner_ID eq ${filter.bPartnerId}`)
  if (filter?.salesRepId)
    filters.push(`SalesRep_ID eq ${filter.salesRepId}`)
  if (filter?.requestTypeId)
    filters.push(`R_RequestType_ID eq ${filter.requestTypeId}`)
  if (filter?.requestStatusId)
    filters.push(`R_Status_ID eq ${filter.requestStatusId}`)
  // Note: API doesn't support 'ne' operator, so we filter null checks client-side
  // For 'eq null' checks, we can still use server-side filtering
  if (filter?.hasStartDate === false) {
    filters.push('StartDate eq null')
  }
  if (filter?.hasCloseDate === false) {
    filters.push('CloseDate eq null')
  }

  // Store filter flags for client-side filtering (ne null cases)
  const needsClientFiltering = {
    hasStartDate: filter?.hasStartDate === true,
    hasCloseDate: filter?.hasCloseDate === true,
  }
  if (filter?.createdAfter) {
    const pad = (n: number) => String(n).padStart(2, '0')
    const s = `${filter.createdAfter.getFullYear()}-${pad(filter.createdAfter.getMonth() + 1)}-${pad(filter.createdAfter.getDate())} ${pad(filter.createdAfter.getHours())}:${pad(filter.createdAfter.getMinutes())}:${pad(filter.createdAfter.getSeconds())}`
    filters.push(`Created ge '${s}'`)
  }

  if (filters.length > 0) {
    searchParams.$filter = filters.join(' and ')
  }

  const res = await apiFetch<{ 'records': any[], 'row-count'?: number }>(
    `${API_V1}/models/R_Request`,
    { token, searchParams },
  )

  let requests: Request[] = (res.records ?? []).map(r => ({
    id: Number(r.id),
    name: r.Summary ? String(r.Summary) : undefined,
    description: r.Result ? String(r.Result) : undefined,
    bPartnerId: Number(r.C_BPartner_ID?.id ?? r.C_BPartner_ID ?? 0),
    bPartnerName: r.C_BPartner_ID?.name ? String(r.C_BPartner_ID.name) : (r.C_BPartner_ID?.identifier ? String(r.C_BPartner_ID.identifier) : undefined),
    salesRepId: r.SalesRep_ID?.id ? Number(r.SalesRep_ID.id) : undefined,
    salesRepName: r.SalesRep_ID?.name ? String(r.SalesRep_ID.name) : (r.SalesRep_ID?.identifier ? String(r.SalesRep_ID.identifier) : undefined),
    requestTypeId: r.R_RequestType_ID?.id ? Number(r.R_RequestType_ID.id) : undefined,
    requestTypeName: r.R_RequestType_ID?.name ? String(r.R_RequestType_ID.name) : (r.R_RequestType_ID?.identifier ? String(r.R_RequestType_ID.identifier) : undefined),
    requestStatusId: r.R_Status_ID?.id ? Number(r.R_Status_ID.id) : undefined,
    requestStatusName: r.R_Status_ID?.name ? String(r.R_Status_ID.name) : (r.R_Status_ID?.identifier ? String(r.R_Status_ID.identifier) : undefined),
    startDate: r.StartDate ? String(r.StartDate) : undefined,
    closeDate: r.CloseDate ? String(r.CloseDate) : undefined,
    created: String(r.Created),
  }))

  // Client-side filtering for 'ne null' cases (API doesn't support 'ne' operator)
  if (needsClientFiltering.hasStartDate) {
    requests = requests.filter(r => r.startDate != null)
  }
  if (needsClientFiltering.hasCloseDate) {
    requests = requests.filter(r => r.closeDate != null)
  }

  // 查询客户名称（使用 Name 字段替换 identifier）
  const bPartnerIds = Array.from(new Set(requests.filter(r => r.bPartnerId > 0).map(r => r.bPartnerId)))
  if (bPartnerIds.length > 0) {
    try {
      const bpFilter = bPartnerIds.map(id => `C_BPartner_ID eq ${id}`).join(' or ')
      const bpRes = await apiFetch<{ records: any[] }>(
        `${API_V1}/models/C_BPartner`,
        {
          token,
          searchParams: {
            $select: 'C_BPartner_ID,Name',
            $filter: bpFilter,
          },
        },
      )

      const bpNameMap = new Map<number, string>()
      for (const bp of bpRes.records ?? []) {
        const id = Number(bp.id)
        const name = String(bp.Name || '')
        if (id > 0 && name) {
          bpNameMap.set(id, name)
        }
      }

      // 更新请求中的客户名称（使用 Name 字段替换 identifier）
      for (const req of requests) {
        if (req.bPartnerId > 0 && bpNameMap.has(req.bPartnerId)) {
          req.bPartnerName = bpNameMap.get(req.bPartnerId)
        }
      }
    }
    catch (e) {
      console.warn('Failed to load business partner names:', e)
    }
  }

  // 查询咨询师名称（使用 Name 字段替换 identifier）
  const salesRepIds = Array.from(new Set(requests.filter(r => r.salesRepId && r.salesRepId > 0).map(r => r.salesRepId!)))
  if (salesRepIds.length > 0) {
    try {
      const userFilter = salesRepIds.map(id => `AD_User_ID eq ${id}`).join(' or ')
      const userRes = await apiFetch<{ records: any[] }>(
        `${API_V1}/models/AD_User`,
        {
          token,
          searchParams: {
            $select: 'AD_User_ID,Name',
            $filter: userFilter,
          },
        },
      )

      const userNameMap = new Map<number, string>()
      for (const user of userRes.records ?? []) {
        const id = Number(user.id)
        const name = String(user.Name || '')
        if (id > 0 && name) {
          userNameMap.set(id, name)
        }
      }

      // 更新请求中的咨询师名称（使用 Name 字段替换 identifier）
      for (const req of requests) {
        if (req.salesRepId && userNameMap.has(req.salesRepId)) {
          req.salesRepName = userNameMap.get(req.salesRepId)
        }
      }
    }
    catch (e) {
      console.warn('Failed to load sales rep names:', e)
    }
  }

  // 查询请求类型名称（使用 Name 字段替换 identifier）
  const requestTypeIds = Array.from(new Set(requests.filter(r => r.requestTypeId && r.requestTypeId > 0).map(r => r.requestTypeId!)))
  if (requestTypeIds.length > 0) {
    try {
      const typeFilter = requestTypeIds.map(id => `R_RequestType_ID eq ${id}`).join(' or ')
      const typeRes = await apiFetch<{ records: any[] }>(
        `${API_V1}/models/R_RequestType`,
        {
          token,
          searchParams: {
            $select: 'R_RequestType_ID,Name',
            $filter: typeFilter,
          },
        },
      )

      const typeNameMap = new Map<number, string>()
      for (const type of typeRes.records ?? []) {
        const id = Number(type.id)
        const name = String(type.Name || '')
        if (id > 0 && name) {
          typeNameMap.set(id, name)
        }
      }

      // 更新请求中的类型名称（使用 Name 字段替换 identifier）
      for (const req of requests) {
        if (req.requestTypeId && typeNameMap.has(req.requestTypeId)) {
          req.requestTypeName = typeNameMap.get(req.requestTypeId)
        }
      }
    }
    catch (e) {
      console.warn('Failed to load request type names:', e)
    }
  }

  // 查询请求状态名称（使用 Name 字段替换 identifier）
  const requestStatusIds = Array.from(new Set(requests.filter(r => r.requestStatusId && r.requestStatusId > 0).map(r => r.requestStatusId!)))
  if (requestStatusIds.length > 0) {
    try {
      const statusFilter = requestStatusIds.map(id => `R_Status_ID eq ${id}`).join(' or ')
      const statusRes = await apiFetch<{ records: any[] }>(
        `${API_V1}/models/R_Status`,
        {
          token,
          searchParams: {
            $select: 'R_Status_ID,Name',
            $filter: statusFilter,
          },
        },
      )

      const statusNameMap = new Map<number, string>()
      for (const status of statusRes.records ?? []) {
        const id = Number(status.id)
        const name = String(status.Name || '')
        if (id > 0 && name) {
          statusNameMap.set(id, name)
        }
      }

      // 更新请求中的状态名称（使用 Name 字段替换 identifier）
      for (const req of requests) {
        if (req.requestStatusId && statusNameMap.has(req.requestStatusId)) {
          req.requestStatusName = statusNameMap.get(req.requestStatusId)
        }
      }
    }
    catch (e) {
      console.warn('Failed to load request status names:', e)
    }
  }

  return {
    records: requests,
    totalCount: res['row-count'] ?? requests.length,
  }
}

export async function getRequest(token: string, id: number): Promise<Request> {
  const r = await apiFetch<any>(`${API_V1}/models/R_Request/${id}`, {
    token,
    searchParams: {
      $select: 'R_Request_ID,Summary,Result,C_BPartner_ID,SalesRep_ID,R_RequestType_ID,R_Status_ID,StartDate,CloseDate,Created',
      $expand: 'C_BPartner_ID($select=C_BPartner_ID,Name),SalesRep_ID($select=AD_User_ID,Name),R_RequestType_ID($select=R_RequestType_ID,Name),R_Status_ID($select=R_Status_ID,Name)',
    },
  })

  const request: Request = {
    id: Number(r.id),
    name: r.Summary ? String(r.Summary) : undefined,
    description: r.Result ? String(r.Result) : undefined,
    bPartnerId: Number(r.C_BPartner_ID?.id ?? r.C_BPartner_ID ?? 0),
    bPartnerName: r.C_BPartner_ID?.name ? String(r.C_BPartner_ID.name) : (r.C_BPartner_ID?.identifier ? String(r.C_BPartner_ID.identifier) : undefined),
    salesRepId: r.SalesRep_ID?.id ? Number(r.SalesRep_ID.id) : undefined,
    salesRepName: r.SalesRep_ID?.name ? String(r.SalesRep_ID.name) : (r.SalesRep_ID?.identifier ? String(r.SalesRep_ID.identifier) : undefined),
    requestTypeId: r.R_RequestType_ID?.id ? Number(r.R_RequestType_ID.id) : undefined,
    requestTypeName: r.R_RequestType_ID?.name ? String(r.R_RequestType_ID.name) : (r.R_RequestType_ID?.identifier ? String(r.R_RequestType_ID.identifier) : undefined),
    requestStatusId: r.R_Status_ID?.id ? Number(r.R_Status_ID.id) : undefined,
    requestStatusName: r.R_Status_ID?.name ? String(r.R_Status_ID.name) : (r.R_Status_ID?.identifier ? String(r.R_Status_ID.identifier) : undefined),
    startDate: r.StartDate ? String(r.StartDate) : undefined,
    closeDate: r.CloseDate ? String(r.CloseDate) : undefined,
    created: String(r.Created),
  }

  // 查询客户名称（使用 Name 字段替换 identifier）
  if (request.bPartnerId > 0) {
    try {
      const bpRes = await apiFetch<any>(`${API_V1}/models/C_BPartner/${request.bPartnerId}`, {
        token,
        searchParams: {
          $select: 'C_BPartner_ID,Name',
        },
      })
      if (bpRes.Name) {
        request.bPartnerName = String(bpRes.Name)
      }
    }
    catch (e) {
      console.warn('Failed to load business partner name:', e)
    }
  }

  // 查询咨询师名称（使用 Name 字段替换 identifier）
  if (request.salesRepId) {
    try {
      const userRes = await apiFetch<any>(`${API_V1}/models/AD_User/${request.salesRepId}`, {
        token,
        searchParams: {
          $select: 'AD_User_ID,Name',
        },
      })
      if (userRes.Name) {
        request.salesRepName = String(userRes.Name)
      }
    }
    catch (e) {
      console.warn('Failed to load sales rep name:', e)
    }
  }

  // 查询请求类型名称（使用 Name 字段替换 identifier）
  if (request.requestTypeId) {
    try {
      const typeRes = await apiFetch<any>(`${API_V1}/models/R_RequestType/${request.requestTypeId}`, {
        token,
        searchParams: {
          $select: 'R_RequestType_ID,Name',
        },
      })
      if (typeRes.Name) {
        request.requestTypeName = String(typeRes.Name)
      }
    }
    catch (e) {
      console.warn('Failed to load request type name:', e)
    }
  }

  // 查询请求状态名称（使用 Name 字段替换 identifier）
  if (request.requestStatusId) {
    try {
      const statusRes = await apiFetch<any>(`${API_V1}/models/R_Status/${request.requestStatusId}`, {
        token,
        searchParams: {
          $select: 'R_Status_ID,Name',
        },
      })
      if (statusRes.Name) {
        request.requestStatusName = String(statusRes.Name)
      }
    }
    catch (e) {
      console.warn('Failed to load request status name:', e)
    }
  }

  return request
}

export async function createRequest(
  token: string,
  input: {
    bPartnerId: number
    salesRepId?: number
    name?: string
    description?: string
    requestTypeId?: number
    requestStatusId?: number
    startDate?: Date
    closeDate?: Date
  },
): Promise<any> {
  const toISO = (d: Date) => d.toISOString().replace(/\.\d{3}Z$/, 'Z')

  const json: Record<string, any> = {
    Summary: input.name,
    Result: input.description,
    C_BPartner_ID: input.bPartnerId,
    IsSelfService: true,
  }

  // SalesRep_ID 是必填欄位，不能為 null
  if (input.salesRepId !== undefined && input.salesRepId !== null) {
    json.SalesRep_ID = input.salesRepId
  }

  // 其他可選欄位
  if (input.requestTypeId !== undefined && input.requestTypeId !== null) {
    json.R_RequestType_ID = input.requestTypeId
  }
  if (input.requestStatusId !== undefined && input.requestStatusId !== null) {
    json.R_Status_ID = input.requestStatusId
  }
  if (input.startDate) {
    json.StartDate = toISO(input.startDate)
  }
  if (input.closeDate) {
    json.CloseDate = toISO(input.closeDate)
  }

  return await apiFetch<any>(`${API_V1}/models/R_Request`, {
    method: 'POST',
    token,
    json,
  })
}

/**
 * Create request from dynamic form data
 * Handles any field that might come from the dynamic form
 */
export async function createRequestFromDynamicForm(
  token: string,
  formData: Record<string, any>,
): Promise<any> {
  const toISO = (d: Date) => d.toISOString().replace(/\.\d{3}Z$/, 'Z')

  const json: Record<string, any> = {
    IsSelfService: true,
  }

  // Map all form fields to database columns
  for (const [key, value] of Object.entries(formData)) {
    // Skip empty values
    if (value === null || value === undefined || value === '') {
      continue
    }

    switch (key) {
      case 'C_BPartner_ID':
        json.C_BPartner_ID = value
        break
      case 'SalesRep_ID':
        json.SalesRep_ID = value
        break
      case 'Summary':
        json.Summary = value
        break
      case 'Result':
        json.Result = value
        break
      case 'R_RequestType_ID':
        json.R_RequestType_ID = value
        break
      case 'R_Status_ID':
        json.R_Status_ID = value
        break
      case 'StartDate':
        json.StartDate = value instanceof Date ? toISO(value) : value
        break
      case 'CloseDate':
        json.CloseDate = value instanceof Date ? toISO(value) : value
        break
      case 'DateNextAction':
        json.DateNextAction = value instanceof Date ? toISO(value) : value
        break
      case 'ConfidentialType':
      case 'Priority':
      case 'DueType':
        json[key] = value
        break
      default:
        // For any other fields, pass them through
        json[key] = value
        break
    }
  }

  return await apiFetch<any>(`${API_V1}/models/R_Request`, {
    method: 'POST',
    token,
    json,
  })
}

export async function updateRequest(
  token: string,
  id: number,
  input: {
    name?: string
    description?: string
    salesRepId?: number
    requestTypeId?: number
    requestStatusId?: number
    startDate?: Date
    closeDate?: Date
  },
): Promise<any> {
  const toISO = (d: Date) => d.toISOString().replace(/\.\d{3}Z$/, 'Z')

  const json: Record<string, any> = {}
  if (input.name !== undefined)
    json.Summary = input.name
  if (input.description !== undefined)
    json.Result = input.description
  if (input.salesRepId !== undefined)
    json.SalesRep_ID = input.salesRepId
  if (input.requestTypeId !== undefined)
    json.R_RequestType_ID = input.requestTypeId
  if (input.requestStatusId !== undefined)
    json.R_Status_ID = input.requestStatusId
  if (input.startDate !== undefined)
    json.StartDate = input.startDate ? toISO(input.startDate) : null
  if (input.closeDate !== undefined)
    json.CloseDate = input.closeDate ? toISO(input.closeDate) : null

  return await apiFetch<any>(`${API_V1}/models/R_Request/${id}`, {
    method: 'PUT',
    token,
    json,
  })
}

export async function updateRequestStatus(token: string, id: number, requestStatusId: number): Promise<any> {
  return await updateRequest(token, id, { requestStatusId })
}

export async function deleteRequest(token: string, id: number): Promise<void> {
  await apiFetch<any>(`${API_V1}/models/R_Request/${id}`, {
    method: 'DELETE',
    token,
  })
}

export async function listRequestTypes(token: string): Promise<RequestType[]> {
  const res = await apiFetch<{ records: any[] }>(
    `${API_V1}/models/R_RequestType`,
    {
      token,
      searchParams: {
        $select: 'R_RequestType_ID,Name',
        $orderby: 'Name',
      } satisfies SearchParams,
    },
  )

  return (res.records ?? []).map(r => ({
    id: Number(r.id),
    name: String(r.Name ?? ''),
  }))
}

export async function listRequestStatuses(token: string): Promise<RequestStatus[]> {
  const res = await apiFetch<{ records: any[] }>(
    `${API_V1}/models/R_Status`,
    {
      token,
      searchParams: {
        $select: 'R_Status_ID,Name,IsActive,SeqNo',
        $orderby: 'SeqNo,Name',
      } satisfies SearchParams,
    },
  )

  return (res.records ?? []).map(r => ({
    id: Number(r.id),
    name: String(r.Name ?? ''),
    isActive: Boolean(r.IsActive ?? true),
    seqNo: r.SeqNo ? Number(r.SeqNo) : undefined,
  }))
}

/**
 * 取得特定 Request Type 的可用狀態
 */
export async function getStatusesForRequestType(token: string, requestTypeId: number): Promise<RequestStatus[]> {
  try {
    // 在 iDempiere 中，R_RequestType 可能關聯到特定的狀態
    // 先嘗試獲取 Request Type 的資訊，看有沒有關聯的狀態
    const typeRes = await apiFetch<any>(`${API_V1}/models/R_RequestType/${requestTypeId}`, {
      token,
      searchParams: {
        $select: 'R_Status_ID,R_StatusCategory_ID',
      },
    })

    // 如果 Request Type 有關聯的預設狀態，返回該狀態
    if (typeRes.R_Status_ID?.id) {
      const defaultStatusId = Number(typeRes.R_Status_ID.id)
      const allStatuses = await listRequestStatuses(token)
      const defaultStatus = allStatuses.find(s => s.id === defaultStatusId)

      if (defaultStatus) {
        return [defaultStatus]
      }
    }

    // 如果沒有特定狀態關聯，返回所有狀態
    return await listRequestStatuses(token)
  }
  catch {
    // 如果獲取失敗，返回所有狀態作為後備
    return await listRequestStatuses(token)
  }
}

/**
 * 取得未分配諮詢師的諮詢單（SalesRep_ID 為空）
 */
export async function getUnassignedRequests(token: string): Promise<Request[]> {
  const allResult = await apiFetch<{ 'records': any[], 'row-count'?: number }>(
    `${API_V1}/models/R_Request`,
    {
      token,
      searchParams: {
        $select: 'R_Request_ID,Summary,Result,C_BPartner_ID,SalesRep_ID,R_RequestType_ID,R_Status_ID,StartDate,CloseDate,Created',
        $expand: 'C_BPartner_ID($select=C_BPartner_ID,Name),SalesRep_ID($select=AD_User_ID,Name),R_RequestType_ID($select=R_RequestType_ID,Name),R_Status_ID($select=R_Status_ID,Name)',
        $filter: 'SalesRep_ID eq null',
        $orderby: 'Created desc',
      },
    },
  )

  let requests: Request[] = (allResult.records ?? []).map(r => ({
    id: Number(r.id),
    name: r.Summary ? String(r.Summary) : undefined,
    description: r.Result ? String(r.Result) : undefined,
    bPartnerId: Number(r.C_BPartner_ID?.id ?? r.C_BPartner_ID ?? 0),
    bPartnerName: r.C_BPartner_ID?.name ? String(r.C_BPartner_ID.name) : (r.C_BPartner_ID?.identifier ? String(r.C_BPartner_ID.identifier) : undefined),
    salesRepId: r.SalesRep_ID?.id ? Number(r.SalesRep_ID.id) : undefined,
    salesRepName: r.SalesRep_ID?.name ? String(r.SalesRep_ID.name) : (r.SalesRep_ID?.identifier ? String(r.SalesRep_ID.identifier) : undefined),
    requestTypeId: r.R_RequestType_ID?.id ? Number(r.R_RequestType_ID.id) : undefined,
    requestTypeName: r.R_RequestType_ID?.name ? String(r.R_RequestType_ID.name) : (r.R_RequestType_ID?.identifier ? String(r.R_RequestType_ID.identifier) : undefined),
    requestStatusId: r.R_Status_ID?.id ? Number(r.R_Status_ID.id) : undefined,
    requestStatusName: r.R_Status_ID?.name ? String(r.R_Status_ID.name) : (r.R_Status_ID?.identifier ? String(r.R_Status_ID.identifier) : undefined),
    startDate: r.StartDate ? String(r.StartDate) : undefined,
    closeDate: r.CloseDate ? String(r.CloseDate) : undefined,
    created: String(r.Created),
  }))

  // 查询客户名称
  const bPartnerIds = Array.from(new Set(requests.filter(r => r.bPartnerId > 0).map(r => r.bPartnerId)))
  if (bPartnerIds.length > 0) {
    try {
      const bpFilter = bPartnerIds.map(id => `C_BPartner_ID eq ${id}`).join(' or ')
      const bpRes = await apiFetch<{ records: any[] }>(
        `${API_V1}/models/C_BPartner`,
        {
          token,
          searchParams: {
            $select: 'C_BPartner_ID,Name',
            $filter: bpFilter,
          },
        },
      )

      const bpNameMap = new Map<number, string>()
      for (const bp of bpRes.records ?? []) {
        const id = Number(bp.id)
        const name = String(bp.Name || '')
        if (id > 0 && name) {
          bpNameMap.set(id, name)
        }
      }

      for (const req of requests) {
        if (req.bPartnerId > 0 && bpNameMap.has(req.bPartnerId)) {
          req.bPartnerName = bpNameMap.get(req.bPartnerId)
        }
      }
    }
    catch (e) {
      console.warn('Failed to load business partner names:', e)
    }
  }

  return requests
}

/**
 * 取得待接應客戶（從未諮詢過的客戶）
 */
export async function getPendingCustomers(token: string): Promise<{ id: number, name: string }[]> {
  try {
    // 取得所有客戶
    const res = await apiFetch<{ records: any[] }>(
      `${API_V1}/models/C_BPartner`,
      {
        token,
        searchParams: {
          $select: 'C_BPartner_ID,Name',
          $filter: 'IsCustomer eq true and IsActive eq true',
          $orderby: 'Name',
        } satisfies SearchParams,
      },
    )

    const allCustomers = (res.records ?? []).map(r => ({
      id: Number(r.id),
      name: String(r.Name ?? ''),
    }))

    // 取得所有諮詢單，找出已有諮詢記錄的客戶ID
    const reqRes = await apiFetch<{ records: any[] }>(
      `${API_V1}/models/R_Request`,
      {
        token,
        searchParams: {
          $select: 'C_BPartner_ID',
        } satisfies SearchParams,
      },
    )

    const consultedCustomerIds = new Set<number>()
    for (const req of reqRes.records ?? []) {
      const bPartnerId = req.C_BPartner_ID?.id ? Number(req.C_BPartner_ID.id) : Number(req.C_BPartner_ID)
      if (bPartnerId > 0) {
        consultedCustomerIds.add(bPartnerId)
      }
    }

    // 過濾出從未諮詢過的客戶
    return allCustomers.filter(customer => !consultedCustomerIds.has(customer.id))
  }
  catch (error) {
    console.error('Failed to get pending customers:', error)
    return []
  }
}

/**
 * 取得「我的客戶」諮詢單（當前使用者的客戶）
 */
export async function getMyCustomersRequests(
  token: string,
  salesRepId: number,
): Promise<Request[]> {
  const result = await listRequests(token, { salesRepId })
  return result.records
}

/**
 * 取得某客戶的所有諮詢單
 */
export async function getRequestsByCustomer(token: string, bPartnerId: number): Promise<Request[]> {
  const result = await listRequests(token, { bPartnerId })
  return result.records
}

/**
 * 統計所有員工的諮詢單數量
 */
export async function getRequestStatistics(
  token: string,
): Promise<Map<number, { total: number, byType: Map<number, number>, byStatus: Map<number, number> }>> {
  try {
    const res = await apiFetch<{ records: any[] }>(
      `${API_V1}/models/R_Request`,
      {
        token,
        searchParams: {
          $select: 'R_Request_ID,SalesRep_ID,R_RequestType_ID,R_Status_ID',
        } satisfies SearchParams,
      },
    )

    const stats = new Map<number, { total: number, byType: Map<number, number>, byStatus: Map<number, number> }>()

    for (const r of res.records ?? []) {
      const salesRepId = r.SalesRep_ID?.id ? Number(r.SalesRep_ID.id) : 0
      const requestTypeId = r.R_RequestType_ID?.id ? Number(r.R_RequestType_ID.id) : 0
      const requestStatusId = r.R_Status_ID?.id ? Number(r.R_Status_ID.id) : 0

      if (!stats.has(salesRepId)) {
        stats.set(salesRepId, {
          total: 0,
          byType: new Map(),
          byStatus: new Map(),
        })
      }

      const stat = stats.get(salesRepId)!
      stat.total++

      if (requestTypeId > 0) {
        stat.byType.set(requestTypeId, (stat.byType.get(requestTypeId) || 0) + 1)
      }

      if (requestStatusId > 0) {
        stat.byStatus.set(requestStatusId, (stat.byStatus.get(requestStatusId) || 0) + 1)
      }
    }

    return stats
  }
  catch (error) {
    console.error('Failed to get request statistics:', error)
    return new Map()
  }
}
