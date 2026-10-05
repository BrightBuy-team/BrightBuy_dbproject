import assert from 'node:assert/strict'
import { test } from 'node:test'
import { defaultSearch, formatPrice, parseSearch, searchParams } from '../src/catalogue/search.ts'
import { decodeCategories, decodeProducts, requestCatalogue } from '../src/catalogue/api.ts'

const parse = value => parseSearch(new URLSearchParams(value))
const product = {
  product_id: 1, sku: 'PHONE-1', name: 'Demo phone', image_url: null,
  min_price: 100, max_price: 120.50, matching_variant_count: 2, matching_stock_quantity: 5,
}
const page = { page: 1, page_size: 12, sort: 'name_asc', total_products: 1, total_pages: 1, items: [product] }
const category = { category_id: 1, parent_category_id: null, name: 'Electronics', description: null, product_count: 1 }

test('default filters match the backend contract', () => {
  assert.deepEqual(defaultSearch, { keyword: '', categoryId: '', minPrice: '', maxPrice: '', inStockOnly: false, sort: 'name_asc', page: 1, pageSize: 12 })
})
test('filters survive a URL round trip, including literal search characters', () => {
  const query = { ...defaultSearch, keyword: 'phone & 50%_ +', categoryId: '4', minPrice: '0', maxPrice: '99999999.99', inStockOnly: true, sort: 'price_desc', page: 2, pageSize: 24 }
  assert.deepEqual(parseSearch(searchParams(query)), query)
})
test('blank optional filters are omitted; search and sort are normalized', () => {
  assert.equal(searchParams(defaultSearch).has('categoryId'), false)
  assert.equal(searchParams(defaultSearch).has('minPrice'), false)
  assert.equal(parse('keyword=%20phone%20&sort=%20PRICE_ASC%20').keyword, 'phone')
  assert.equal(parse('sort=%20PRICE_ASC%20').sort, 'price_asc')
})
test('Unicode keyword length is measured in code points', () => {
  assert.equal(parseSearch(new URLSearchParams({ keyword: '😀'.repeat(255) })).keyword.length, 510)
  assert.throws(() => parseSearch(new URLSearchParams({ keyword: '😀'.repeat(256) })), /255/)
})
for (const input of [
  'page=0', 'page=-1', 'page=1.2', 'page=1000001', 'page=', 'page=1e2',
  'pageSize=0', 'pageSize=101', 'pageSize=', 'categoryId=0', 'categoryId=2147483648', 'categoryId=',
  'minPrice=-1', 'maxPrice=100000000', 'minPrice=1.001', 'maxPrice=1e2', 'minPrice=',
  'minPrice=20&maxPrice=10', 'sort=constructor', 'sort=unsupported', 'inStockOnly=1',
  'keyword=a&keyword=b', 'unknown=1',
]) test(`rejects invalid filters: ${input}`, () => assert.throws(() => parse(input)))
test('valid integer and decimal boundaries are accepted', () => {
  assert.equal(parse('page=1000000&pageSize=100&categoryId=2147483647&minPrice=0&maxPrice=99999999.99').page, 1000000)
})
test('prices use the SRS USD currency with two decimals', () => {
  assert.equal(formatPrice(1234.5), 'USD\u00a01,234.50')
  assert.equal(formatPrice(0), 'USD\u00a00.00')
})
test('decodes product pages and empty results', () => {
  assert.deepEqual(decodeProducts(page), page)
  assert.deepEqual(decodeProducts({ ...page, items: [], total_products: 0, total_pages: 0 }).items, [])
})
test('decodes root and child category counts', () => {
  assert.deepEqual(decodeCategories({ items: [category, { ...category, category_id: 2, parent_category_id: 1 }] }).length, 2)
})
for (const value of [null, [], {}, { items: [null] }, { items: [{ ...category, product_count: '1' }] }]) {
  test(`rejects malformed categories: ${JSON.stringify(value)}`, () => assert.throws(() => decodeCategories(value)))
}
for (const value of [null, {}, { ...page, items: null }, { ...page, total_products: -1 },
  { ...page, items: [{ ...product, min_price: '100' }] },
  { ...page, items: [{ ...product, min_price: 200 }] },
  { ...page, items: [{ ...product, matching_stock_quantity: -1 }] }]) {
  test(`rejects malformed product response: ${JSON.stringify(value)}`, () => assert.throws(() => decodeProducts(value)))
}
test('request uses encoded path, JSON headers and no credentials', async t => {
  t.mock.method(globalThis, 'fetch', async (url, options) => {
    assert.equal(url, 'http://localhost:8080/api/catalogue/products?keyword=a%26b')
    assert.equal(options.credentials, 'omit')
    assert.equal(options.headers.Accept, 'application/json')
    assert.ok(options.signal instanceof AbortSignal)
    return Response.json(page)
  })
  assert.deepEqual(await requestCatalogue('http://localhost:8080/api/catalogue/', '/products?keyword=a%26b', decodeProducts, new AbortController().signal), page)
})
for (const status of [400, 404, 500, 503]) {
  test(`HTTP ${status} is safe and never exposes raw SQL`, async t => {
    t.mock.method(globalThis, 'fetch', async () => new Response('SECRET SQL error', { status }))
    await assert.rejects(requestCatalogue('', '/products', decodeProducts, new AbortController().signal), error => {
      assert.doesNotMatch(error.message, /SECRET|SQL/)
      return true
    })
  })
}
test('network failures explain that the backend cannot be reached', async t => {
  t.mock.method(globalThis, 'fetch', async () => { throw new TypeError('fetch failed') })
  await assert.rejects(requestCatalogue('', '/products', decodeProducts, new AbortController().signal), /Cannot reach/)
})
test('HTML responses and malformed JSON are rejected', async t => {
  const fetch = t.mock.method(globalThis, 'fetch', async () => new Response('<html>oops</html>'))
  await assert.rejects(requestCatalogue('', '/products', decodeProducts, new AbortController().signal), /unexpected response/)
  fetch.mock.mockImplementation(async () => new Response('{', { headers: { 'Content-Type': 'application/json' } }))
  await assert.rejects(requestCatalogue('', '/products', decodeProducts, new AbortController().signal), /unexpected response/)
})
test('timeout has a friendly error', async t => {
  t.mock.method(globalThis, 'fetch', async () => { throw new DOMException('timed out', 'TimeoutError') })
  await assert.rejects(requestCatalogue('', '/products', decodeProducts, new AbortController().signal), /too long/)
})
test('cancellation preserves the abort so unmounted requests stay quiet', async t => {
  const controller = new AbortController()
  controller.abort()
  t.mock.method(globalThis, 'fetch', async (_url, options) => { options.signal.throwIfAborted() })
  await assert.rejects(requestCatalogue('', '/products', decodeProducts, controller.signal), { name: 'AbortError' })
})
