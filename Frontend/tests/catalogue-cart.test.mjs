import assert from 'node:assert/strict'
import { test } from 'node:test'
import { addCatalogueItem, catalogueCartQuantity, decodeCatalogueCart } from '../src/catalogue/cartHandoff.ts'

const phone = { variantId: 7, quantity: 2, productId: 3, productName: 'Demo phone',
  variantLabel: 'Phone · Black', price: '199.50', stockQuantity: 5 }
function bridge(initial = []) {
  let cart = initial
  return { read: () => cart, add(item) {
    const existing = cart.find(line => line.variantId === item.variantId)
    if (existing) existing.quantity += item.quantity
    else cart.push({ ...item })
  } }
}

test('catalogue hands the current display snapshot to the shared cart', () => {
  const cart = bridge()
  assert.equal(addCatalogueItem(phone, cart).ok, true)
  assert.deepEqual(cart.read(), [phone])
  assert.equal(catalogueCartQuantity(cart), 2)
})
test('adding an existing variant counts all units already in the cart', () => {
  const cart = bridge([{ ...phone }])
  assert.equal(addCatalogueItem({ ...phone, quantity: 3 }, cart).ok, true)
  assert.equal(catalogueCartQuantity(cart), 5)
  const beyondStock = addCatalogueItem({ ...phone, quantity: 1 }, cart)
  assert.equal(beyondStock.ok, true, 'more than the stock shown is a back-order, not a refusal')
  assert.match(beyondStock.message, /now has 6.*Only 5 in stock.*1 unit is back-ordered.*3 days longer/)
  const tooMany = addCatalogueItem({ ...phone, quantity: 95 }, cart)
  assert.equal(tooMany.ok, false)
  assert.match(tooMany.message, /already has 6.*at most 100/)
  assert.equal(catalogueCartQuantity(cart), 6)
})
test('different variants remain separate lines with a total unit count', () => {
  const cart = bridge([{ ...phone }])
  assert.equal(addCatalogueItem({ ...phone, variantId: 9, quantity: 1 }, cart).ok, true)
  assert.equal(cart.read().length, 2)
  assert.equal(catalogueCartQuantity(cart), 3)
})
test('an out-of-stock variant can be added and the customer is told about the delay', () => {
  const cart = bridge()
  const result = addCatalogueItem({ ...phone, quantity: 2, stockQuantity: 0 }, cart)
  assert.equal(result.ok, true)
  assert.match(result.message, /Out of stock.*still order.*3 days longer/)
  assert.equal(catalogueCartQuantity(cart), 2)
  assert.match(addCatalogueItem({ ...phone, variantId: 8, quantity: 5 }, cart).message, /Stock is not reserved until checkout/)
})
test('invalid quantities, snapshots and stock do not reach the shared add function', () => {
  const cart = { read: () => [], add() { assert.fail('invalid item was added') } }
  for (const change of [{ quantity: 0 }, { quantity: 1.5 }, { quantity: -1 }, { quantity: 101 },
    { variantId: 0 }, { variantId: '7' }, { productName: ' ' }, { price: '-1' }, { price: 'NaN' },
    { stockQuantity: -1 }, { stockQuantity: 1.5 }, { stockQuantity: '5' }]) {
    assert.equal(addCatalogueItem({ ...phone, ...change }, cart).ok, false)
  }
})
test('unexpected or duplicate saved lines are refused without overwriting the cart', () => {
  for (const saved of [null, {}, [1], [{ ...phone, quantity: 0 }], [{ ...phone, variantId: '7' }],
    [phone, phone], [{ variantId: 7, quantity: 1 }]]) {
    assert.equal(decodeCatalogueCart(saved), undefined)
    const cart = { read: () => saved, add() { assert.fail('corrupt cart was overwritten') } }
    assert.equal(catalogueCartQuantity(cart), 0)
    assert.equal(addCatalogueItem(phone, cart).ok, false)
  }
})
test('only agreed display fields are decoded', () => {
  assert.deepEqual(decodeCatalogueCart([{ ...phone, extra: '<script>' }]), [phone])
})
test('a full cart rejects new lines and still accepts existing variants', () => {
  const cart = bridge(Array.from({ length: 100 }, (_, index) => ({ ...phone, variantId: index + 1 })))
  assert.match(addCatalogueItem({ ...phone, variantId: 500 }, cart).message, /cart is full/)
  assert.equal(addCatalogueItem({ ...phone, variantId: 1, quantity: 1 }, cart).ok, true)
})
test('blocked cart reads and writes show a recoverable message', () => {
  for (const cart of [{ read() { throw new Error('blocked') }, add() {} },
    { read: () => [], add() { throw new Error('blocked') } }]) {
    assert.equal(catalogueCartQuantity(cart), 0)
    const result = addCatalogueItem(phone, cart)
    assert.equal(result.ok, false)
    assert.match(result.message, /browser blocked saving/)
  }
})
test('default bridge uses the checkout storage keys and emits its update event without fetching', () => {
  const originals = Object.fromEntries(['localStorage', 'sessionStorage', 'window', 'fetch'].map(key =>
    [key, Object.getOwnPropertyDescriptor(globalThis, key)]))
  const saved = new Map()
  let email = null
  const events = []
  try {
    Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: { getItem: () => email } })
    Object.defineProperty(globalThis, 'sessionStorage', { configurable: true, value: {
      getItem: key => saved.get(key) ?? null, setItem: (key, value) => saved.set(key, value),
    } })
    Object.defineProperty(globalThis, 'window', { configurable: true, value: { dispatchEvent: event => events.push(event.type) } })
    Object.defineProperty(globalThis, 'fetch', { configurable: true, value() { assert.fail('Add to Cart must not contact checkout') } })
    assert.equal(addCatalogueItem(phone).ok, true)
    assert.deepEqual(JSON.parse(saved.get('brightbuy_cart_usd_v1_guest')), [phone])
    assert.equal(catalogueCartQuantity(), 2)
    email = 'customer@example.com'
    assert.equal(catalogueCartQuantity(), 0)
    saved.set('brightbuy_cart_customer@example.com', JSON.stringify([{...phone,price:'1.00'}]))
    saved.set('brightbuy_cart_lkr_v1_customer@example.com', JSON.stringify([{...phone,price:'363726.91'}]))
    assert.equal(catalogueCartQuantity(), 0, 'unversioned and LKR snapshots must not be reused as USD')
    assert.equal(addCatalogueItem({ ...phone, quantity: 1 }).ok, true)
    assert.equal(JSON.parse(saved.get('brightbuy_cart_usd_v1_customer@example.com'))[0].quantity, 1)
    assert.equal(JSON.parse(saved.get('brightbuy_cart_customer@example.com'))[0].price,'1.00', 'legacy cart retained unchanged')
    assert.equal(JSON.parse(saved.get('brightbuy_cart_lkr_v1_customer@example.com'))[0].price,'363726.91', 'LKR cart retained unchanged')
    assert.deepEqual(events, ['cart-updated', 'cart-updated'])
  } finally {
    for (const [key, descriptor] of Object.entries(originals)) {
      if (descriptor) Object.defineProperty(globalThis, key, descriptor)
      else delete globalThis[key]
    }
  }
})
