import { useCallback } from 'react'
import { authApiBase, requestSession } from './session'
import { useRequest } from './useCatalogue'

export default function AccountStatus() {
  const load = useCallback(async (signal: AbortSignal) => requestSession(authApiBase(
    import.meta.env.VITE_CATALOGUE_API_URL || 'http://localhost:8080/api/catalogue',
    import.meta.env.VITE_AUTH_API_URL,
  ), signal), [])
  const { data, loading, error, retry } = useRequest('account', load)
  return <section className="catalogue-account" aria-label="Account status" aria-busy={loading}>
    <p role="status">{loading ? 'Checking account…' : error ? 'Account status unavailable.'
      : data ? `Signed in as ${data.email}` : 'Not signed in.'}</p>
    <small>Account pages pending.</small>
    <button type="button" onClick={retry} disabled={loading}>
      {error ? 'Retry account status' : 'Refresh account status'}
    </button>
  </section>
}
