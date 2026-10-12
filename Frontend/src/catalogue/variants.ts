import type { ProductVariant } from './api'

// TBD-5 must be agreed by the team. Unset/invalid configuration never guesses.
export function parseLowStockThreshold(value: string | undefined): number | undefined {
  if (!value || !/^\d+$/.test(value)) return undefined
  const threshold = Number(value)
  return Number.isSafeInteger(threshold) && threshold > 0 ? threshold : undefined
}

export function stockLabel(stock: number, threshold?: number): string {
  if (stock === 0) return 'Out of Stock'
  if (threshold !== undefined && Number.isSafeInteger(threshold) && threshold > 0 && stock <= threshold) return 'Low Stock'
  return 'In Stock'
}

export function variantLabel(variant: ProductVariant): string {
  const attributes = [variant.colour, variant.memory_size].filter(value => value?.trim() && value !== 'N/A')
  return [variant.variant_name?.trim() || `Variant ${variant.variant_id}`, ...attributes].join(' · ')
}

// The most units of one item in one order. An assumption of this project:
// the brief sets no limit, and a limit keeps a typing slip from becoming an order.
export const maxOrderQuantity = 100

export function quantityError(value: string): string | undefined {
  if (!/^\d+$/.test(value) || !Number.isSafeInteger(Number(value)) || Number(value) < 1) {
    return 'Enter a whole-number quantity of at least 1.'
  }
  if (Number(value) > maxOrderQuantity) return `You can order at most ${maxOrderQuantity} units of one item.`
  return undefined
}

/**
 * What to tell the customer when they ask for more than is in stock. The item can still be
 * ordered: the shortfall is back-ordered and delivery takes three days longer.
 */
export function backorderNote(quantity: number, stock: number): string | undefined {
  if (!Number.isSafeInteger(quantity) || quantity <= stock) return undefined
  const delay = 'Delivery takes 3 days longer.'
  if (stock <= 0) return `Out of stock. You can still order it and it will be sent when it arrives. ${delay}`
  const short = quantity - stock
  return `Only ${stock} in stock: the other ${short} ${short === 1 ? 'unit is' : 'units are'} back-ordered. ${delay}`
}
