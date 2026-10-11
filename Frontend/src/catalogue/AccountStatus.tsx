import { CircleUserRound, LogOut, RefreshCw } from 'lucide-react'
import type { SessionUser } from './session'
import { useSession, useSignOut } from './useSession'

export function AccountStatusView({ data, loading, error, retry, logout, signingOut }: {
  data?: SessionUser | null; loading: boolean; error?: string; retry: () => void;
  logout?: () => void; signingOut?: boolean
}) {
  return <section className="catalogue-account" aria-label="Account status" aria-busy={loading}>
    <CircleUserRound aria-hidden="true" />
    <p role="status">{loading ? 'Checking account…' : error ? 'Account status unavailable.'
      : data ? `Signed in as ${data.email}` : 'Not signed in.'}</p>
    {error && <button type="button" className="bb-icon-btn" onClick={retry} aria-label="Retry account status"><RefreshCw aria-hidden="true" /></button>}
    {!loading && !error && !data && <a className="bb-btn bb-btn-primary bb-btn-sm" href="/?view=login">Sign in</a>}
    {data && logout && <button type="button" className="bb-btn bb-btn-sm" onClick={logout} disabled={signingOut}>
      <LogOut aria-hidden="true" />{signingOut ? 'Signing out…' : 'Sign out'}</button>}
  </section>
}

export default function AccountStatus() {
  const { data, loading, error, retry } = useSession()
  const { signOut, signingOut, error: signOutError } = useSignOut()
  return <><AccountStatusView data={data} loading={loading} error={error} retry={retry} logout={signOut} signingOut={signingOut} />
    {signOutError && <p role="alert">{signOutError}</p>}</>
}
