export type SessionUser = {
  id: number
  email: string
  accountType: 'CUSTOMER' | 'EMPLOYEE'
  role: string
}

// Derive auth from the same deployment as catalogue; never silently send cookies
// to a separate hardcoded deployment. Explicit overrides support agreed gateways.
export function authApiBase(catalogueBase: string, override?: string): string {
  const url = new URL(override?.trim() || catalogueBase)
  if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password || url.search || url.hash) {
    throw new Error('Invalid account API configuration.')
  }
  if (!override?.trim()) {
    if (!/\/catalogue\/?$/.test(url.pathname)) throw new Error('Configure the account API address.')
    url.pathname = url.pathname.replace(/\/catalogue\/?$/, '/auth')
  }
  return url.toString().replace(/\/$/, '')
}

export async function requestSession(base: string, signal: AbortSignal, timeoutMs = 10000): Promise<SessionUser | null> {
  const message = 'Account status is unavailable. Catalogue browsing still works.'
  try {
    const response = await fetch(`${base}/me`, {
      headers: { Accept: 'application/json' }, credentials: 'include',
      signal: AbortSignal.any([signal, AbortSignal.timeout(timeoutMs)]),
    })
    if (response.status === 401) return null
    if (!response.ok || !response.headers.get('content-type')?.includes('application/json')) throw new Error(message)
    const body: unknown = await response.json()
    const user = body && typeof body === 'object' && 'user' in body ? body.user : undefined
    if (!user || typeof user !== 'object' || !('id' in user) || !Number.isSafeInteger(user.id)
      || typeof user.id !== 'number' || user.id <= 0 || !('email' in user) || typeof user.email !== 'string'
      || !user.email.trim() || !('role' in user) || typeof user.role !== 'string' || !user.role.trim()
      || !('accountType' in user) || typeof user.accountType !== 'string'
      || !['CUSTOMER', 'EMPLOYEE'].includes(user.accountType)) throw new Error(message)
    return user as SessionUser
  } catch {
    // Do not expose SQL, proxy responses, or raw authentication errors.
    throw new Error(message)
  }
}
