import { useEffect, useState } from 'react'
import type { FormEvent } from 'react'
import { CalendarCheck, MapPin, PackageSearch, Store, Truck } from 'lucide-react'
import { motion } from 'framer-motion'
import { apiBase, apiRequest } from '../catalogue/client'
import Logo from '../ui/Logo'
import { Appear, MotionRoot } from '../ui/motion'

// Matches the backend's City record.
type City = { cityId: number; name: string; isMainCity: boolean }
type Estimate = { est_delivery_date: string | null; delivery_mode: string; delivery_status?: string | null }
type Result = { pickup: boolean; date: string; status: string }

export default function DeliveryApp() {
  const [cities, setCities] = useState<City[]>([])
  const [cityId, setCityId] = useState('')
  const [orderId, setOrderId] = useState('')
  const [result, setResult] = useState<Result | null>(null)
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    const controller = new AbortController()
    apiRequest<City[]>(apiBase('delivery') + '/cities', { signal: controller.signal })
      .then(list => { setCities(list); if (list.length) setCityId(String(list[0].cityId)) })
      .catch(failure => { if (!controller.signal.aborted) setError(failure instanceof Error ? failure.message : 'The delivery service is unavailable.') })
      .finally(() => { if (!controller.signal.aborted) setLoading(false) })
    return () => controller.abort()
  }, [])

  async function lookUp(event: FormEvent) {
    event.preventDefault()
    if (!cityId || !orderId) { setError('Enter an order ID and choose the destination city.'); return }
    setBusy(true); setResult(null); setError('')
    try {
      const data = await apiRequest<Estimate>(`${apiBase('delivery')}/estimate?${new URLSearchParams({ cityId, orderId })}`)
      if (data.delivery_mode === 'pickup') { setResult({ pickup: true, date: '', status: data.delivery_status ?? 'Pending' }); return }
      if (!data.est_delivery_date) throw new Error('No delivery date has been recorded for this order.')
      const date = new Date(data.est_delivery_date.slice(0, 10) + 'T00:00:00')
      if (Number.isNaN(date.getTime())) throw new Error('Invalid delivery date returned.')
      setResult({ pickup: false, status: data.delivery_status ?? 'Pending',
        date: date.toLocaleDateString(undefined, { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' }) })
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : 'The estimate could not be loaded.')
    } finally { setBusy(false) }
  }

  return <MotionRoot><div className="delivery-page">
    <header className="delivery-header"><div className="bb-container">
      <Logo href="/catalogue.html" />
      <nav aria-label="Site navigation"><a href="/catalogue.html">Shop</a><a href="/catalogue.html?view=orders">My orders</a></nav>
    </div></header>
    <main className="bb-container">
      <motion.section className="bb-card delivery-card" initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }}>
        <span className="delivery-icon"><Truck aria-hidden="true" /></span>
        <p className="bb-eyebrow">Delivery</p>
        <h1>Track a delivery</h1>
        <p className="bb-muted">See the delivery estimate recorded for one of your orders. Sign in first; you can only look up your own orders.</p>
        {loading ? <p role="status" className="bb-muted">Loading delivery cities…</p> : <form className="bb-form" onSubmit={lookUp}>
          <div className="bb-form-row">
            <label className="bb-field">Order ID<input type="number" min={1} placeholder="For example 101" value={orderId} onChange={event => setOrderId(event.target.value)} required />
              <span className="bb-hint"><PackageSearch aria-hidden="true" size={13} /> Shown on your order confirmation and under My orders.</span></label>
            <label className="bb-field">Destination city<select value={cityId} onChange={event => setCityId(event.target.value)} required>
              {cities.map(city => <option key={city.cityId} value={city.cityId}>{city.name}{city.isMainCity ? ' (main city, 5 days)' : ' (7 days)'}</option>)}</select>
              <span className="bb-hint"><MapPin aria-hidden="true" size={13} /> Must be the city the order is going to.</span></label>
          </div>
          <div><button type="submit" className="bb-btn bb-btn-primary bb-btn-lg" disabled={busy}>{busy ? 'Looking up…' : 'Show delivery estimate'}</button></div>
        </form>}
        <Appear show={!!error}><p className="bb-notice error" role="alert">{error}</p></Appear>
        <Appear show={!!result}>{result && <div className="delivery-result" role="status">
          {result.pickup ? <Store aria-hidden="true" /> : <CalendarCheck aria-hidden="true" />}
          <div><p className="bb-eyebrow">{result.pickup ? 'Store pickup' : 'Estimated delivery date'}</p>
            <strong>{result.pickup ? 'Collect this order at the store' : result.date}</strong>
            <p className="bb-muted">{result.pickup ? 'City-based delivery dates do not apply to pickup orders.' : 'Recorded when the order was placed.'} Status: {result.status}.</p></div>
        </div>}</Appear>
      </motion.section>
    </main>
  </div></MotionRoot>
}
