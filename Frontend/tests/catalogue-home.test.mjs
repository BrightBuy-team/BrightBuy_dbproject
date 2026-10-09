import assert from 'node:assert/strict'
import { after, test } from 'node:test'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { createServer } from 'vite'
import { defaultSearch } from '../src/catalogue/search.ts'
import { featuredProductsPath, isCatalogueHome } from '../src/catalogue/home.ts'

test('home requires default browse state and no detail/error', () => {
  assert.equal(isCatalogueHome(defaultSearch, null, ''), true)
  for (const change of [{ keyword: 'phone' }, { categoryId: '1' }, { minPrice: '0' },
    { maxPrice: '100' }, { inStockOnly: true }, { sort: 'newest' }, { page: 2 }, { pageSize: 6 }]) {
    assert.equal(isCatalogueHome({ ...defaultSearch, ...change }, null, ''), false)
  }
  assert.equal(isCatalogueHome(defaultSearch, 1, ''), false)
  assert.equal(isCatalogueHome(defaultSearch, null, 'Invalid link'), false)
})
test('featured query uses existing newest in-stock search with six results', () => {
  const url = new URL(featuredProductsPath, 'https://example.invalid')
  assert.equal(url.pathname, '/products')
  assert.equal(url.searchParams.get('inStockOnly'), 'true')
  assert.equal(url.searchParams.get('sort'), 'newest')
  assert.equal(url.searchParams.get('pageSize'), '6')
  assert.equal(url.searchParams.get('page'), '1')
  assert.equal(url.searchParams.has('categoryId'), false)
})

const vite = await createServer({ server: { middlewareMode: true, hmr: false, ws: false, watch: null }, appType: 'custom' })
after(() => vite.close())
const { HomeHighlightsView } = await vite.ssrLoadModule('/src/catalogue/HomeHighlights.tsx')
const { default: ProductCard } = await vite.ssrLoadModule('/src/catalogue/ProductCard.tsx')
const roots = [
  { category_id: 1, parent_category_id: null, name: 'Electronics', product_count: 8 },
  { category_id: 4, parent_category_id: 1, name: 'Mobile phones', product_count: 5 },
  { category_id: 2, parent_category_id: null, name: 'Toys', product_count: 1 },
]
const product = { product_id: 1, sku: 'HOME-1', name: 'Featured phone', image_url: null,
  min_price: 100, max_price: 120, matching_variant_count: 2, matching_stock_quantity: 4 }
const state = data => ({ data, loading: false, retry() {} })
const render = (props = {}) => renderToStaticMarkup(createElement(HomeHighlightsView, {
  categories: state(roots), featured: state({ items: [product] }), ...props,
}))

test('home shows only top-level category links with counts', () => {
  const html = render()
  assert.match(html, /Top-level categories/)
  assert.match(html, /Electronics/)
  assert.match(html, /8 products/)
  assert.match(html, /1 product /)
  assert.doesNotMatch(html, /Mobile phones|categoryId=4/)
  assert.match(html, /href="\?categoryId=1&amp;sort=name_asc&amp;page=1&amp;pageSize=12"/)
})
test('featured card opens detail with default return context and LKR range', () => {
  const html = render()
  assert.match(html, /Featured products/)
  assert.match(html, /newest in-stock products/)
  assert.match(html, /pageSize=12&amp;productId=1/)
  assert.match(html, /LKR 100.00/)
  assert.match(html, /LKR 120.00/)
  assert.match(html, /href="#results-heading"/)
})
test('featured list is capped at six even if API returns more', () => {
  const html = render({ featured: state({ items: Array.from({ length: 7 }, (_, id) => ({ ...product, product_id: id + 1 })) }) })
  assert.equal((html.match(/<article/g) ?? []).length, 6)
})
test('category loading and failure do not hide featured products', () => {
  const loading = render({ categories: { ...state(undefined), loading: true } })
  assert.match(loading, /role="status">Loading categories/)
  assert.match(loading, /Featured phone/)
  const error = render({ categories: { ...state(undefined), error: 'Categories unavailable' } })
  assert.match(error, /Retry categories/)
  assert.match(error, /Featured phone/)
})
test('featured loading and failure do not hide categories', () => {
  const loading = render({ featured: { ...state(undefined), loading: true } })
  assert.match(loading, /role="status">Loading featured products/)
  assert.match(loading, /Electronics/)
  const error = render({ featured: { ...state(undefined), error: 'Products unavailable' } })
  assert.match(error, /Retry featured products/)
  assert.match(error, /Electronics/)
})
test('empty categories and featured products have useful messages', () => {
  const html = render({ categories: state([]), featured: state({ items: [] }) })
  assert.match(html, /No categories are available yet/)
  assert.match(html, /No featured products are available right now/)
  assert.doesNotMatch(html, /<article/)
})
test('category names and product text are escaped', () => {
  const html = render({ categories: state([{ ...roots[0], name: '<script>bad</script>' }]) })
  assert.match(html, /&lt;script&gt;/)
  assert.doesNotMatch(html, /<script>/)
})
test('extracted browse card preserves filters and stock state', () => {
  const html = renderToStaticMarkup(createElement(ProductCard, { product: { ...product, matching_stock_quantity: 0 },
    query: { ...defaultSearch, categoryId: '4', page: 2, sort: 'price_desc' } }))
  assert.match(html, /categoryId=4&amp;sort=price_desc&amp;page=2&amp;pageSize=12&amp;productId=1/)
  assert.match(html, /Out of stock/)
})
