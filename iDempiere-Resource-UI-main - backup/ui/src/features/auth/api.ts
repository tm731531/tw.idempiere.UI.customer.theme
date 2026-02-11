import type { AuthParameters, AuthRequest, AuthResponse, NamedId } from './types'
import { apiFetch } from '../../shared/api/http'

const API_V1 = '/api/v1'

export async function login(request: AuthRequest): Promise<AuthResponse> {
  return await apiFetch<AuthResponse>(`${API_V1}/auth/tokens`, {
    method: 'POST',
    json: request,
  })
}

export async function setLoginParameters(params: AuthParameters, token: string): Promise<AuthResponse> {
  return await apiFetch<AuthResponse>(`${API_V1}/auth/tokens`, {
    method: 'PUT',
    token,
    json: params,
  })
}

export async function getRoles(clientId: number, token: string): Promise<NamedId[]> {
  const res = await apiFetch<{ roles: NamedId[] }>(`${API_V1}/auth/roles`, { token, searchParams: { client: clientId } })
  return res.roles ?? []
}

export async function getOrganizations(clientId: number, roleId: number, token: string): Promise<NamedId[]> {
  const res = await apiFetch<{ organizations: NamedId[] }>(`${API_V1}/auth/organizations`, { token, searchParams: { client: clientId, role: roleId } })
  return res.organizations ?? []
}

export async function getWarehouses(
  clientId: number,
  roleId: number,
  organizationId: number,
  token: string,
): Promise<NamedId[]> {
  const res = await apiFetch<{ warehouses: NamedId[] }>(`${API_V1}/auth/warehouses`, {
    token,
    searchParams: { client: clientId, role: roleId, organization: organizationId },
  })
  return res.warehouses ?? []
}

export async function getClientLanguage(clientId: number, token: string): Promise<{ language: string }> {
  return await apiFetch<{ language: string }>(`${API_V1}/auth/language`, { token, searchParams: { client: clientId } })
}
