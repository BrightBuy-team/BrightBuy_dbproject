import { useEffect, useRef, useState } from 'react'
import type { FormEvent } from 'react'
import { cartSnapshot, clearCart } from './cart'
import { readCard, testCards } from './card'
import { ApiError, apiBase, apiRequest } from './client'
import OrderDetails from './OrderDetails'
import type { Order } from './OrderDetails'
import { formatPrice } from './search'
import { requestSession } from './session'
import type { SessionUser } from './session'

type City = { cityId: number; name: string; isMainCity: boolean }
type Address = { addressLine: string | null; cityId: number | null }
type Refusal = { status?: string; unavailableVariantIds?: number[] }

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
  const units = cart.reduce((count, item) => count + item.quantity, 0)

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

  // The date shown before ordering (UI-8): 5 or 7 days, plus 3 if anything is out of stock.
  useEffect(() => {
    if (mode !== 'delivery' || !cityId || !variantIds) return
    const controller = new AbortController()
    apiRequest<{ estimated_delivery_date: string }>(
      `${apiBase('delivery')}/preview?${new URLSearchParams({ cityId, variantIds })}`, { signal: controller.signal })
      .then(result => setEstimate(new Intl.DateTimeFormat(undefined, { dateStyle: 'full' })
        .format(new Date(`${result.estimated_delivery_date}T00:00:00`))))
      .catch(() => { if (!controller.signal.aborted) setEstimate('') })
    return () => { controller.abort(); setEstimate('') }
  }, [mode, cityId, variantIds])

  function refusalMessage(failure: unknown): string {
    if (!(failure instanceof ApiError)) return (failure as Error).message
    const refusal = (failure.body ?? {}) as Refusal
    const names = cart.filter(item => refusal.unavailableVariantIds?.includes(item.variantId))
      .map(item => `${item.productName} (${item.variantLabel})`).join(', ')
    switch (refusal.status) {
      case 'CARD_DECLINED': return 'Your card was declined, so no order was placed. Try another card or choose cash on delivery.'
      case 'INVALID_CARD': return 'The card details were not accepted. Check the number, expiry date and security code.'
      case 'PAYMENT_GATEWAY_UNAVAILABLE': return 'Card payments are unavailable right now. Choose cash on delivery or try again later.'
      case 'INSUFFICIENT_STOCK': return `There is no longer enough stock${names ? ` for ${names}` : ''}. Nothing was charged. Lower the quantity in your cart and try again.`
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

  if (orderId) return <section className="catalogue-detail-state">
    <h1>Order #{orderId} confirmed</h1>
    <p>Thank you. A confirmation has been sent to your email address.</p>
    {order ? <OrderDetails order={order} /> : !busy && <p>Your total, payment and delivery date are in your order history.</p>}
    {error && <p role="alert">{error}</p>}
    <a href="?view=orders">View my orders</a> · <a href="/catalogue.html">Continue shopping</a>
  </section>

  return <section className="catalogue-detail-state">
    <h1>Checkout</h1>
    {!ready ? <p role="status">Checking account…</p>
      : user?.accountType !== 'CUSTOMER' ? <p>A customer account is required. <a href="/?view=login">Sign in or register</a> — your cart is kept.</p>
      : cart.length === 0 ? <p>Your cart is empty.</p>
      : <form className="catalogue-form" onSubmit={checkout}>
        <p>{units} {units === 1 ? 'item' : 'items'} · Estimated total {formatPrice(cart.reduce((sum, item) => sum + Number(item.price) * item.quantity, 0))}.
          Prices and stock are checked again when you confirm.</p>
        <label>Fulfilment<select value={mode} onChange={event => setMode(event.target.value)}>
          <option value="delivery">Delivery</option><option value="pickup">Store pickup</option></select></label>
        {mode === 'delivery' && <>
          <label>City<select value={cityId} onChange={event => setCityId(event.target.value)} required>
            <option value="">Choose city</option>
            {cities.map(city => <option key={city.cityId} value={city.cityId}>{city.name}</option>)}</select></label>
          <label>Street address<textarea value={address} onChange={event => setAddress(event.target.value)} maxLength={255} required /></label>
          <p role="status">{estimate ? `Estimated delivery: ${estimate}` : 'Choose a city to see the estimated delivery date.'}</p>
        </>}
        <label>Payment<select value={payment} onChange={event => setPayment(event.target.value)}>
          <option value="cod">Cash on delivery</option><option value="card">Card</option></select></label>
        {payment === 'card' && <fieldset>
          <legend>Card details</legend>
          <p>Payments are simulated: no real card is charged. Test cards: {testCards.map(card => `${card.type} ${card.number}`).join(', ')}.
            Use any future expiry date and any security code. Card details are sent once to authorise the payment and are never stored.</p>
          <label>Card number<input name="cardNumber" inputMode="numeric" autoComplete="cc-number" maxLength={23} required /></label>
          <label>Expiry (MM/YY)<input name="cardExpiry" inputMode="numeric" autoComplete="cc-exp" placeholder="MM/YY" maxLength={7} required /></label>
          <label>Security code<input name="cardCvv" type="password" inputMode="numeric" autoComplete="cc-csc" maxLength={4} required /></label>
          <label>Name on card<input name="cardName" autoComplete="cc-name" maxLength={100} required /></label>
        </fieldset>}
        <button className="catalogue-primary" disabled={busy}>{busy ? 'Confirming…' : payment === 'card' ? 'Pay and place order' : 'Place order'}</button>
      </form>}
    {(error || snapshot.error) && <p role="alert">{error || snapshot.error}</p>}
    <button onClick={onBack} disabled={busy}>Back to cart</button>
  </section>
}
