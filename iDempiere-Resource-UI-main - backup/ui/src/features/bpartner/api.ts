import { apiFetch } from '../../shared/api/http'

const API_V1 = '/api/v1'

type SearchParams = Record<string, string | number | boolean | undefined>

export interface BPartner {
  id: number
  name: string
  value?: string
  bpGroupId?: number
  bpGroupName?: string
  isCustomer?: boolean
  isVendor?: boolean
  isEmployee?: boolean
}

export interface BPartnerGroup {
  id: number
  name: string
}

export interface BPartnerContact {
  id: number
  bPartnerId: number
  name?: string
  email?: string
  phone?: string
}

export interface BPartnerLocation {
  id: number
  bPartnerId: number
  address1?: string
  city?: string
  postalCode?: string
}

export async function listBPartners(token: string): Promise<BPartner[]> {
  const res = await apiFetch<{ records: any[] }>(
    `${API_V1}/models/C_BPartner`,
    {
      token,
      searchParams: {
        $select: 'C_BPartner_ID,Name,Value,C_BP_Group_ID,IsCustomer,IsVendor,IsEmployee',
        $orderby: 'Name',
      } satisfies SearchParams,
    },
  )

  return (res.records ?? []).map(r => ({
    id: Number(r.id),
    name: String(r.Name ?? ''),
    value: r.Value ? String(r.Value) : undefined,
    bpGroupId: r.C_BP_Group_ID?.id ? Number(r.C_BP_Group_ID.id) : undefined,
    bpGroupName: r.C_BP_Group_ID?.name ? String(r.C_BP_Group_ID.name) : undefined,
    isCustomer: r.IsCustomer === true || r.IsCustomer === 'Y',
    isVendor: r.IsVendor === true || r.IsVendor === 'Y',
    isEmployee: r.IsEmployee === true || r.IsEmployee === 'Y',
  }))
}

export async function getBPartner(token: string, id: number): Promise<BPartner> {
  const res = await apiFetch<any>(`${API_V1}/models/C_BPartner/${id}`, {
    token,
  })
  return {
    id: Number(res.id),
    name: String(res.Name ?? ''),
    value: res.Value ? String(res.Value) : undefined,
    bpGroupId: res.C_BP_Group_ID?.id ? Number(res.C_BP_Group_ID.id) : undefined,
    bpGroupName: res.C_BP_Group_ID?.name ? String(res.C_BP_Group_ID.name) : undefined,
    isCustomer: res.IsCustomer === true || res.IsCustomer === 'Y',
    isVendor: res.IsVendor === true || res.IsVendor === 'Y',
    isEmployee: res.IsEmployee === true || res.IsEmployee === 'Y',
  }
}

export async function createBPartner(
  token: string,
  input: {
    name: string
    value?: string
    bpGroupId?: number
    isCustomer?: boolean
    isVendor?: boolean
    isEmployee?: boolean
  },
): Promise<any> {
  return await apiFetch<any>(`${API_V1}/models/C_BPartner`, {
    method: 'POST',
    token,
    json: {
      Name: input.name,
      Value: input.value || null,
      C_BP_Group_ID: input.bpGroupId || null,
      IsCustomer: input.isCustomer ?? true,
      IsVendor: input.isVendor ?? false,
      IsEmployee: input.isEmployee ?? false,
      IsSummary: false,
    },
  })
}

export async function updateBPartner(
  token: string,
  id: number,
  input: {
    name?: string
    value?: string
    bpGroupId?: number
    isCustomer?: boolean
    isVendor?: boolean
    isEmployee?: boolean
  },
): Promise<any> {
  const json: Record<string, any> = {}
  if (input.name !== undefined)
    json.Name = input.name
  if (input.value !== undefined)
    json.Value = input.value
  if (input.bpGroupId !== undefined)
    json.C_BP_Group_ID = input.bpGroupId
  if (input.isCustomer !== undefined)
    json.IsCustomer = input.isCustomer
  if (input.isVendor !== undefined)
    json.IsVendor = input.isVendor
  if (input.isEmployee !== undefined)
    json.IsEmployee = input.isEmployee

  return await apiFetch<any>(`${API_V1}/models/C_BPartner/${id}`, {
    method: 'PUT',
    token,
    json,
  })
}

export async function deleteBPartner(token: string, id: number): Promise<void> {
  await apiFetch<any>(`${API_V1}/models/C_BPartner/${id}`, {
    method: 'DELETE',
    token,
  })
}

export async function listBPartnerGroups(token: string): Promise<BPartnerGroup[]> {
  const res = await apiFetch<{ records: any[] }>(
    `${API_V1}/models/C_BP_Group`,
    {
      token,
      searchParams: {
        $select: 'C_BP_Group_ID,Name',
        $orderby: 'Name',
      } satisfies SearchParams,
    },
  )

  return (res.records ?? []).map(r => ({
    id: Number(r.id),
    name: String(r.Name ?? ''),
  }))
}

export async function createBPartnerContact(
  token: string,
  input: {
    bPartnerId: number
    name?: string
    email?: string
    phone?: string
  },
): Promise<any> {
  return await apiFetch<any>(`${API_V1}/models/AD_User`, {
    method: 'POST',
    token,
    json: {
      C_BPartner_ID: input.bPartnerId,
      Name: input.name || '',
      Email: input.email || null,
      Phone: input.phone || null,
      IsActive: true,
    },
  })
}

export async function listBPartnerLocations(token: string, bPartnerId: number): Promise<BPartnerLocation[]> {
  const res = await apiFetch<{ records: any[] }>(
    `${API_V1}/models/C_BPartner_Location`,
    {
      token,
      searchParams: {
        $select: 'C_BPartner_Location_ID,C_BPartner_ID,C_Location_ID',
        $filter: `C_BPartner_ID eq ${bPartnerId} and IsActive eq true`,
        $expand: 'C_Location_ID($select=C_Location_ID,Address1,City,Postal)',
        $orderby: 'C_BPartner_Location_ID',
      } satisfies SearchParams,
    },
  )

  return (res.records ?? []).map(r => ({
    id: Number(r.id),
    bPartnerId: Number(r.C_BPartner_ID?.id ?? r.C_BPartner_ID ?? 0),
    address1: r.C_Location_ID?.Address1 ? String(r.C_Location_ID.Address1) : undefined,
    city: r.C_Location_ID?.City ? String(r.C_Location_ID.City) : undefined,
    postalCode: r.C_Location_ID?.Postal ? String(r.C_Location_ID.Postal) : undefined,
  }))
}

export async function createBPartnerLocation(
  token: string,
  input: {
    bPartnerId: number
    address1?: string
    city?: string
    postalCode?: string
  },
): Promise<any> {
  const locationRes = await apiFetch<any>(`${API_V1}/models/C_Location`, {
    method: 'POST',
    token,
    json: {
      Address1: input.address1 || '',
      City: input.city || '',
      Postal: input.postalCode || null,
    },
  })

  const locationId = locationRes.id || locationRes.C_Location_ID

  return await apiFetch<any>(`${API_V1}/models/C_BPartner_Location`, {
    method: 'POST',
    token,
    json: {
      C_BPartner_ID: input.bPartnerId,
      C_Location_ID: locationId,
      IsActive: true,
    },
  })
}
