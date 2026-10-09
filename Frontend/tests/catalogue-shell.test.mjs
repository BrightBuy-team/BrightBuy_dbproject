import assert from 'node:assert/strict'
import { after, test } from 'node:test'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { createServer } from 'vite'
import { contactEmail } from '../src/catalogue/contact.ts'
import { defaultSearch } from '../src/catalogue/search.ts'

test('contact configuration accepts plain email addresses only', () => {
  assert.equal(contactEmail(' help@example.com '), 'help@example.com')
  for (const value of [undefined, '', 'javascript:alert(1)', 'mailto:help@example.com',
    'help@example.com?subject=message', 'help@example.com\r\nBcc:other@example.com',
    'help%0a@example.com', 'Not configured', '<b>help@example.com</b>']) {
    assert.equal(contactEmail(value), undefined)
  }
})

const vite = await createServer({ server: { middlewareMode: true, hmr: false, ws: false, watch: null }, appType: 'custom' })
after(() => vite.close())
const { default: CategoryNavigation } = await vite.ssrLoadModule('/src/catalogue/CategoryNavigation.tsx')
const { default: CatalogueFooter } = await vite.ssrLoadModule('/src/catalogue/CatalogueFooter.tsx')
const { default: CatalogueHeader } = await vite.ssrLoadModule('/src/catalogue/CatalogueHeader.tsx')
const { AccountStatusView } = await vite.ssrLoadModule('/src/catalogue/AccountStatus.tsx')
const categories = [
  { category_id: 1, parent_category_id: null, name: 'Electronics' },
  { category_id: 4, parent_category_id: 1, name: 'Phones' },
  { category_id: 2, parent_category_id: null, name: 'Toys' },
]
const navigation = props => renderToStaticMarkup(createElement(CategoryNavigation, {
  categories, loading: false, retry() {}, ...props,
}))
const footer = email => renderToStaticMarkup(createElement(CatalogueFooter, { email }))

test('header restores the applied keyword with accessible search controls', () => {
  const html = renderToStaticMarkup(createElement(CatalogueHeader, {
    query: { ...defaultSearch, keyword: 'phone' }, homeHref: '/catalogue.html',
  }))
  assert.match(html, /href="\/catalogue.html"/)
  assert.match(html, /role="search"/)
  assert.match(html, /for="catalogue-keyword"/)
  assert.match(html, /value="phone"/)
  assert.match(html, /aria-invalid="false"/)
  assert.doesNotMatch(html, /role="alert"/)
})
test('header links to the implemented cart with an accessible unit count', () => {
  const html = renderToStaticMarkup(createElement(CatalogueHeader, { query: defaultSearch, homeHref: '/' }))
  assert.match(html, /href="\?view=cart" aria-label="Cart, 0 items"/)
  assert.match(html, /id="cart-count">0/)
  assert.match(html, /aria-label="Account status"/)
})
test('a fresh header escapes keyword text and starts without a stale error', () => {
  const html = renderToStaticMarkup(createElement(CatalogueHeader, {
    query: { ...defaultSearch, keyword: '<script>"&' }, homeHref: '/catalogue.html',
  }))
  assert.match(html, /value="&lt;script&gt;&quot;&amp;"/)
  assert.doesNotMatch(html, /<script>|aria-describedby="search-error"/)
})

test('persistent navigation shows roots and clean category links', () => {
  const html = navigation({ currentCategoryId: '1' })
  assert.match(html, /aria-label="Catalogue navigation"/)
  assert.match(html, /categoryId=1&amp;sort=name_asc&amp;page=1&amp;pageSize=12/)
  assert.match(html, /aria-current="page">Electronics/)
  assert.match(html, /Toys/)
  assert.doesNotMatch(html, /Phones|productId|keyword|<select/)
})
test('no falsely active root for child, detail or unknown category', () => {
  for (const currentCategoryId of [undefined, '', '4', '999']) {
    assert.doesNotMatch(navigation({ currentCategoryId }), /aria-current/)
  }
})
test('loading and failure keep the all-products route usable', () => {
  const loading = navigation({ categories: undefined, loading: true })
  assert.match(loading, /aria-busy="true"/)
  assert.match(loading, /Loading categories/)
  assert.match(loading, /All products/)
  const error = navigation({ categories: undefined, error: 'Failed' })
  assert.match(error, /role="alert"/)
  assert.match(error, /Retry navigation/)
  assert.match(error, /All products/)
})
test('empty navigation does not invent categories or broken account links', () => {
  const html = navigation({ categories: [] })
  assert.match(html, /All products/)
  assert.doesNotMatch(html, /Electronics|\/cart|\/login/)
})
test('untrusted category text is escaped', () => {
  const html = navigation({ categories: [{ ...categories[0], name: '<script>bad</script>' }] })
  assert.match(html, /&lt;script&gt;/)
  assert.doesNotMatch(html, /<script>/)
})
test('footer includes SRS policy and distinguishes adding items from placing orders', () => {
  const html = footer('')
  for (const text of ['Delivery policy', 'Texas', 'Store Pickup', 'Payment methods',
    'Cash on Delivery', 'Card Payment', 'USD', 'Checkout requires a confirmed account session',
    'adding an item does not place an order']) assert.ok(html.includes(text), text)
  assert.doesNotMatch(html, /mailto:|tel:|Free shipping/)
  assert.match(html, /Contact details will be published when confirmed/)
})

test('catalogue account status is based on a confirmed session and never assumes mock login', () => {
  const render = props => renderToStaticMarkup(createElement(AccountStatusView, { loading: false, retry() {}, ...props }))
  assert.match(render({ data: null }), /Not signed in/)
  assert.match(render({ error: 'Failed' }), /Account status unavailable/)
  assert.match(render({ loading: true }), /Checking account/)
  const html = render({ data: { id: 1, email: 'customer@example.com', role: 'Customer', accountType: 'CUSTOMER' } })
  assert.match(html, /Signed in as customer@example.com/)
  assert.doesNotMatch(html, /Logout|admin123|Account pages pending/)
})
test('configured contact email is a usable mail link', () => {
  assert.match(footer('help@example.com'), /href="mailto:help@example.com"/)
  assert.doesNotMatch(footer('help@example.com'), /when confirmed/)
})
test('demo contact is labelled and is not a misleading mail link', () => {
  const html = footer('support@brightbuy.example')
  assert.match(html, /support@brightbuy.example/)
  assert.match(html, /Demo address — not a working mailbox/)
  assert.doesNotMatch(html, /mailto:/)
})
test('invalid contact configuration produces no unsafe link', () => {
  const html = footer('javascript:alert(1)')
  assert.doesNotMatch(html, /javascript:|mailto:/)
  assert.match(html, /when confirmed/)
})
