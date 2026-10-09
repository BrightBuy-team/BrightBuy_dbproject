import { useState } from 'react'
import type { ProductVariant } from './api'
import { formatPrice } from './search'
import { parseLowStockThreshold, quantityError, stockLabel, variantLabel } from './variants'
import { addCatalogueItem } from './cartHandoff'

const configuredThreshold = parseLowStockThreshold(import.meta.env.VITE_CATALOGUE_LOW_STOCK_THRESHOLD)

export default function VariantSelection({ variants, productId, productName, lowStockThreshold = configuredThreshold }: {
  variants: ProductVariant[]
  productId: number
  productName: string
  lowStockThreshold?: number
}) {
  const [selectedId, setSelectedId] = useState(variants[0]?.variant_id)
  const [quantity, setQuantity] = useState('1')
  const [feedback, setFeedback] = useState<{ ok: boolean; message: string }>()
  const selected = variants.find(variant => variant.variant_id === selectedId) ?? variants[0]
  if (!selected) return <p role="status">No variants are available.</p>
  const error = quantityError(quantity, selected.stock_quantity)
  const label = stockLabel(selected.stock_quantity, lowStockThreshold)

  return <div className="catalogue-variant-selection">
    {variants.length > 1 ? <>
      <label htmlFor="catalogue-variant">Choose a variant</label>
      <select id="catalogue-variant" value={selected.variant_id} onChange={event => {
        setSelectedId(Number(event.target.value))
        setQuantity('1')
        setFeedback(undefined)
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
        setFeedback(undefined)
      }} />
    {error && <p id="catalogue-quantity-error" className="catalogue-field-error" role="alert">{error}</p>}
    
    <p id="catalogue-cart-note" className="catalogue-fine-print">Your cart is kept for this browser session. Stock is not reserved until checkout.</p>
    <button type="button" className="catalogue-primary" aria-describedby="catalogue-cart-note"
      disabled={selected.stock_quantity === 0 || !!error}
      onClick={() => {
        setFeedback(addCatalogueItem({
          productId,
          variantId: selected.variant_id,
          productName,
          variantLabel: variantLabel(selected),
          price: selected.price.toString(),
          quantity: parseInt(quantity, 10),
          stockQuantity: selected.stock_quantity
        }))
      }}>
      Add to Cart
    </button>
    <p className={`catalogue-cart-result${feedback && !feedback.ok ? ' failed' : ''}`} role="status" aria-live="polite">{feedback?.message}</p>
  </div>
}
