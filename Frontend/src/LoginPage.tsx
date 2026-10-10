import { useEffect, useState } from 'react'
import type { FormEvent } from 'react'
import { customerCartKey, guestCartKey, readStoredCart } from './catalogue/cart'
import { mergeCartLines } from './catalogue/cartMerge'
import { ApiError, apiBase, apiRequest } from './catalogue/client'
import type { SessionUser } from './catalogue/session'
import './LoginPage.css'

type View = 'login' | 'register' | 'forgot' | 'reset'
type City = { cityId: number; name: string }

const titles: Record<View, string> = {
  login: 'Sign in', register: 'Create customer account', forgot: 'Reset your password', reset: 'Choose a new password',
}

/** The account API's own messages are written for customers; anything else gets the fallback. */
function accountMessage(failure: unknown, fallback: string): string {
  const body = failure instanceof ApiError ? failure.body : null
  return body && typeof body === 'object' && 'message' in body && typeof body.message === 'string' ? body.message : fallback
}

/** After sign-in the guest cart joins the customer's saved cart (AS-11). */
function adoptGuestCart(user: SessionUser) {
  if (user.accountType !== 'CUSTOMER') { localStorage.removeItem('currentUserEmail'); return }
  // The email only names the browser's cart storage; it is never used as authorisation.
  const key = customerCartKey(user.email)
  localStorage.setItem('currentUserEmail', user.email)
  try {
    const merged = mergeCartLines(readStoredCart(key), readStoredCart(guestCartKey))
    sessionStorage.setItem(key, JSON.stringify(merged.items))
    sessionStorage.removeItem(guestCartKey)
    if (merged.adjusted) sessionStorage.setItem('brightbuy_cart_notice', 'Combined cart quantities were capped to the last known stock. Review before checkout; stock is not reserved.')
    else sessionStorage.removeItem('brightbuy_cart_notice')
  } catch {
    sessionStorage.setItem('brightbuy_cart_notice', 'You are signed in, but your carts could not be combined. Guest items were retained. Review the saved cart before checkout.')
  }
}

function landingPage(user: SessionUser): string {
  if (user.accountType === 'CUSTOMER') return '/catalogue.html'
  if (user.role === 'Management') return '/catalogue.html?view=reports'
  return user.role === 'Admin' ? '/catalogue.html?view=admin' : '/inventory.html'
}

export default function LoginPage() {
  const [view, setView] = useState<View>('login')
  const [cities, setCities] = useState<City[]>([])
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [busy, setBusy] = useState(false)
  const auth = apiBase('auth')

  useEffect(() => {
    if (view !== 'register' || cities.length) return
    let current = true
    apiRequest<City[]>(apiBase('delivery') + '/cities').then(list => { if (current) setCities(list) }).catch(() => {})
    return () => { current = false }
  }, [view, cities.length])

  function show(next: View, message = '') { setView(next); setError(''); setNotice(message) }

  async function signIn(email: string, password: string, accountType: string) {
    const { user } = await apiRequest<{ user: SessionUser }>(auth + '/login', { method: 'POST',
      body: JSON.stringify({ email, password, accountType }) })
    adoptGuestCart(user)
    window.location.assign(landingPage(user))
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const data = new FormData(event.currentTarget)
    const field = (name: string) => String(data.get(name) ?? '').trim()
    const password = String(data.get('password') ?? '')
    if ((view === 'register' || view === 'reset') && password !== String(data.get('confirmPassword') ?? '')) {
      setError('The two passwords do not match.'); return
    }
    setBusy(true); setError(''); setNotice('')
    try {
      if (view === 'login') {
        await signIn(field('email'), password, field('accountType'))
      } else if (view === 'register') {
        await apiRequest(auth + '/register', { method: 'POST', body: JSON.stringify({
          firstName: field('firstName'), lastName: field('lastName'), email: field('email'), password,
          phone: field('phone') || null, addressLine: field('addressLine') || null,
          cityId: field('cityId') ? Number(field('cityId')) : null,
        }) })
        await signIn(field('email'), password, 'CUSTOMER')
      } else if (view === 'forgot') {
        const answer = await apiRequest<{ message: string }>(auth + '/password-reset/request', { method: 'POST',
          body: JSON.stringify({ email: field('email'), accountType: field('accountType') }) })
        show('reset', answer.message)
      } else {
        await apiRequest(auth + '/password-reset/confirm', { method: 'POST',
          body: JSON.stringify({ code: field('code'), newPassword: password }) })
        show('login', 'Your password has been changed. Sign in with the new password.')
      }
    } catch (failure) {
      setError(accountMessage(failure, {
        login: 'Sign-in failed. Check your credentials and account type.',
        register: 'Registration failed. Try another email or check your details.',
        forgot: 'The reset request could not be sent. Try again later.',
        reset: 'That code is invalid or has expired. Request a new one.',
      }[view]))
    } finally { setBusy(false) }
  }

  const accountType = <label>Account type<select name="accountType">
    <option value="CUSTOMER">Customer</option><option value="EMPLOYEE">Employee</option></select></label>
  const newPassword = <>
    <label>{view === 'reset' ? 'New password' : 'Password'} (8 or more characters)
      <input name="password" type="password" required minLength={8} maxLength={72} autoComplete="new-password" /></label>
    <label>Confirm password<input name="confirmPassword" type="password" required minLength={8} maxLength={72} autoComplete="new-password" /></label>
  </>

  return <main className="login-container">
    <section className="login-left">
      <div className="login-branding"><div className="login-logo-icon">b.</div><span className="login-logo-text">BrightBuy</span></div>
      <h1>{titles[view]}</h1><p>Good finds. Everyday possibilities.</p>
    </section>
    <section className="login-right"><div className="login-form-container">
      <h2 className="login-title">{titles[view]}</h2>
      {notice && <p role="status">{notice}</p>}
      <form className="login-form" key={view} onSubmit={submit}>
        {view === 'register' && <>
          <label>First name<input name="firstName" required maxLength={100} autoComplete="given-name" /></label>
          <label>Last name<input name="lastName" required maxLength={100} autoComplete="family-name" /></label>
        </>}
        {view !== 'reset' && <label>Email<input name="email" type="email" required autoComplete="username" maxLength={150} /></label>}
        {view === 'login' && <>
          <label>Password<input name="password" type="password" required maxLength={72} autoComplete="current-password" /></label>
          {accountType}
        </>}
        {view === 'register' && <>
          {newPassword}
          <label>Phone (optional)<input name="phone" type="tel" maxLength={20} autoComplete="tel" /></label>
          <label>Delivery address (optional)<input name="addressLine" maxLength={255} autoComplete="street-address" /></label>
          <label>City (optional)<select name="cityId"><option value="">Choose city</option>
            {cities.map(city => <option key={city.cityId} value={city.cityId}>{city.name}</option>)}</select></label>
        </>}
        {view === 'forgot' && <>
          {accountType}
          <p>We will email a one-time code that is valid for 30 minutes.</p>
        </>}
        {view === 'reset' && <>
          <label>Reset code from the email<input name="code" required minLength={32} maxLength={128} autoComplete="one-time-code" /></label>
          {newPassword}
        </>}
        {error && <p role="alert">{error}</p>}
        <button disabled={busy}>{busy ? 'Please wait…' : { login: 'Sign in', register: 'Register and sign in', forgot: 'Send reset code', reset: 'Change password' }[view]}</button>
      </form>
      {view === 'login' ? <>
        <button onClick={() => show('register')}>Create an account</button>
        <button onClick={() => show('forgot')}>Forgot your password?</button>
      </> : <button onClick={() => show('login')}>Back to sign in</button>}
      {view === 'forgot' && <button onClick={() => show('reset')}>I already have a code</button>}
      <p><a href="/catalogue.html">Browse without signing in</a></p>
    </div></section>
  </main>
}
