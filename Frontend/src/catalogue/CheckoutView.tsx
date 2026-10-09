import { useEffect, useState, useRef } from 'react'
import { cartSnapshot,clearCart } from './cart'
import { apiBase,apiRequest } from './client'
import { requestSession } from './session'
import type { SessionUser } from './session'
import { formatPrice } from './search'

type City = {cityId:number;name:string;isMainCity:boolean}
export default function CheckoutView({onBack}:{onBack:()=>void;onComplete?:()=>void}) {
 const [user,setUser]=useState<SessionUser|null>(null)
 const [ready,setReady]=useState(false)
 const [cities,setCities]=useState<City[]>([])
 const [cityId,setCityId]=useState('')
 const [address,setAddress]=useState('')
 const [mode,setMode]=useState('delivery')
 const [error,setError]=useState('')
 const [busy,setBusy]=useState(false)
 const [orderId,setOrderId]=useState<number|null>(null)
 const [snapshot]=useState(cartSnapshot)
 const submitting=useRef(false)
 useEffect(()=>{
  const controller=new AbortController()
  Promise.all([requestSession(apiBase('auth'),controller.signal),
   apiRequest<City[]>(apiBase('delivery')+'/cities',{signal:controller.signal})])
   .then(([session,list])=>{setUser(session);setCities(list);setReady(true)})
   .catch(()=>{if(!controller.signal.aborted){setError('Account or delivery service is unavailable.');setReady(true)}})
  return ()=>controller.abort()
 },[])
 const cart=snapshot.items
 async function checkout(){
  if(submitting.current||orderId)return
  if(mode==='delivery'&&(!cityId||address.trim().length<5)){setError('Choose a Texas city and enter your delivery address.');return}
  submitting.current=true;setBusy(true);setError('')
  try {
   const result=await apiRequest<{status:string;orderId:number}>(apiBase('checkout'),{method:'POST',body:JSON.stringify({
    cartItems:cart.map(i=>({variantId:i.variantId,quantity:i.quantity})),
    deliveryMode:mode,paymentMethod:'cod',cityId:mode==='delivery'?Number(cityId):null,
    addressLine:mode==='delivery'?address.trim():null
   })})
   if(result.status!=='SUCCESS'||!Number.isSafeInteger(result.orderId))throw new Error('Invalid checkout response.')
   setOrderId(result.orderId)
   try{clearCart()}catch{setError('Order confirmed, but the browser could not clear your cart. Do not submit it again.')}
  }catch(e){setError((e as Error).message)}
  finally{submitting.current=false;setBusy(false)}
 }
 if(orderId)return <section className="catalogue-detail-state"><h1>Order #{orderId} confirmed</h1>
  <p>Payment is pending: cash on delivery. Your server-confirmed total and delivery date are in your order history.</p>
  {error&&<p role="alert">{error}</p>}
  <a href="?view=orders">View my orders</a> · <a href="/catalogue.html">Continue shopping</a></section>
 return <section className="catalogue-detail-state"><h1>Checkout</h1>
  {!ready?<p role="status">Checking account…</p>:user?.accountType!=='CUSTOMER'?<p>A customer account is required. <a href="/?view=login">Sign in</a></p>
  :cart.length===0?<p>Your cart is empty.</p>:<>
   <p>Estimated subtotal: {formatPrice(cart.reduce((sum,i)=>sum+Number(i.price)*i.quantity,0))}. The database verifies prices and availability at confirmation.</p>
   <label>Fulfilment<select value={mode} onChange={e=>setMode(e.target.value)}><option value="delivery">Delivery</option><option value="pickup">Store pickup</option></select></label>
   {mode==='delivery'&&<><label>Texas city<select value={cityId} onChange={e=>setCityId(e.target.value)}><option value="">Choose city</option>
    {cities.map(c=><option key={c.cityId} value={c.cityId}>{c.name} — {c.isMainCity?5:7} days</option>)}</select></label>
    <label>Street address<textarea value={address} onChange={e=>setAddress(e.target.value)} maxLength={255}/></label></>}
   <p>Cash on delivery. Card checkout is disabled until the payment gateway is connected.</p>
   <button onClick={checkout} disabled={busy}>{busy?'Confirming…':'Confirm COD order'}</button>
  </>}
  {(error||snapshot.error)&&<p role="alert">{error||snapshot.error}</p>}<button onClick={onBack} disabled={busy}>Back to cart</button>
 </section>
}
