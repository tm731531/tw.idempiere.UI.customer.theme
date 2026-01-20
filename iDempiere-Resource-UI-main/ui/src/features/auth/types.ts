export interface AuthParameters {
  clientId?: string | number
  roleId?: string | number
  organizationId?: string | number
  warehouseId?: string | number
  language?: string
}

export interface AuthRequest {
  userName: string
  password: string
  parameters?: AuthParameters
}

export interface ClientOption { id: number, name: string }
export interface NamedId { id: number, name: string }

export interface AuthResponse {
  clients?: ClientOption[]
  userId?: number
  language?: string
  menuTreeId?: number
  token?: string
  refresh_token?: string
}

export interface Session {
  token: string
  refreshToken?: string
  userId: number
  userName?: string // Decoded from JWT token
  clientId: number
  clientName?: string // Client name for display
  organizationId: number
  roleId?: number
  roleName?: string // Role name for display
  warehouseId?: number
  language?: string
}
