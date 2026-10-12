import { useEffect, useState } from 'react'
import { ArrowRight, Minus, PackageOpen, Plus, ShieldCheck, Trash2, Truck } from 'lucide-react'
import { AnimatePresence, motion } from 'framer-motion'
import { cartSnapshot, clearCart, updateCartQuantity, removeFromCart } from './cart'
import { formatPrice } from './search'
import { backorderNote, maxOrderQuantity } from './variants'
import { PackageIcon } from './ProductImage'

export default function CartView({ onCheckout, onContinueShopping }: { onCheckout: () => void, onContinueShopping: () => void }) {
  const [snapshot, setSnapshot] = useState(cartSnapshot)
  const cart = snapshot.items
  const units = cart.reduce((count, item) => count + item.quantity, 0)
  const subtotal = cart.reduce((sum, item) => sum + Number(item.price) * item.quantity, 0)
  const notice = typeof sessionStorage !== 'undefined' ? sessionStorage.getItem('brightbuy_cart_notice') : ''

  useEffect(() => {
    const handleUpdate = () => setSnapshot(cartSnapshot())
    window.addEventListener('cart-updated', handleUpdate)
    return () => window.removeEventListener('cart-updated', handleUpdate)
  }, [])

  return <section className="store-page">
    <header className="store-page-head">
      <p className="bb-eyebrow">Step 1 of 3</p>
      <h1>Your shopping cart</h1>
      <p>Prices are in USD. Stock is not reserved until you place the order. An item that is out of stock can still be ordered: it is back-ordered and delivery takes 3 days longer.</p>
    </header>
    {snapshot.error && <div className="bb-notice error" role="alert"><p>{snapshot.error}</p><button className="bb-btn bb-btn-sm" onClick={() => clearCart()}>Clear unreadable cart</button></div>}
    <p role="status" className={notice ? 'bb-notice warn' : undefined}>{notice}</p>
    {cart.length === 0 ? <div className="store-empty bb-card">
      <PackageOpen aria-hidden="true" />
      <h2>Your cart is empty.</h2>
      <p>Browse the catalogue and add something you like.</p>
      <button onClick={onContinueShopping} className="bb-btn bb-btn-primary">Continue Shopping</button>
    </div> : <div className="store-split">
      <div className="bb-card store-cart-list">
        <div className="store-card-head"><h2>Items in your cart</h2><span className="bb-chip plain neutral">{units} {units === 1 ? 'item' : 'items'}</span></div>
        <ul>
          <AnimatePresence initial={false}>
            {cart.map(item => {
              const backorder = backorderNote(item.quantity, item.stockQuantity)
              return <motion.li key={item.variantId} layout initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, x: -24 }}>
                <div className="store-thumb"><PackageIcon /></div>
                <div className="store-cart-info">
                  <strong>{item.productName}</strong>
                  <small>{item.variantLabel}</small>
                  <span className={`bb-chip ${backorder ? 'warn' : 'ok'}`}>{backorder ? 'Back-order' : `${item.stockQuantity} in stock`}</span>
                  {backorder && <small className="store-cart-backorder">{backorder}</small>}
                </div>
                <div className="catalogue-quantity-stepper">
                  <button type="button" aria-label={`One fewer ${item.productName}`} onClick={() => updateCartQuantity(item.variantId, item.quantity - 1)}><Minus aria-hidden="true" /></button>
                  <input aria-label={`Quantity for ${item.productName}`} type="number" min="1" max={maxOrderQuantity} value={item.quantity}
                    onChange={event => updateCartQuantity(item.variantId, Number(event.target.value))} />
                  <button type="button" aria-label={`One more ${item.productName}`} onClick={() => updateCartQuantity(item.variantId, item.quantity + 1)}><Plus aria-hidden="true" /></button>
                </div>
                <div className="store-cart-price">
                  <strong className="bb-num">{formatPrice(parseFloat(item.price) * item.quantity)}</strong>
                  <small className="bb-num">{formatPrice(parseFloat(item.price))} each</small>
                </div>
                <button type="button" className="bb-icon-btn" aria-label={`Remove ${item.productName}`} onClick={() => removeFromCart(item.variantId)}><Trash2 aria-hidden="true" /></button>
              </motion.li>
            })}
          </AnimatePresence>
        </ul>
        <button onClick={onContinueShopping} className="bb-btn bb-btn-ghost">Continue Shopping</button>
      </div>
      <aside className="bb-card bb-card-pad store-summary" aria-label="Order summary">
        <h2>Order summary</h2>
        <dl>
          <div><dt>Items subtotal ({units})</dt><dd className="bb-num">{formatPrice(subtotal)}</dd></div>
          <div><dt>Delivery</dt><dd>No charge</dd></div>
          <div className="store-summary-total"><dt>Total</dt><dd className="bb-num">{formatPrice(subtotal)}</dd></div>
        </dl>
        <button onClick={onCheckout} className="bb-btn bb-btn-primary bb-btn-lg bb-btn-block">Proceed to Checkout<ArrowRight aria-hidden="true" /></button>
        <ul className="store-assurances">
          <li><Truck aria-hidden="true" /><span><strong>Delivery in 5 or 7 days</strong>Main Texas cities in 5 days, other cities in 7. Store pickup is also available.</span></li>
          <li><ShieldCheck aria-hidden="true" /><span><strong>Checked at checkout</strong>Prices and stock are confirmed by the server when you place the order.</span></li>
        </ul>
      </aside>
    </div>}
  </section>
}
