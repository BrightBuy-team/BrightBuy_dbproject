import { useState } from 'react'
import type { ProductVariant } from './api'
import { formatPrice } from './search'
import { parseLowStockThreshold, quantityError, stockLabel, variantLabel } from './variants'

const configuredThreshold = parseLowStockThreshold(import.meta.env.VITE_CATALOGUE_LOW_STOCK_THRESHOLD)

export default function VariantSelection({ variants, lowStockThreshold = configuredThreshold }: {
  variants: ProductVariant[]
  lowStockThreshold?: number
}) {
  const [selectedId, setSelectedId] = useState(variants[0]?.variant_id)
  const [quantity, setQuantity] = useState('1')
  const selected = variants.find(variant => variant.variant_id === selectedId) ?? variants[0]
  if (!selected) return <p role="status">No variants are available.</p>
  const error = quantityError(quantity, selected.stock_quantity)
  const label = stockLabel(selected.stock_quantity, lowStockThreshold)

  const [checkoutStatus, setCheckoutStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  const [checkoutMessage, setCheckoutMessage] = useState('');

  async function handleCheckout() {
    setCheckoutStatus('loading');
    setCheckoutMessage('');
    try {
      const response = await fetch('https://brightbuy-2026-gecbh9e5e4c0f8ar.eastasia-01.azurewebsites.net/api/checkout', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          customerId: 1, // Using a hardcoded test customer ID
          cartItems: [
            {
              variantId: selected.variant_id,
              quantity: Number(quantity)
            }
          ]
        })
      });

      const message = await response.text();
      if (response.ok) {
        setCheckoutStatus('success');
        setCheckoutMessage(message);
      } else {
        setCheckoutStatus('error');
        setCheckoutMessage(message);
      }
    } catch (err) {
      setCheckoutStatus('error');
      setCheckoutMessage('Failed to connect to the server.');
    }
  }

  return <div className="catalogue-variant-selection">
    {variants.length > 1 ? <>
      <label htmlFor="catalogue-variant">Choose a variant</label>
      <select id="catalogue-variant" value={selected.variant_id} onChange={event => {
        setSelectedId(Number(event.target.value))
        setQuantity('1')
        setCheckoutStatus('idle')
      }}>
        {variants.map(variant => <option key={variant.variant_id} value={variant.variant_id}>
          {variantLabel(variant)} — {stockLabel(variant.stock_quantity, lowStockThreshold)}
        </option>)}
      </select>
    </> : <p className="catalogue-default-variant">Default variant: {variantLabel(selected)}</p>}
    <div aria-live="polite" aria-atomic="true">
      <p className={`catalogue-detail-stock ${selected.stock_quantity === 0 ? 'unavailable' : label === 'Low Stock' ? 'low' : ''}`}>{label}</p>
      <p className="catalogue-detail-price">{formatPrice(selected.price)}</p>
      <p className="catalogue-fine-print">{selected.stock_quantity} units available for this variant. Stock is confirmed again at checkout.</p>
    </div>
    <label htmlFor="catalogue-quantity">Quantity</label>
    <input id="catalogue-quantity" type="number" inputMode="numeric" min="1"
      max={Math.max(1, selected.stock_quantity)} step="1" value={quantity}
      disabled={selected.stock_quantity === 0} aria-invalid={selected.stock_quantity > 0 && !!error}
      aria-describedby={error ? 'catalogue-quantity-error' : undefined}
      onChange={event => {
        setQuantity(event.target.value)
        setCheckoutStatus('idle')
      }} />
    {error && <p id="catalogue-quantity-error" className="catalogue-field-error" role="alert">{error}</p>}
    
    <button 
      type="button" 
      className="catalogue-primary" 
      disabled={selected.stock_quantity === 0 || !!error || checkoutStatus === 'loading'} 
      onClick={handleCheckout}
    >
      {checkoutStatus === 'loading' ? 'Processing...' : 'Buy Now'}
    </button>
    
    {checkoutStatus === 'success' && <p className="catalogue-fine-print" style={{color: 'green', fontWeight: 'bold', marginTop: '10px'}}>✅ {checkoutMessage}</p>}
    {checkoutStatus === 'error' && <p className="catalogue-field-error" role="alert" style={{marginTop: '10px'}}>❌ {checkoutMessage}</p>}
  </div>
}
