import { useCallback, useState } from 'react'
import { apiBase, apiRequest } from './client'
import { authApiBase, requestSession } from './session'
import { useRequest } from './useCatalogue'

/** The signed-in account, read from the server session. Never from browser storage. */
export function useSession() {
  const load = useCallback(async (signal: AbortSignal) => requestSession(authApiBase(
    import.meta.env.VITE_CATALOGUE_API_URL || 'http://localhost:8080/api/catalogue',
    import.meta.env.VITE_AUTH_API_URL,
  ), signal), [])
  return useRequest('account', load)
}

/** Ends the server session, then goes to the given page. */
export function useSignOut(after = '/catalogue.html') {
  const [signingOut, setSigningOut] = useState(false)
  const [error, setError] = useState('')
  async function signOut() {
    setSigningOut(true); setError('')
    try {
      await apiRequest(apiBase('auth') + '/logout', { method: 'POST' })
      localStorage.removeItem('currentUserEmail')
      window.location.assign(after)
    } catch { setError('Sign-out failed. Your session may still be active; please try again.'); setSigningOut(false) }
  }
  return { signOut, signingOut, error }
}
