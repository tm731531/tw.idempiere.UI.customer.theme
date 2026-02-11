import ky, { HTTPError } from 'ky'

export interface ApiError {
  status: number
  title?: string
  detail?: string
  raw?: unknown
  isTokenExpired?: boolean
}

// Callback for token expiration - set by app initialization
let onTokenExpired: (() => void) | null = null

export function setTokenExpiredHandler(handler: () => void) {
  onTokenExpired = handler
}

async function safeReadBody(res: Response): Promise<unknown> {
  try {
    // Many endpoints return JSON; if not JSON, fallback to text
    return await res.clone().json()
  }
  catch {
    try {
      const text = await res.text()
      return text || null
    }
    catch {
      return null
    }
  }
}

export async function apiFetch<T>(
  path: string,
  options: {
    method?: string
    token?: string
    searchParams?: Record<string, string | number | boolean | undefined>
    json?: unknown
  } = {},
): Promise<T> {
  const { token, method, searchParams, json } = options

  // Filter out undefined values from searchParams
  const cleanSearchParams: Record<string, string | number | boolean> = {}
  if (searchParams) {
    for (const [k, v] of Object.entries(searchParams)) {
      if (v !== undefined) {
        cleanSearchParams[k] = v
      }
    }
  }

  try {
    return await ky(path, {
      method,
      searchParams: Object.keys(cleanSearchParams).length > 0 ? cleanSearchParams : undefined,
      json,
      headers: token ? { Authorization: `Bearer ${token}` } : undefined,
    }).json<T>()
  }
  catch (e: any) {
    if (e instanceof HTTPError) {
      const body = await safeReadBody(e.response)
      const err: ApiError = { status: e.response.status, raw: body }
      if (body && typeof body === 'object') {
        const b = body as any
        err.title = b.title
        err.detail = b.detail
      }

      // Check for token expiration or invalid token (any 401)
      if (err.status === 401) {
        err.isTokenExpired = true
        if (onTokenExpired) {
          onTokenExpired()
        }
      }

      throw err
    }
    throw e
  }
}
