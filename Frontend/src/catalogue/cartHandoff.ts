import { addToCart, getCart } from './cart.ts'
import type { CartItem } from './cart.ts'

type CartBridge = { read: () => unknown; add: (item: CartItem) => void }
const sharedCart: CartBridge = { read: getCart, add: addToCart }

// Use the checkout owner's cart and storage keys; validate its display snapshots
// at the catalogue boundary without creating a second cart or reserving stock.
export function decodeCatalogueCart(value: unknown): CartItem[] | undefined {
  if (!Array.isArray(value) || value.length > 100) return undefined
  const seen = new Set<number>()
  const lines: CartItem[] = []
  for (const item of value) {
    if (!item || typeof item !== 'object'
      || !Number.isSafeInteger(item.productId) || item.productId <= 0
      || !Number.isSafeInteger(item.variantId) || item.variantId <= 0 || seen.has(item.variantId)
      || typeof item.productName !== 'string' || !item.productName.trim()
      || typeof item.variantLabel !== 'string' || !item.variantLabel.trim()
      || typeof item.price !== 'string' || !/^\d+(\.\d{1,2})?$/.test(item.price) || !Number.isFinite(Number(item.price))
      || !Number.isSafeInteger(item.quantity) || item.quantity <= 0
      || !Number.isSafeInteger(item.stockQuantity) || item.stockQuantity < item.quantity) return undefined
    seen.add(item.variantId)
    lines.push({ productId: item.productId, variantId: item.variantId, productName: item.productName,
      variantLabel: item.variantLabel, price: item.price, quantity: item.quantity, stockQuantity: item.stockQuantity })
  }
  return lines
}

export function catalogueCartQuantity(bridge = sharedCart): number {
  try { return (decodeCatalogueCart(bridge.read()) ?? []).reduce((total, item) => total + item.quantity, 0) }
  catch { return 0 }
}

export function addCatalogueItem(item: CartItem, bridge = sharedCart): { ok: boolean; message: string } {
  if (!decodeCatalogueCart([item])) return { ok: false, message: 'Choose a valid variant and quantity before adding to cart.' }
  try {
    const cart = decodeCatalogueCart(bridge.read())
    if (!cart) return { ok: false, message: 'Your saved cart cannot be read. Open the cart and review it before adding items.' }
    const existing = cart.find(line => line.variantId === item.variantId)
    const quantity = (existing?.quantity ?? 0) + item.quantity
    if (quantity > item.stockQuantity) return { ok: false,
      message: `Your cart already has ${existing?.quantity ?? 0} of this variant. Only ${item.stockQuantity} are currently available.` }
    if (existing && quantity > existing.stockQuantity) return { ok: false,
      message: 'The stock shown has changed since this item was saved. Remove its saved cart line and add it again to refresh it.' }
    if (!existing && cart.length >= 100) return { ok: false, message: 'Your cart is full. Review it before adding another product.' }
    bridge.add(item)
    return { ok: true, message: `Added to cart. Your cart now has ${quantity} of this variant. Stock is not reserved until checkout.` }
  } catch {
    return { ok: false, message: 'Your browser blocked saving the cart. Please allow session storage and try again.' }
  }
}

export function subscribeCatalogueCart(callback: () => void) {
  window.addEventListener('cart-updated', callback)
  window.addEventListener('storage', callback)
  return () => {
    window.removeEventListener('cart-updated', callback)
    window.removeEventListener('storage', callback)
  }
}
