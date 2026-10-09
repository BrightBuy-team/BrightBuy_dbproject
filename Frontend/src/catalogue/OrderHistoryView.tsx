import { useEffect,useState } from 'react'
import { apiBase,apiRequest } from './client'
import { formatPrice } from './search'
type Order={orderId:number;orderDate:string;orderStatus:string;totalAmount:number;paymentStatus:string;estDeliveryDate?:string}
export default function OrderHistoryView(){
 const [orders,setOrders]=useState<Order[]|null>(null)
 const [error,setError]=useState('')
 useEffect(()=>{const c=new AbortController();apiRequest<Order[]>(apiBase('orders'),{signal:c.signal})
  .then(setOrders).catch(e=>{if(!c.signal.aborted)setError((e as Error).message)});return()=>c.abort()},[])
 return <section className="catalogue-detail-state"><h1>My orders</h1>{error&&<p role="alert">{error}</p>}
  {!orders&&!error&&<p role="status">Loading orders…</p>}
  {orders?.length===0&&<p>No orders yet.</p>}
  {orders?.map(o=><article key={o.orderId}><h2>Order #{o.orderId}</h2><p>{o.orderStatus} · {formatPrice(o.totalAmount)}</p>
   <p>Payment: {o.paymentStatus||'Pending'} · Estimated delivery: {o.estDeliveryDate||'Pickup / not applicable'}</p></article>)}
  <a href="/catalogue.html">Back to catalogue</a></section>
}
