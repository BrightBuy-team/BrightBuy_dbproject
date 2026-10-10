import { authApiBase } from './session'

export const catalogueBase = import.meta.env.VITE_CATALOGUE_API_URL || 'http://localhost:8080/api/catalogue'

/** The base address of one backend module, such as 'checkout' or 'inventory'. */
export function apiBase(module: string): string {
  const override: Record<string, string | undefined> = {
    auth: import.meta.env.VITE_AUTH_API_URL, checkout: import.meta.env.VITE_CHECKOUT_API_URL,
    reports: import.meta.env.VITE_REPORTS_API_URL, inventory: import.meta.env.VITE_INVENTORY_API_URL,
    delivery: import.meta.env.VITE_DELIVERY_API_URL,
  }
  const auth = authApiBase(catalogueBase, override.auth)
  return override[module]?.replace(/\/$/, '') || auth.replace(/\/auth$/, '/' + module)
}

/**
 * A refused request. The message is always safe to show. `body` is the server's JSON
 * answer when it sent one, so a page can read a status code from it; it is never text
 * from an error page.
 */
export class ApiError extends Error {
  readonly status: number
  readonly body: unknown
  constructor(message: string, status: number, body: unknown) {
    super(message)
    this.name = 'ApiError'
    this.status = status
    this.body = body
  }
}

function messageFor(status: number): string {
  if (status === 401) return 'Please sign in to continue.'
  if (status === 403) return 'Your account does not have permission for this action.'
  if (status === 404) return 'That record was not found. Refresh and try again.'
  if (status === 409) return 'Stock or records changed. Refresh and try again.'
  if (status === 503) return 'This service is temporarily unavailable. Please try again later.'
  return 'Request failed. Check your entries and try again.'
}

/** Sends a request with the session cookie, and with a fresh CSRF token for anything that writes. */
export async function apiRequest<T>(url: string, init: RequestInit = {}): Promise<T> {
  const headers = new Headers(init.headers)
  headers.set('Accept', 'application/json')
  if (init.body) headers.set('Content-Type', 'application/json')
  if (init.method && !['GET', 'HEAD'].includes(init.method.toUpperCase())) {
    const tokenResponse = await fetch(apiBase('auth') + '/csrf', { credentials: 'include', signal: AbortSignal.timeout(10000) })
    if (!tokenResponse.ok) throw new Error('Could not verify this request. Try signing in again.')
    const token = await tokenResponse.json() as { token: string }
    if (typeof token.token !== 'string') throw new Error('Invalid security response.')
    headers.set('X-XSRF-TOKEN', token.token)
  }
  const response = await fetch(url, { ...init, headers, credentials: 'include', signal: init.signal || AbortSignal.timeout(15000) })
  const json = response.headers.get('content-type')?.includes('json')
  if (!response.ok) {
    throw new ApiError(messageFor(response.status), response.status, json ? await response.json().catch(() => null) : null)
  }
  if (response.status === 204 || !json) return undefined as T
  return response.json() as Promise<T>
}
