import { useEffect, useRef, useState } from 'react'
import type { FormEvent } from 'react'
import { ArrowLeft, ArrowRight, Check, CircleUserRound, CreditCard, Info, Lock, MapPin, Store, Truck, Wallet } from 'lucide-react'
import { motion } from 'framer-motion'
import { cartSnapshot, clearCart } from './cart'
import { readCard, testCards } from './card'
import { ApiError, apiBase, apiRequest } from './client'
import OrderDetails from './OrderDetails'
import type { Order } from './OrderDetails'
import { formatPrice } from './search'
import { requestSession } from './session'
import type { SessionUser } from './session'
import { backorderNote } from './variants'
import { Appear } from '../ui/motion'

type City = { cityId: number; name: string; isMainCity: boolean }
type Address = { addressLine: string | null; cityId: number | null }
type Refusal = { status?: string; unavailableVariantIds?: number[] }

function Steps({ current }: { current: 2 | 3 }) {
  const steps = ['Cart', 'Delivery and payment', 'Confirmation']
  return <ol className="store-steps" aria-label="Checkout progress">
    {steps.map((label, index) => {
      const number = index + 1
      const state = number < current ? 'done' : number === current ? 'current' : 'next'
      return <li key={label} className={state} aria-current={state === 'current' ? 'step' : undefined}>
        <span>{state === 'done' ? <Check aria-hidden="true" /> : number}</span>{label}
      </li>
    })}
  </ol>
}

export default function CheckoutView({ onBack }: { onBack: () => void }) {
  const [user, setUser] = useState<SessionUser | null>(null)
  const [ready, setReady] = useState(false)
  const [cities, setCities] = useState<City[]>([])
  const [mode, setMode] = useState('delivery')
  const [cityId, setCityId] = useState('')
  const [address, setAddress] = useState('')
  const [payment, setPayment] = useState('cod')
  const [estimate, setEstimate] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [orderId, setOrderId] = useState<number | null>(null)
  const [order, setOrder] = useState<Order | null>(null)
  const [snapshot] = useState(cartSnapshot)
  const submitting = useRef(false)
  const cart = snapshot.items
  const variantIds = cart.map(item => item.variantId).join(',')
  const quantities = cart.map(item => item.quantity).join(',')
  const backordered = cart.filter(item => backorderNote(item.quantity, item.stockQuantity))
  const units = cart.reduce((count, item) => count + item.quantity, 0)
  const subtotal = cart.reduce((sum, item) => sum + Number(item.price) * item.quantity, 0)

  useEffect(() => {
    const controller = new AbortController()
    const signal = controller.signal
    Promise.all([requestSession(apiBase('auth'), signal), apiRequest<City[]>(apiBase('delivery') + '/cities', { signal })])
      .then(async ([session, list]) => {
        setUser(session); setCities(list); setReady(true)
        if (session?.accountType !== 'CUSTOMER') return
        // Start from the address saved on the account; the customer can change it.
        const saved = await apiRequest<Address>(apiBase('addresses') + '/me', { signal }).catch(() => null)
        if (saved?.addressLine) setAddress(current => current || saved.addressLine!)
        if (saved?.cityId) setCityId(current => current || String(saved.cityId))
      })
      .catch(() => { if (!signal.aborted) { setError('Account or delivery service is unavailable.'); setReady(true) } })
    return () => controller.abort()
  }, [])

  // The date shown before ordering (UI-8): 5 or 7 days, plus 3 if a line asks for more than is in stock.
  useEffect(() => {
    if (mode !== 'delivery' || !cityId || !variantIds) return
    const controller = new AbortController()
    apiRequest<{ estimated_delivery_date: string }>(
      `${apiBase('delivery')}/preview?${new URLSearchParams({ cityId, variantIds, quantities })}`, { signal: controller.signal })
      .then(result => setEstimate(new Intl.DateTimeFormat(undefined, { dateStyle: 'full' })
        .format(new Date(`${result.estimated_delivery_date}T00:00:00`))))
      .catch(() => { if (!controller.signal.aborted) setEstimate('') })
    return () => { controller.abort(); setEstimate('') }
  }, [mode, cityId, variantIds, quantities])

  function refusalMessage(failure: unknown): string {
    if (!(failure instanceof ApiError)) return (failure as Error).message
    const refusal = (failure.body ?? {}) as Refusal
    const names = cart.filter(item => refusal.unavailableVariantIds?.includes(item.variantId))
      .map(item => `${item.productName} (${item.variantLabel})`).join(', ')
    switch (refusal.status) {
      case 'CARD_DECLINED': return 'Your card was declined, so no order was placed. Try another card or choose cash on delivery.'
      case 'INVALID_CARD': return 'The card details were not accepted. Check the number, expiry date and security code.'
      case 'PAYMENT_GATEWAY_UNAVAILABLE': return 'Card payments are unavailable right now. Choose cash on delivery or try again later.'
      case 'ITEM_UNAVAILABLE': return `${names || 'An item in your cart'} can no longer be ordered. Nothing was charged. Remove it from your cart and try again.`
      case 'AUTHORISED_AMOUNT_MISMATCH': return 'A price changed while you were paying. Nothing was charged. Review your cart and try again.'
      case 'INVALID_DELIVERY_ADDRESS': return 'Choose a city and enter your delivery address.'
      default: return failure.message
    }
  }

  async function checkout(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (submitting.current || orderId) return
    const delivery = mode === 'delivery'
    if (delivery && (!cityId || address.trim().length < 5)) { setError('Choose a city and enter your delivery address.'); return }
    const form = new FormData(event.currentTarget)
    const field = (name: string) => String(form.get(name) ?? '')
    const card = payment === 'card' ? readCard({
      number: field('cardNumber'), expiry: field('cardExpiry'), cvv: field('cardCvv'), holderName: field('cardName') }) : null
    if (typeof card === 'string') { setError(card); return }
    submitting.current = true; setBusy(true); setError('')
    try {
      const result = await apiRequest<{ status: string; orderId: number }>(apiBase('checkout'), { method: 'POST', body: JSON.stringify({
        cartItems: cart.map(item => ({ variantId: item.variantId, quantity: item.quantity })),
        deliveryMode: mode, paymentMethod: payment, cityId: delivery ? Number(cityId) : null,
        addressLine: delivery ? address.trim() : null, card,
      }) })
      if (result?.status !== 'SUCCESS' || !Number.isSafeInteger(result.orderId)) throw new Error('Invalid checkout response.')
      setOrderId(result.orderId)
      try { clearCart() } catch { setError('Order confirmed, but the browser could not clear your cart. Do not submit it again.') }
      // The confirmation shows what the server recorded, not what the browser asked for (UI-9).
      const orders = await apiRequest<Order[]>(apiBase('orders')).catch(() => [])
      setOrder(orders.find(candidate => candidate.orderId === result.orderId) ?? null)
    } catch (failure) { setError(refusalMessage(failure)) }
    finally { submitting.current = false; setBusy(false) }
  }

  if (orderId) return <section className="store-page store-narrow">
    <Steps current={3} />
    <div className="store-confirmed">
      <motion.span className="store-confirmed-mark" initial={{ scale: 0.4, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
        transition={{ type: 'spring', stiffness: 260, damping: 16 }}><Check aria-hidden="true" /></motion.span>
      <h1>Order #{orderId} confirmed</h1>
      <p>Thank you. A confirmation has been sent to your email address.</p>
    </div>
    {order ? <OrderDetails order={order} /> : !busy && <p className="bb-notice">Your total, payment and delivery date are in your order history.</p>}
    {error && <p className="bb-notice error" role="alert">{error}</p>}
    <p className="store-actions"><a className="bb-btn bb-btn-primary" href="?view=orders">View my orders</a> <a className="bb-btn" href="/catalogue.html">Continue shopping</a></p>
  </section>

  const blocked = !ready ? <p role="status" className="bb-muted">Checking account…</p>
    : user?.accountType !== 'CUSTOMER' ? <div className="store-empty bb-card"><CircleUserRound aria-hidden="true" />
      <h2>A customer account is required.</h2><p>Sign in or register to place your order. Your cart is kept.</p>
      <a className="bb-btn bb-btn-primary" href="/?view=login">Sign in or register</a></div>
    : cart.length === 0 ? <div className="store-empty bb-card"><h2>Your cart is empty.</h2><a className="bb-btn bb-btn-primary" href="/catalogue.html">Browse the catalogue</a></div>
    : null

  return <section className="store-page">
    <Steps current={2} />
    <header className="store-page-head">
      <h1>Checkout</h1>
      {user?.accountType === 'CUSTOMER' && <p><CircleUserRound aria-hidden="true" size={15} /> Ordering as <strong>{user.email}</strong></p>}
    </header>
    {blocked ?? <form className="store-split" onSubmit={checkout}>
      <div className="store-checkout-main">
        <section className="bb-card bb-card-pad" aria-labelledby="checkout-delivery">
          <div className="store-card-head"><h2 id="checkout-delivery"><Truck aria-hidden="true" />Delivery or pickup</h2></div>
          <div className="store-choice" role="radiogroup" aria-label="Fulfilment">
            <label className={mode === 'delivery' ? 'selected' : ''}><input type="radio" name="mode" value="delivery" checked={mode === 'delivery'} onChange={() => setMode('delivery')} />
              <span><strong>Standard delivery</strong><small>5 days to main Texas cities, 7 days to other cities</small></span><Truck aria-hidden="true" /></label>
            <label className={mode === 'pickup' ? 'selected' : ''}><input type="radio" name="mode" value="pickup" checked={mode === 'pickup'} onChange={() => setMode('pickup')} />
              <span><strong>Store pickup</strong><small>Collect your order at the store</small></span><Store aria-hidden="true" /></label>
          </div>
          <Appear show={mode === 'delivery'}>
            <div className="bb-form store-delivery-fields">
              <div className="bb-form-row">
                <label className="bb-field">City<select value={cityId} onChange={event => setCityId(event.target.value)} required={mode === 'delivery'}>
                  <option value="">Choose city</option>
                  {cities.map(city => <option key={city.cityId} value={city.cityId}>{city.name}{city.isMainCity ? ' (main city)' : ''}</option>)}</select></label>
                <label className="bb-field">Street address<input value={address} onChange={event => setAddress(event.target.value)} maxLength={255} required={mode === 'delivery'} autoComplete="street-address" /></label>
              </div>
              <p className="bb-notice" role="status"><MapPin aria-hidden="true" />{estimate ? `Estimated delivery: ${estimate}` : 'Choose a city to see the estimated delivery date.'}</p>
            </div>
          </Appear>
          {backordered.length > 0 && <p className="bb-notice warn" role="status"><Info aria-hidden="true" /><span>Out of stock now: {backordered.map(item => `${item.productName} (${item.variantLabel})`).join(', ')}.
            You can still order; what is missing is back-ordered and delivery takes 3 days longer.</span></p>}
        </section>

        <section className="bb-card bb-card-pad" aria-labelledby="checkout-payment">
          <div className="store-card-head"><h2 id="checkout-payment"><CreditCard aria-hidden="true" />Payment</h2></div>
          <div className="store-choice" role="radiogroup" aria-label="Payment">
            <label className={payment === 'cod' ? 'selected' : ''}><input type="radio" name="payment" value="cod" checked={payment === 'cod'} onChange={() => setPayment('cod')} />
              <span><strong>Cash on delivery</strong><small>Pay when your order arrives</small></span><Wallet aria-hidden="true" /></label>
            <label className={payment === 'card' ? 'selected' : ''}><input type="radio" name="payment" value="card" checked={payment === 'card'} onChange={() => setPayment('card')} />
              <span><strong>Card</strong><small>Visa, Mastercard or American Express</small></span><CreditCard aria-hidden="true" /></label>
          </div>
          <Appear show={payment === 'card'}>
            <fieldset className="store-card-fields bb-form">
              <legend className="bb-visually-hidden">Card details</legend>
              <p className="bb-notice"><Lock aria-hidden="true" /><span>Payments are simulated: no real card is charged. Test cards: {testCards.map(card => `${card.type} ${card.number}`).join(', ')}.
                Use any future expiry date and any security code. Card details are sent once to authorise the payment and are never stored.</span></p>
              <label className="bb-field">Name on card<input name="cardName" autoComplete="cc-name" maxLength={100} required={payment === 'card'} /></label>
              <label className="bb-field">Card number<input name="cardNumber" inputMode="numeric" autoComplete="cc-number" maxLength={23} required={payment === 'card'} /></label>
              <div className="bb-form-row">
                <label className="bb-field">Expiry (MM/YY)<input name="cardExpiry" inputMode="numeric" autoComplete="cc-exp" placeholder="MM/YY" maxLength={7} required={payment === 'card'} /></label>
                <label className="bb-field">Security code<input name="cardCvv" type="password" inputMode="numeric" autoComplete="cc-csc" maxLength={4} required={payment === 'card'} /></label>
              </div>
            </fieldset>
          </Appear>
        </section>
      </div>

      <aside className="bb-card bb-card-pad store-summary" aria-label="Order summary">
        <h2>Order summary</h2>
        <ul className="store-summary-lines">
          {cart.map(item => <li key={item.variantId}><span>{item.quantity} × {item.productName}<small>{item.variantLabel}</small></span>
            <span className="bb-num">{formatPrice(Number(item.price) * item.quantity)}</span></li>)}
        </ul>
        <dl>
          <div><dt>Items subtotal ({units})</dt><dd className="bb-num">{formatPrice(subtotal)}</dd></div>
          <div><dt>Delivery</dt><dd>No charge</dd></div>
          <div><dt>{mode === 'delivery' ? 'Estimated delivery' : 'Fulfilment'}</dt><dd>{mode === 'delivery' ? estimate || 'Choose a city' : 'Store pickup'}</dd></div>
          <div className="store-summary-total"><dt>Estimated total</dt><dd className="bb-num">{formatPrice(subtotal)}</dd></div>
        </dl>
        <p className="bb-hint">Prices and stock are checked again when you confirm.</p>
        {(error || snapshot.error) && <p className="bb-notice error" role="alert">{error || snapshot.error}</p>}
        <button className="bb-btn bb-btn-primary bb-btn-lg bb-btn-block" disabled={busy}>
          {busy ? 'Confirming…' : payment === 'card' ? 'Pay and place order' : 'Place order'}<ArrowRight aria-hidden="true" /></button>
        <button type="button" className="bb-btn bb-btn-ghost bb-btn-block" onClick={onBack} disabled={busy}><ArrowLeft aria-hidden="true" />Back to cart</button>
      </aside>
    </form>}
    {blocked && (error || snapshot.error) && <p className="bb-notice error" role="alert">{error || snapshot.error}</p>}
  </section>
}
