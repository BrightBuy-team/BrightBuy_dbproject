import assert from 'node:assert/strict'
import { after, test } from 'node:test'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { createServer } from 'vite'
import { parseLowStockThreshold, quantityError, stockLabel, variantLabel } from '../src/catalogue/variants.ts'

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
  for (const input of ['', '0', '-1', '1.2', '1e2', 'abc', '9007199254740992']) assert.ok(quantityError(input, 5))
  assert.equal(quantityError('6', 5), 'Only 5 units are currently available.')
  assert.equal(quantityError('1', 0), 'This variant is out of stock.')
  assert.equal(quantityError('1', 5), undefined)
  assert.equal(quantityError('5', 5), undefined)
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
const render = props => renderToStaticMarkup(createElement(VariantSelection, { variants, ...props }))
test('multiple options have labelled selector and live price/stock region', () => {
  const html = render({ lowStockThreshold: 5 })
  assert.match(html, /for="catalogue-variant"/)
  assert.match(html, /Blue · 256GB/)
  assert.match(html, /Low Stock/)
  assert.match(html, /aria-live="polite"/)
  assert.match(html, /max="5"/)
  assert.match(html, /No items are saved or reserved/)
})
test('single variant hides selector and disables quantity for zero stock', () => {
  const html = render({ variants: [variants[1]] })
  assert.doesNotMatch(html, /<select/)
  assert.match(html, /USD 150.00/)
  assert.match(html, /<input[^>]*disabled=""/)
  assert.match(html, /<button[^>]*disabled=""/)
  assert.match(html, /Out of Stock/)
})
test('empty variants cannot expose purchase controls', () => {
  const html = render({ variants: [] })
  assert.match(html, /No variants are available/)
  assert.doesNotMatch(html, /<select|<input|<button/)
})
