import { useState } from 'react'
import { Minus, Plus, ShoppingCart } from 'lucide-react'
import type { ProductVariant } from './api'
import { formatPrice } from './search'
import { backorderNote, maxOrderQuantity, parseLowStockThreshold, quantityError, stockLabel, variantLabel } from './variants'
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
  const error = quantityError(quantity)
  const backorder = error ? undefined : backorderNote(Number(quantity), selected.stock_quantity)
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
      <p className="catalogue-fine-print">{selected.stock_quantity} units in stock for this variant. Stock is checked again at checkout.</p>
    </div>
    <label htmlFor="catalogue-quantity">Quantity</label>
    <div className="catalogue-quantity-stepper">
      <button type="button" aria-label="One fewer"
        onClick={() => { setQuantity(String(Math.max(1, (parseInt(quantity, 10) || 1) - 1))); setFeedback(undefined) }}><Minus aria-hidden="true" /></button>
      <input id="catalogue-quantity" type="number" inputMode="numeric" min="1"
        max={maxOrderQuantity} step="1" value={quantity} aria-invalid={!!error}
        aria-describedby={error ? 'catalogue-quantity-error' : undefined}
        onChange={event => {
          setQuantity(event.target.value)
          setFeedback(undefined)
        }} />
      <button type="button" aria-label="One more"
        onClick={() => { setQuantity(String(Math.min(maxOrderQuantity, (parseInt(quantity, 10) || 0) + 1))); setFeedback(undefined) }}><Plus aria-hidden="true" /></button>
    </div>
    {error && <p id="catalogue-quantity-error" className="catalogue-field-error" role="alert">{error}</p>}
    {backorder && <p className="catalogue-backorder-note" role="status">{backorder}</p>}

    <p id="catalogue-cart-note" className="catalogue-fine-print">Your cart is kept for this browser session. Stock is not reserved until checkout.</p>
    <button type="button" className="bb-btn bb-btn-primary bb-btn-lg bb-btn-block" aria-describedby="catalogue-cart-note"
      disabled={!!error}
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
      Add to Cart<ShoppingCart aria-hidden="true" />
    </button>
    <p className={`catalogue-cart-result${feedback && !feedback.ok ? ' failed' : ''}`} role="status" aria-live="polite">{feedback?.message}</p>
  </div>
}
