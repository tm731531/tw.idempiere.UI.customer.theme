import type { Session } from './types'
import { computed, ref } from 'vue'

const STORAGE_KEY = 'idempiere.resource.session.v1'

const session = ref<Session | null>(null)

/**
 * Decode JWT token payload (without verification - for display only)
 */
function decodeJWT(token: string): Record<string, unknown> | null {
  try {
    const parts = token.split('.')
    if (parts.length !== 3)
      return null
    const payload = parts[1]
    const decoded = atob(payload.replace(/-/g, '+').replace(/_/g, '/'))
    return JSON.parse(decoded) as Record<string, unknown>
  }
  catch {
    return null
  }
}

export function useAuth() {
  const isAuthenticated = computed(() => !!session.value?.token)
  const token = computed(() => session.value?.token ?? null)
  const userId = computed(() => session.value?.userId ?? null)
  const userName = computed(() => {
    if (session.value?.userName)
      return session.value.userName
    if (!session.value?.token)
      return null
    const payload = decodeJWT(session.value.token)
    return (payload?.sub as string) ?? null
  })
  const clientId = computed(() => session.value?.clientId ?? null)
  const clientName = computed(() => session.value?.clientName ?? null)
  const organizationId = computed(() => session.value?.organizationId ?? null)
  const roleId = computed(() => session.value?.roleId ?? null)
  const roleName = computed(() => session.value?.roleName ?? null)
  const language = computed(() => session.value?.language ?? 'en_US')

  function load() {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw)
      return
    try {
      session.value = JSON.parse(raw) as Session
    }
    catch {
      localStorage.removeItem(STORAGE_KEY)
      session.value = null
    }
  }

  function set(next: Session) {
    session.value = next
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next))
  }

  function clear() {
    session.value = null
    localStorage.removeItem(STORAGE_KEY)
  }

  return {
    session,
    isAuthenticated,
    token,
    userId,
    userName,
    clientId,
    clientName,
    organizationId,
    roleId,
    roleName,
    language,
    load,
    set,
    clear,
  }
}
