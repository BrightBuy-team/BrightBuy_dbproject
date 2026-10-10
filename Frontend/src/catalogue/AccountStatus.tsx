import { useCallback, useState } from 'react'
import { authApiBase, requestSession } from './session'
import { useRequest } from './useCatalogue'
import { apiBase, apiRequest } from './client'
import type { SessionUser } from './session'

export function AccountStatusView({ data, loading, error, retry, logout, signingOut }: {
  data?: SessionUser | null; loading: boolean; error?: string; retry: () => void;
  logout?: () => void; signingOut?: boolean
}) {
  return <section className="catalogue-account" aria-label="Account status" aria-busy={loading}>
    <p role="status">{loading ? 'Checking account…' : error ? 'Account status unavailable.'
      : data ? `Signed in as ${data.email}` : 'Not signed in.'}</p>
    <button type="button" onClick={retry} disabled={loading}>
      {error ? 'Retry account status' : 'Refresh account status'}
    </button>
    {data && logout && <button onClick={logout} disabled={signingOut}>{signingOut?'Signing out…':'Sign out'}</button>}
  </section>
}

export default function AccountStatus() {
  const [signingOut,setSigningOut]=useState(false)
  const [logoutError,setLogoutError]=useState('')
  const load = useCallback(async (signal: AbortSignal) => requestSession(authApiBase(
    import.meta.env.VITE_CATALOGUE_API_URL || 'http://localhost:8080/api/catalogue',
    import.meta.env.VITE_AUTH_API_URL,
  ), signal), [])
  const { data, loading, error, retry } = useRequest('account', load)
  async function logout(){
    setSigningOut(true);setLogoutError('')
    try{
      await apiRequest(apiBase('auth')+'/logout',{method:'POST'})
      localStorage.removeItem('currentUserEmail');localStorage.removeItem('role')
      window.location.assign('/catalogue.html')
    }catch{setLogoutError('Sign-out failed. Your session may still be active; please try again.');setSigningOut(false)}
  }
  return <><AccountStatusView data={data} loading={loading} error={error} retry={retry} logout={logout} signingOut={signingOut}/>
    {logoutError&&<p role="alert">{logoutError}</p>}</>
}
