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
  for (const text of ['Demo phone', 'DEMO-1', 'A useful phone.', 'Mobile Phones', 'USD', '100.00', 'In Stock', 'Smartphone']) assert.ok(html.includes(text), text)
  assert.match(html, /src="\/products\/smartphone\.jpg"/)
  assert.match(html, /categoryId=4/)
  assert.match(html, /<select id="catalogue-variant"/)
  assert.match(html, /<button[^>]*>Add to Cart/)
  assert.match(html, /Your cart is kept for this browser session/)
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
  assert.match(html, /Illustration of &lt;script&gt;alert\(1\)&lt;\/script&gt;/)
  assert.doesNotMatch(html, /<script|javascript:/)
})

test('unmatched products retain the animated illustration fallback', () => {
  const cases = [
    ['BrightBuy Mystery Item', 'BrightBuy'],
  ]
  for (const [name, label] of cases) {
    const html = render({ data: { ...data, name, image_url: null } })
    assert.match(html, new RegExp(`aria-label="Illustration of ${name}"`))
    assert.match(html, new RegExp(`>${label}<`))
    assert.match(html, /catalogue-product-art/)
  }
})
test('known products use bundled matching photos', () => {
  for (const [name, src, alt] of [
    ['Apple iPhone 15 Pro', '/products/iphone-15-pro-user.png', 'Apple iPhone 15 Pro'],
    ['Samsung Galaxy S24 Ultra', '/products/galaxy-s24-ultra-user.jpg', 'Samsung Galaxy S24 Ultra'],
    ['Sony WH-1000XM5', '/products/headphones-user.jpg', 'Representative Sony over-ear headphones'],
    ['BrightBuy Pro Laptop', '/products/pro-laptop-user.png', 'Lenovo Legion laptop'],
    ['BrightBuy Workstation Laptop', '/products/workstation-laptop-user.png', 'Dell laptop computer'],
    ['BrightBuy Convertible Laptop', '/products/convertible-laptop-user.png', 'ASUS Vivobook laptop'],
    ['BrightBuy Gaming Laptop', '/products/gaming-laptop-user.png', 'Acer Predator gaming laptop'],
    ['BrightBuy Air Laptop', '/products/air-laptop-user.png', 'BrightBuy Air Laptop'],
    ['BrightBuy Smart Lamp', '/products/smart-lamp-user.png', 'Adjustable smart desk lamp'],
    ['BrightBuy Smart Watch', '/products/smart-watch-user.jpg', 'Smart watch'],
    ['BrightBuy Fitness Band', '/products/fitness-band-user.png', 'Fitness tracker band'],
    ['BrightBuy Nova Phone', '/products/huawei-phone-user.png', 'Huawei smartphone, representative image'],
    ['BrightBuy Lite Phone', '/products/honor-phone-user.png', 'HONOR smartphone, representative image'],
    ['BrightBuy Mini Phone', '/products/toy-smartphone-user.png', 'Toy-style smartphone, representative image'],
    ['BrightBuy Max Phone', '/products/oneplus-phone-user.png', 'OnePlus smartphone, representative image'],
    ['BrightBuy Plus Phone', '/products/sologic-phone-user.png', 'Sologic smartphone, representative image'],
    ['BrightBuy Portable Speaker', '/products/portable-speaker-user.png', 'Portable Bluetooth speaker'],
    ['BrightBuy Soundbar', '/products/soundbar-user.png', 'Soundbar, subwoofer and surround speakers'],
    ['BrightBuy Wireless Earbuds', '/products/wireless-earbuds-user.png', 'Wireless earbuds and charging case'],
    ['BrightBuy Gaming Headset', '/products/gaming-headset-user.png', 'Over-ear gaming headset with microphone'],
    ['BrightBuy Studio Headphones', '/products/studio-headphones-user.png', 'Beyerdynamic DT 990 Pro wired headphones'],
    ['BrightBuy Mechanical Keyboard', '/products/mechanical-keyboard-user.png', 'RGB mechanical keyboard'],
    ['BrightBuy Wireless Mouse', '/products/wireless-mouse-user.png', 'Wireless computer mouse with USB receiver'],
    ['BrightBuy USB-C Hub', '/products/usb-c-hub-user.png', 'USB-C hub with multiple ports'],
    ['BrightBuy Portable SSD', '/products/portable-ssd-user.png', 'Portable solid-state drive'],
    ['BrightBuy Desktop Monitor', '/products/monitor-user.png', 'Curved desktop monitor'],
    ['BrightBuy Indoor Camera', '/products/security-camera-user.png', 'Indoor security camera'],
    ['BrightBuy Webcam', '/products/webcam-4k-user.png', '4K USB webcam with privacy cover'],
    ['BrightBuy Learning Blocks', '/products/building-blocks-user.png', 'Colorful educational building blocks'],
    ['BrightBuy Coding Robot Kit', '/products/coding-robot-kit-user.png', 'Programmable construction robot kit'],
    ['BrightBuy Science Activity Kit', '/products/science-kit-user.png', 'Science activity kit'],
    ['BrightBuy Alphabet Puzzle', '/products/alphabet-puzzle-user.png', 'Alphabet puzzle'],
    ['BrightBuy Counting Abacus', '/products/abacus-user.png', 'Counting abacus'],
    ['BrightBuy RC Racing Car', '/products/rc-car-user.png', 'Remote-controlled toy car'],
    ['BrightBuy RC Monster Truck', '/products/rc-truck-user.png', 'Remote-controlled monster truck'],
    ['BrightBuy RC Boat', '/products/rc-boat-user.png', 'Remote-controlled boat'],
    ['BrightBuy RC Robot', '/products/toy-robot-user.png', 'Toy robot'],
  ]) {
    const html = render({ data: { ...data, name, image_url: null } })
    assert.match(html, new RegExp(`src="${src}"`))
    assert.match(html, new RegExp(`alt="${alt}"`))
  }
})
test('valid images include meaningful alternative text', () => {
  const html = render({ data: { ...data, image_url: '/phone.png' } })
  assert.match(html, /src="\/phone.png"/)
  assert.match(html, /alt="Demo phone"/)
})
