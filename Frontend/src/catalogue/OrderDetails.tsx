import { formatPrice } from './search'

export type Order = {
  orderId: number; orderDate: string; orderStatus: string; totalAmount: number
  deliveryMode: string; deliveryCity: string | null; deliveryAddress: string | null
  estDeliveryDate: string | null; deliveryStatus: string | null
  paymentMethod: string; paymentStatus: string | null; cardType: string | null; cardLastFour: string | null
  items: { productName: string; productSku: string; variantName: string; colour: string | null
    memorySize: string | null; quantity: number; unitPrice: number }[]
}

function day(value: string | null): string {
  if (!value) return '—'
  const date = new Date(value.length === 10 ? `${value}T00:00:00` : value)
  return Number.isNaN(date.getTime()) ? value : new Intl.DateTimeFormat(undefined, { dateStyle: 'medium' }).format(date)
}

/** One order as the server recorded it: lines at the price paid, delivery and payment (UI-9, UI-10). */
export default function OrderDetails({ order }: { order: Order }) {
  const card = order.paymentMethod === 'card'
  return <article className="catalogue-order">
    <h2>Order #{order.orderId}</h2>
    <p>Placed {day(order.orderDate)} · {order.orderStatus} · Total {formatPrice(order.totalAmount)}</p>
    <table className="management-table">
      <thead><tr><th scope="col">Item</th><th scope="col">Quantity</th><th scope="col">Unit price</th><th scope="col">Line total</th></tr></thead>
      <tbody>{order.items.map((line, index) => <tr key={index}>
        <td><strong>{line.productName}</strong><br /><small>{[line.variantName, line.colour, line.memorySize].filter(Boolean).join(' · ')} · SKU {line.productSku}</small></td>
        <td>{line.quantity}</td><td>{formatPrice(line.unitPrice)}</td><td>{formatPrice(line.unitPrice * line.quantity)}</td>
      </tr>)}</tbody>
    </table>
    <p>{order.deliveryMode === 'pickup' ? 'Store pickup'
      : `Delivery to ${[order.deliveryAddress, order.deliveryCity].filter(Boolean).join(', ') || 'your address'} · Estimated ${day(order.estDeliveryDate)} · ${order.deliveryStatus ?? 'Pending'}`}</p>
    <p>Payment: {card ? `${order.cardType ?? 'Card'} ending ${order.cardLastFour ?? '••••'}` : 'Cash on delivery'} · {order.paymentStatus ?? 'Pending'}</p>
  </article>
}
