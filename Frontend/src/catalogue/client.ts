import { authApiBase } from './session'
export const catalogueBase = import.meta.env.VITE_CATALOGUE_API_URL || 'http://localhost:8080/api/catalogue'
export function apiBase(module: string): string {
 const override: Record<string,string|undefined> = {
  auth: import.meta.env.VITE_AUTH_API_URL, checkout: import.meta.env.VITE_CHECKOUT_API_URL,
  reports: import.meta.env.VITE_REPORTS_API_URL, inventory: import.meta.env.VITE_INVENTORY_API_URL,
  delivery: import.meta.env.VITE_DELIVERY_API_URL,
 }
 const auth = authApiBase(catalogueBase, override.auth)
 return override[module]?.replace(/\/$/,'') || auth.replace(/\/auth$/, '/'+module)
}
export async function apiRequest<T>(url: string, init: RequestInit = {}): Promise<T> {
 const headers = new Headers(init.headers)
 headers.set('Accept','application/json')
 if(init.body) headers.set('Content-Type','application/json')
 if(init.method && !['GET','HEAD'].includes(init.method.toUpperCase())) {
  const tokenResponse = await fetch(apiBase('auth')+'/csrf',{credentials:'include',signal:AbortSignal.timeout(10000)})
  if(!tokenResponse.ok) throw new Error('Could not verify this request. Try signing in again.')
  const token = await tokenResponse.json() as {token:string}
  if(typeof token.token !== 'string') throw new Error('Invalid security response.')
  headers.set('X-XSRF-TOKEN',token.token)
 }
 const response = await fetch(url,{...init,headers,credentials:'include',signal:init.signal || AbortSignal.timeout(10000)})
 if(!response.ok) {
  if(response.status===401) throw new Error('Please sign in to continue.')
  if(response.status===403) throw new Error('Your account does not have permission for this action.')
  if(response.status===409) throw new Error('Stock or records changed. Refresh and try again.')
  if(response.status===503) throw new Error('This service is temporarily unavailable. Please try again later.')
  throw new Error('Request failed. Check your entries and try again.')
 }
 if(response.status===204 || !response.headers.get('content-type')?.includes('application/json')) return undefined as T
 return response.json() as Promise<T>
}
