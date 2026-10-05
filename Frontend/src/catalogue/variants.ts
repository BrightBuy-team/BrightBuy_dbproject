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

export function quantityError(value: string, stock: number): string | undefined {
  if (stock === 0) return 'This variant is out of stock.'
  if (!/^\d+$/.test(value) || !Number.isSafeInteger(Number(value)) || Number(value) < 1) {
    return 'Enter a whole-number quantity of at least 1.'
  }
  if (Number(value) > stock) return `Only ${stock} units are currently available.`
  return undefined
}
