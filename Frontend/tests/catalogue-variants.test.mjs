import assert from 'node:assert/strict'
import { after, test } from 'node:test'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { createServer } from 'vite'
import { backorderNote, maxOrderQuantity, parseLowStockThreshold, quantityError, stockLabel, variantLabel } from '../src/catalogue/variants.ts'

test('stock threshold is explicitly configured, positive and integral', () => {
  for (const input of [undefined, '', '0', '-1', '1.5', 'abc', 'Infinity', '9007199254740992']) {
    assert.equal(parseLowStockThreshold(input), undefined)
  }
  assert.equal(parseLowStockThreshold('5'), 5)
})
test('stock status handles zero, threshold boundary, and unset threshold', () => {
  assert.equal(stockLabel(0, 5), 'Out of Stock')
  assert.equal(stockLabel(5, 5), 'Low Stock')
  assert.equal(stockLabel(6, 5), 'In Stock')
  assert.equal(stockLabel(1), 'In Stock')
})
test('quantity rejects missing, fractional, negative and excessive values', () => {
  for (const input of ['', '0', '-1', '1.2', '1e2', 'abc', '9007199254740992']) assert.ok(quantityError(input))
  assert.equal(quantityError('1'), undefined)
  assert.equal(quantityError(String(maxOrderQuantity)), undefined)
  assert.equal(quantityError(String(maxOrderQuantity + 1)), 'You can order at most 100 units of one item.')
})
test('asking for more than is in stock is a back-order with a 3-day delay, not an error', () => {
  assert.equal(backorderNote(5, 5), undefined)
  assert.equal(backorderNote(1, 50), undefined)
  assert.match(backorderNote(1, 0), /Out of stock\. You can still order it.*3 days longer/)
  assert.match(backorderNote(6, 5), /Only 5 in stock: the other 1 unit is back-ordered.*3 days longer/)
  assert.match(backorderNote(8, 5), /the other 3 units are back-ordered/)
  assert.equal(backorderNote(NaN, 5), undefined)
})
test('variant labels include attributes and support default variants', () => {
  assert.equal(variantLabel({ variant_id: 4, variant_name: 'Phone', colour: 'Blue', memory_size: '256GB' }), 'Phone · Blue · 256GB')
  assert.equal(variantLabel({ variant_id: 4, variant_name: null, colour: null, memory_size: 'N/A' }), 'Variant 4')
})

const vite = await createServer({ server: { middlewareMode: true, hmr: false, ws: false, watch: null }, appType: 'custom' })
after(() => vite.close())
const { default: VariantSelection } = await vite.ssrLoadModule('/src/catalogue/VariantSelection.tsx')
const variants = [
  { variant_id: 1, variant_name: 'Phone', colour: 'Black', memory_size: '128GB', price: 100, stock_quantity: 5 },
  { variant_id: 2, variant_name: 'Phone', colour: 'Blue', memory_size: '256GB', price: 150, stock_quantity: 0 },
]
const render = props => renderToStaticMarkup(createElement(VariantSelection, {
  productId: 3, productName: 'Demo phone', variants, ...props,
}))
test('multiple options have labelled selector and live price/stock region', () => {
  const html = render({ lowStockThreshold: 5 })
  assert.match(html, /for="catalogue-variant"/)
  assert.match(html, /Blue · 256GB/)
  assert.match(html, /Low Stock/)
  assert.match(html, /aria-live="polite"/)
  assert.match(html, /max="100"/)
  assert.match(html, /Stock is not reserved until checkout/)
})
test('single variant hides selector; an out-of-stock variant can still be ordered as a back-order', () => {
  const html = render({ variants: [variants[1]] })
  assert.doesNotMatch(html, /<select/)
  assert.match(html, /USD\s150\.00/)
  assert.doesNotMatch(html, /<input[^>]*disabled=""/)
  assert.doesNotMatch(html, /<button[^>]*disabled=""/)
  assert.match(html, /Out of Stock/)
  assert.match(html, /You can still order it[^<]*3 days longer/)
})
test('empty variants cannot expose purchase controls', () => {
  const html = render({ variants: [] })
  assert.match(html, /No variants are available/)
  assert.doesNotMatch(html, /<select|<input|<button/)
})
test('in-stock variants can be added to the cart but never place an order', () => {
  const html = render({})
  assert.match(html, /<button[^>]*>Add to Cart/)
  assert.doesNotMatch(html, /<button[^>]*disabled=""[^>]*>Add to Cart/)
  assert.match(html, /aria-describedby="catalogue-cart-note"/)
  assert.match(html, /class="catalogue-cart-result[^"]*" role="status" aria-live="polite"><\/p>/)
  assert.doesNotMatch(html, /Buy Now|Processing|Checkout completed|Cart integration is not available/)
})
