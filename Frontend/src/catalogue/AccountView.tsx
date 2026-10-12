import { useEffect, useState } from 'react'
import type { FormEvent } from 'react'
import { CheckCircle2, MapPin } from 'lucide-react'
import { apiBase, apiRequest } from './client'
import { Appear } from '../ui/motion'

type City = { cityId: number; name: string }
type Address = { addressLine: string | null; cityId: number | null }

/** The customer's saved delivery address, used to start each checkout. */
export default function AccountView() {
  const [cities, setCities] = useState<City[]>([])
  const [address, setAddress] = useState<Address | null>(null)
  const [error, setError] = useState('')
  const [saved, setSaved] = useState(false)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    const controller = new AbortController()
    Promise.all([apiRequest<Address>(apiBase('addresses') + '/me', { signal: controller.signal }),
      apiRequest<City[]>(apiBase('delivery') + '/cities', { signal: controller.signal })])
      .then(([current, list]) => { setAddress(current); setCities(list) })
      .catch(failure => { if (!controller.signal.aborted) setError((failure as Error).message) })
    return () => controller.abort()
  }, [])

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const data = new FormData(event.currentTarget)
    setBusy(true); setError(''); setSaved(false)
    try {
      await apiRequest(apiBase('addresses') + '/me', { method: 'PUT', body: JSON.stringify({
        addressLine: String(data.get('addressLine') ?? '').trim(), cityId: Number(data.get('cityId')) }) })
      setSaved(true)
    } catch (failure) { setError((failure as Error).message) }
    finally { setBusy(false) }
  }

  return <section className="store-page store-narrow">
    <header className="store-page-head">
      <p className="bb-eyebrow">Your account</p>
      <h1>Delivery address</h1>
      <p>Checkout starts from this address. You can still change it for a single order.</p>
    </header>
    {error && <div className="bb-notice error" role="alert"><p>{error}</p>{error.includes('sign in') && <a className="bb-btn bb-btn-sm" href="/?view=login">Sign in</a>}</div>}
    {!address && !error && <p role="status" className="bb-muted">Loading your address…</p>}
    {address && <form className="bb-card bb-card-pad bb-form" onSubmit={save}>
      <label className="bb-field">Street address<textarea name="addressLine" required minLength={5} maxLength={255} defaultValue={address.addressLine ?? ''} /></label>
      <label className="bb-field">City<select name="cityId" required defaultValue={address.cityId ?? ''}>
        <option value="">Choose city</option>
        {cities.map(city => <option key={city.cityId} value={city.cityId}>{city.name}</option>)}</select>
        <span className="bb-hint"><MapPin aria-hidden="true" size={13} /> Delivery is available to these Texas cities.</span></label>
      <Appear show={saved}><p className="bb-notice" role="status"><CheckCircle2 aria-hidden="true" />Your address is saved.</p></Appear>
      <div><button className="bb-btn bb-btn-primary" disabled={busy}>{busy ? 'Saving…' : 'Save address'}</button></div>
    </form>}
    <p><a className="bb-btn bb-btn-ghost" href="?view=orders">My orders</a> <a className="bb-btn bb-btn-ghost" href="/catalogue.html">Back to catalogue</a></p>
  </section>
}
