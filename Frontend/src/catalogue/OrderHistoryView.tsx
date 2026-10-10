import { useEffect, useState } from 'react'
import { apiBase, apiRequest } from './client'
import OrderDetails from './OrderDetails'
import type { Order } from './OrderDetails'

export default function OrderHistoryView() {
  const [orders, setOrders] = useState<Order[] | null>(null)
  const [error, setError] = useState('')
  useEffect(() => {
    const controller = new AbortController()
    apiRequest<Order[]>(apiBase('orders'), { signal: controller.signal })
      .then(setOrders).catch(failure => { if (!controller.signal.aborted) setError((failure as Error).message) })
    return () => controller.abort()
  }, [])
  return <section className="catalogue-detail-state">
    <h1>My orders</h1>
    {error && <p role="alert">{error}</p>}
    {!orders && !error && <p role="status">Loading orders…</p>}
    {orders?.length === 0 && <p>No orders yet.</p>}
    {orders?.map(order => <OrderDetails key={order.orderId} order={order} />)}
    <a href="/catalogue.html">Back to catalogue</a>
  </section>
}
