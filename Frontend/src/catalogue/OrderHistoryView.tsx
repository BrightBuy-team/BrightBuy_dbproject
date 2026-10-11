import { useEffect, useState } from 'react'
import { PackageSearch } from 'lucide-react'
import { apiBase, apiRequest } from './client'
import OrderDetails from './OrderDetails'
import type { Order } from './OrderDetails'
import { Stagger, StaggerItem } from '../ui/motion'

export default function OrderHistoryView() {
  const [orders, setOrders] = useState<Order[] | null>(null)
  const [error, setError] = useState('')
  useEffect(() => {
    const controller = new AbortController()
    apiRequest<Order[]>(apiBase('orders'), { signal: controller.signal })
      .then(setOrders).catch(failure => { if (!controller.signal.aborted) setError((failure as Error).message) })
    return () => controller.abort()
  }, [])
  return <section className="store-page">
    <header className="store-page-head">
      <p className="bb-eyebrow">Your account</p>
      <h1>My orders</h1>
      <p>Every order with the price you paid, its delivery estimate and its payment status.</p>
    </header>
    {error && <div className="bb-notice error" role="alert"><p>{error}</p>{error.includes('sign in') && <a className="bb-btn bb-btn-sm" href="/?view=login">Sign in</a>}</div>}
    {!orders && !error && <><p role="status" className="bb-muted">Loading orders…</p><div className="bb-skeleton store-order-skeleton" aria-hidden="true" /></>}
    {orders?.length === 0 && <div className="store-empty bb-card"><PackageSearch aria-hidden="true" /><h2>No orders yet.</h2>
      <p>When you place an order it appears here.</p><a className="bb-btn bb-btn-primary" href="/catalogue.html">Start shopping</a></div>}
    {orders && orders.length > 0 && <Stagger className="store-orders">{orders.map(order =>
      <StaggerItem key={order.orderId}><OrderDetails order={order} /></StaggerItem>)}</Stagger>}
    <p className="store-actions"><a className="bb-btn" href="?view=account">Delivery address</a><a className="bb-btn bb-btn-ghost" href="/catalogue.html">Back to catalogue</a></p>
  </section>
}
