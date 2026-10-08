import assert from 'node:assert/strict'
import { test } from 'node:test'
import {
  CART_STORAGE_KEY, addToCart, cartHref, cartUnitCount, checkoutItems, clearCart, decodeCart, readCart,
} from '../src/catalogue/cart.ts'

function storage(initial) {
  const values = new Map(initial === undefined ? [] : [[CART_STORAGE_KEY, initial]])
  return {
    getItem: key => values.get(key) ?? null,
    setItem: (key, value) => { values.set(key, value) },
    removeItem: key => { values.delete(key) },
  }
}
const phone = { variantId: 7, quantity: 2, productId: 3, productName: 'Demo phone', variantLabel: 'Phone · Black', unitPrice: 199.5 }
const speaker = { variantId: 9, quantity: 1, productId: 4, productName: 'Demo speaker', variantLabel: 'Speaker', unitPrice: 49 }

test('a new cart is empty and adding an item stores one line', () => {
  const store = storage()
  assert.deepEqual(readCart(store), [])
  const result = addToCart(phone, 5, store)
  assert.equal(result.ok, true)
  assert.equal(result.lineQuantity, 2)
  assert.deepEqual(readCart(store), [phone])
  assert.deepEqual(JSON.parse(store.getItem(CART_STORAGE_KEY)), [phone])
})
test('adding the same variant merges quantity and refreshes the display snapshot', () => {
  const store = storage()
  addToCart(phone, 5, store)
  const result = addToCart({ ...phone, quantity: 3, unitPrice: 189 }, 5, store)
  assert.equal(result.ok, true)
  assert.deepEqual(readCart(store), [{ ...phone, quantity: 5, unitPrice: 189 }])
})
test('different variants become separate lines and units are totalled', () => {
  const store = storage()
  addToCart(phone, 5, store)
  addToCart(speaker, 1, store)
  assert.deepEqual(readCart(store).map(line => line.variantId), [7, 9])
  assert.equal(cartUnitCount(readCart(store)), 3)
  assert.equal(cartUnitCount([]), 0)
})
test('quantity beyond the stock shown is rejected and the cart is unchanged', () => {
  const store = storage()
  assert.deepEqual(addToCart({ ...phone, quantity: 6 }, 5, store), { ok: false, message: 'Only 5 units are currently available.' })
  assert.deepEqual(readCart(store), [])
  addToCart({ ...phone, quantity: 4 }, 5, store)
  const result = addToCart({ ...phone, quantity: 2 }, 5, store)
  assert.equal(result.ok, false)
  assert.match(result.message, /already has 4 of this variant\. Only 5 are currently available/)
  assert.equal(readCart(store)[0].quantity, 4)
  assert.equal(addToCart(phone, 0, store).ok, false)
})
test('invalid items and stock values are rejected', () => {
  const store = storage()
  for (const item of [{ ...phone, quantity: 0 }, { ...phone, quantity: 1.5 }, { ...phone, quantity: -1 },
    { ...phone, variantId: 0 }, { ...phone, variantId: '7' }, { ...phone, productName: ' ' },
    { ...phone, unitPrice: -1 }, { ...phone, unitPrice: Number.NaN }, null]) {
    assert.equal(addToCart(item, 5, store).ok, false)
  }
  for (const stock of [-1, 1.5, Number.NaN, '5']) assert.equal(addToCart(phone, stock, store).ok, false)
  assert.deepEqual(readCart(store), [])
})
test('corrupted or unexpected stored data is treated as an empty cart', () => {
  for (const stored of ['', 'not json', '{}', 'null', '[1]', JSON.stringify([{ ...phone, quantity: 0 }]),
    JSON.stringify([{ ...phone, variantId: '7' }]), JSON.stringify([phone, phone]),
    JSON.stringify([{ variantId: 7, quantity: 1 }])]) {
    assert.deepEqual(decodeCart(stored), [], stored)
    assert.deepEqual(readCart(storage(stored)), [], stored)
  }
  assert.deepEqual(decodeCart(null), [])
  assert.deepEqual(decodeCart(JSON.stringify([{ ...phone, extra: '<script>' }])), [phone])
})
test('a full cart refuses further lines but still merges existing ones', () => {
  const lines = Array.from({ length: 100 }, (_, index) => ({ ...phone, variantId: index + 1 }))
  const store = storage(JSON.stringify(lines))
  assert.match(addToCart({ ...phone, variantId: 500 }, 5, store).message, /cart is full/)
  assert.equal(addToCart({ ...phone, variantId: 1, quantity: 1 }, 5, store).ok, true)
})
test('storage failures are reported instead of thrown', () => {
  const blocked = { getItem() { throw new Error('blocked') }, setItem() { throw new Error('blocked') }, removeItem() { throw new Error('blocked') } }
  assert.deepEqual(readCart(blocked), [])
  const result = addToCart(phone, 5, blocked)
  assert.equal(result.ok, false)
  assert.match(result.message, /blocked saving the cart/)
  assert.doesNotThrow(() => clearCart(blocked))
})
test('clearing removes the stored cart', () => {
  const store = storage()
  addToCart(phone, 5, store)
  clearCart(store)
  assert.equal(store.getItem(CART_STORAGE_KEY), null)
  assert.deepEqual(readCart(store), [])
})
test('checkout items carry only variant and quantity', () => {
  assert.deepEqual(checkoutItems([phone, speaker]), [{ variantId: 7, quantity: 2 }, { variantId: 9, quantity: 1 }])
})
test('cart link accepts same-site paths and http addresses only', () => {
  assert.equal(cartHref(' /cart.html '), '/cart.html')
  assert.equal(cartHref('https://shop.example.com/cart'), 'https://shop.example.com/cart')
  for (const value of [undefined, '', '  ', '//evil.example.com', 'javascript:alert(1)', 'cart.html',
    'https://user:secret@example.com/cart', '/cart page', 'data:text/html,x']) {
    assert.equal(cartHref(value), undefined, String(value))
  }
})
