import assert from 'node:assert/strict'
import { after, test } from 'node:test'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { createServer } from 'vite'
import { defaultSearch } from '../src/catalogue/search.ts'

// Use the existing Vite TSX compiler; no new test dependencies or browser port.
const vite = await createServer({ server: { middlewareMode: true, hmr: false, ws: false, watch: null }, appType: 'custom' })
after(() => vite.close())
const { ProductDetailView } = await vite.ssrLoadModule('/src/catalogue/ProductDetailPage.tsx')
const render = props => renderToStaticMarkup(createElement(ProductDetailView, {
  query: defaultSearch, loading: false, retry: () => {}, ...props,
}))
const data = {
  product_id: 1, sku: 'DEMO-1', name: 'Demo phone', image_url: null, description: 'A useful phone.',
  categories: [{ category_id: 4, parent_category_id: 1, name: 'Mobile Phones' }],
  variants: [{ variant_id: 1, price: 100, stock_quantity: 5 }, { variant_id: 2, price: 150, stock_quantity: 0 }],
}

test('loading state is announced and marks the detail region busy', () => {
  const html = render({ loading: true })
  assert.match(html, /aria-busy="true"/)
  assert.match(html, /role="status">Loading product details/)
  assert.doesNotMatch(html, /Try again/)
})
test('loaded detail shows product details and the selected variant price', () => {
  const html = render({ data })
  for (const text of ['Demo phone', 'DEMO-1', 'A useful phone.', 'Mobile Phones', 'USD', '100.00', 'In Stock', 'Image coming soon']) assert.ok(html.includes(text), text)
  assert.match(html, /categoryId=4/)
  assert.match(html, /<select id="catalogue-variant"/)
  assert.match(html, /Cart integration is not available yet/)
  assert.doesNotMatch(html, /150.00|currency is not yet specified/)
})
test('single-price and fully out-of-stock products remain readable', () => {
  const html = render({ data: { ...data, variants: [{ variant_id: 1, price: 0, stock_quantity: 0 }] } })
  assert.match(html, /Out of Stock/)
  assert.match(html, /0.00/)
  assert.doesNotMatch(html, /Product unavailable| – /)
  assert.doesNotMatch(html, /<select/)
  assert.match(html, /Default variant/)
})
test('missing description and empty categories have useful fallbacks', () => {
  const html = render({ data: { ...data, description: ' ', categories: [] } })
  assert.match(html, /No description is available/)
  assert.doesNotMatch(html, /<h2>Categories/)
})
test('404 shows unavailable state without a misleading retry button', () => {
  const html = render({ status: 404, error: 'Product not found or unavailable.' })
  assert.match(html, /role="alert"/)
  assert.match(html, /<h1>Product unavailable/)
  assert.match(html, /Return to results/)
  assert.doesNotMatch(html, /Try again/)
})
test('server and network failures display a retry action', () => {
  for (const status of [undefined, 500, 503]) {
    const html = render({ status, error: 'Please try again later.' })
    assert.match(html, /Unable to load product/)
    assert.match(html, /Please try again later/)
    assert.match(html, /<button>Try again<\/button>/)
  }
})
test('back links retain original browse filters on success and failure', () => {
  const query = { ...defaultSearch, categoryId: '4', page: 2, sort: 'price_desc' }
  for (const props of [{ data }, { loading: true }, { error: 'Unavailable', status: 503 }]) {
    const html = render({ ...props, query })
    assert.match(html, /href="\?categoryId=4&amp;sort=price_desc&amp;page=2&amp;pageSize=12"/)
  }
})
test('API text is escaped and unsafe image schemes get a fallback', () => {
  const html = render({ data: { ...data, name: '<script>alert(1)</script>', image_url: 'javascript:alert(1)' } })
  assert.match(html, /&lt;script&gt;/)
  assert.match(html, /Image coming soon/)
  assert.doesNotMatch(html, /<script|javascript:/)
})
test('valid images include meaningful alternative text', () => {
  const html = render({ data: { ...data, image_url: '/phone.png' } })
  assert.match(html, /src="\/phone.png"/)
  assert.match(html, /alt="Demo phone"/)
})
