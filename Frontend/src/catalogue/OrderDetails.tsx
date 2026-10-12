import { CreditCard, MapPin, Store, Wallet } from 'lucide-react'
import { formatPrice } from './search'

export type Order = {
  orderId: number; orderDate: string; orderStatus: string; totalAmount: number
  deliveryMode: string; deliveryCity: string | null; deliveryAddress: string | null
  estDeliveryDate: string | null; deliveryStatus: string | null
  paymentMethod: string; paymentStatus: string | null; cardType: string | null; cardLastFour: string | null
  items: { productName: string; productSku: string; variantName: string; colour: string | null
    memorySize: string | null; quantity: number; backorderedQuantity: number; unitPrice: number }[]
}

function day(value: string | null): string {
  if (!value) return '—'
  const date = new Date(value.length === 10 ? `${value}T00:00:00` : value)
  return Number.isNaN(date.getTime()) ? value : new Intl.DateTimeFormat(undefined, { dateStyle: 'medium' }).format(date)
}

/** One order as the server recorded it: lines at the price paid, delivery and payment (UI-9, UI-10). */
export default function OrderDetails({ order }: { order: Order }) {
  const card = order.paymentMethod === 'card'
  const pickup = order.deliveryMode === 'pickup'
  const backordered = order.items.some(line => line.backorderedQuantity > 0)
  return <article className="bb-card store-order">
    <header className="store-order-head">
      <div><h2>Order #{order.orderId}</h2><p>Placed {day(order.orderDate)}</p></div>
      <div className="store-order-chips">
        <span className={`bb-chip ${order.orderStatus === 'Cancelled' ? 'danger' : ''}`}>{order.orderStatus}</span>
        {backordered && <span className="bb-chip warn">Back-order</span>}
        <strong className="bb-num">{formatPrice(order.totalAmount)}</strong>
      </div>
    </header>
    <div className="bb-table-wrap">
      <table className="bb-table">
        <thead><tr><th scope="col">Item</th><th scope="col">Quantity</th><th scope="col">Unit price</th><th scope="col">Line total</th></tr></thead>
        <tbody>{order.items.map((line, index) => <tr key={index}>
          <td><strong>{line.productName}</strong><br /><small>{[line.variantName, line.colour, line.memorySize].filter(value => value && value !== 'N/A').join(' · ')} · SKU {line.productSku}</small></td>
          <td className="bb-num">{line.quantity}{line.backorderedQuantity > 0 && <><br /><small>{line.backorderedQuantity} on back-order</small></>}</td>
          <td className="bb-num">{formatPrice(line.unitPrice)}</td><td className="bb-num">{formatPrice(line.unitPrice * line.quantity)}</td>
        </tr>)}</tbody>
      </table>
    </div>
    <div className="store-order-facts">
      <div>{pickup ? <Store aria-hidden="true" /> : <MapPin aria-hidden="true" />}
        <p><strong>{pickup ? 'Store pickup' : 'Delivery'}</strong>
          {pickup ? 'Collect it at the store' : `${[order.deliveryAddress, order.deliveryCity].filter(Boolean).join(', ') || 'Your address'} · Estimated ${day(order.estDeliveryDate)} · ${order.deliveryStatus ?? 'Pending'}`}</p></div>
      <div>{card ? <CreditCard aria-hidden="true" /> : <Wallet aria-hidden="true" />}
        <p><strong>Payment: {order.paymentStatus ?? 'Pending'}</strong>
          {card ? `${order.cardType ?? 'Card'} ending ${order.cardLastFour ?? '••••'}` : 'Cash on delivery'}</p></div>
    </div>
  </article>
}
