// Session cart shared by the catalogue, cart and checkout pages (SRS AS-11).
// Nothing is reserved while items sit here (AS-10): checkout revalidates stock
// and price in the database. variantId and quantity are the only fields sent
// to checkout; the rest are display snapshots and must never be trusted.

export type CartLine = {
  variantId: number
  quantity: number
  productId: number
  productName: string
  variantLabel: string
  unitPrice: number
}

export type CartStorage = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>

export type AddToCartResult =
  | { ok: true; lines: CartLine[]; lineQuantity: number }
  | { ok: false; message: string }

export const CART_STORAGE_KEY = 'brightbuy.cart.v1'
const CART_EVENT = 'brightbuy:cart'
const MAX_LINES = 100

const memory = new Map<string, string>()
const memoryStorage: CartStorage = {
  getItem: key => memory.get(key) ?? null,
  setItem: (key, value) => { memory.set(key, value) },
  removeItem: key => { memory.delete(key) },
}

// Private browsing or blocked site data can make sessionStorage throw.
function sessionCartStorage(): CartStorage {
  try {
    if (typeof sessionStorage !== 'undefined') return sessionStorage
  } catch { /* fall through to memory */ }
  return memoryStorage
}

function id(value: unknown): value is number {
  return typeof value === 'number' && Number.isSafeInteger(value) && value > 0 && value <= 2147483647
}
function text(value: unknown, max: number): value is string {
  return typeof value === 'string' && value.trim().length > 0 && value.length <= max
}
function line(value: unknown): value is CartLine {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return false
  const item = value as Record<string, unknown>
  return id(item.variantId) && id(item.quantity) && id(item.productId)
    && text(item.productName, 150) && text(item.variantLabel, 300)
    && typeof item.unitPrice === 'number' && Number.isFinite(item.unitPrice) && item.unitPrice >= 0
}

// Anything unexpected in storage is treated as an empty cart, never repaired.
export function decodeCart(stored: string | null): CartLine[] {
  if (!stored) return []
  try {
    const value: unknown = JSON.parse(stored)
    if (!Array.isArray(value) || value.length > MAX_LINES || !value.every(line)) return []
    if (new Set(value.map(item => item.variantId)).size !== value.length) return []
    return value.map(item => ({
      variantId: item.variantId, quantity: item.quantity, productId: item.productId,
      productName: item.productName, variantLabel: item.variantLabel, unitPrice: item.unitPrice,
    }))
  } catch {
    return []
  }
}

export function readCartText(storage: CartStorage = sessionCartStorage()): string | null {
  try {
    return storage.getItem(CART_STORAGE_KEY)
  } catch {
    return null
  }
}

export function readCart(storage: CartStorage = sessionCartStorage()): CartLine[] {
  return decodeCart(readCartText(storage))
}

function writeCart(lines: CartLine[], storage: CartStorage): boolean {
  try {
    if (lines.length) storage.setItem(CART_STORAGE_KEY, JSON.stringify(lines))
    else storage.removeItem(CART_STORAGE_KEY)
  } catch {
    return false
  }
  if (typeof window !== 'undefined') window.dispatchEvent(new Event(CART_EVENT))
  return true
}

// availableStock is the stock shown on the page when the customer clicked.
export function addToCart(item: CartLine, availableStock: number,
  storage: CartStorage = sessionCartStorage()): AddToCartResult {
  if (!line(item) || !Number.isSafeInteger(availableStock) || availableStock < 0) {
    return { ok: false, message: 'This item could not be added. Refresh the page and try again.' }
  }
  const lines = readCart(storage)
  const existing = lines.find(current => current.variantId === item.variantId)
  const lineQuantity = (existing?.quantity ?? 0) + item.quantity
  if (lineQuantity > availableStock) {
    return { ok: false, message: existing
      ? `Your cart already has ${existing.quantity} of this variant. Only ${availableStock} are currently available.`
      : `Only ${availableStock} units are currently available.` }
  }
  if (!existing && lines.length >= MAX_LINES) {
    return { ok: false, message: 'Your cart is full. Remove an item before adding another.' }
  }
  const updated = existing
    ? lines.map(current => current.variantId === item.variantId ? { ...item, quantity: lineQuantity } : current)
    : [...lines, { ...item }]
  if (!writeCart(updated, storage)) {
    return { ok: false, message: 'Your browser blocked saving the cart. Check its storage settings and try again.' }
  }
  return { ok: true, lines: updated, lineQuantity }
}

export function clearCart(storage: CartStorage = sessionCartStorage()): void {
  writeCart([], storage)
}

export function cartUnitCount(lines: CartLine[]): number {
  return lines.reduce((total, current) => total + current.quantity, 0)
}

// The request body items expected by POST /api/checkout (CartItemDto).
export function checkoutItems(lines: CartLine[]): { variantId: number; quantity: number }[] {
  return lines.map(current => ({ variantId: current.variantId, quantity: current.quantity }))
}

// Optional link to the cart page: a same-site path or an http(s) address only.
export function cartHref(configured: string | undefined): string | undefined {
  const value = configured?.trim()
  if (!value) return undefined
  if (/^\/(?!\/)[^\s\\]*$/.test(value)) return value
  try {
    const url = new URL(value)
    return ['http:', 'https:'].includes(url.protocol) && !url.username && !url.password ? url.toString() : undefined
  } catch {
    return undefined
  }
}

export function subscribeCart(callback: () => void): () => void {
  if (typeof window === 'undefined') return () => {}
  window.addEventListener(CART_EVENT, callback)
  window.addEventListener('storage', callback)
  return () => {
    window.removeEventListener(CART_EVENT, callback)
    window.removeEventListener('storage', callback)
  }
}
