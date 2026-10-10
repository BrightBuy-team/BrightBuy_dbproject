// End-to-end HTTP tests against a running backend and its disposable MySQL container.
// Started by scripts/verify-project.sh, which supplies the settings below. The script
// refuses anything but a loopback API and a container labelled as disposable.
import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'

const container = process.env.BRIGHTBUY_TEST_CONTAINER
const base = process.env.BRIGHTBUY_TEST_API
const adminEmail = process.env.BRIGHTBUY_TEST_ADMIN_EMAIL
const adminPassword = process.env.BRIGHTBUY_TEST_ADMIN_PASSWORD
assert.ok(container && base && adminEmail && adminPassword, 'Run this through scripts/verify-project.sh')
assert.ok(['127.0.0.1', 'localhost'].includes(new URL(base).hostname), 'Only a loopback API is allowed')
const label = execFileSync('docker', ['inspect', '--format', '{{index .Config.Labels "com.brightbuy.purpose"}}', container], { encoding: 'utf8' }).trim()
assert.equal(label, 'disposable-integration', 'Refusing a database that is not labelled as disposable')

function sql(query) {
  return execFileSync('docker', ['exec', '-i', container, 'sh', '-c',
    'MYSQL_PWD="$MYSQL_ROOT_PASSWORD" exec mysql -u root --batch --skip-column-names brightbuy'], { input: query, encoding: 'utf8' }).trim()
}
const count = query => Number(sql(query))

let passed = 0
function check(condition, message) { assert.ok(condition, message); console.log('PASS ' + message); passed++ }
function expectStatus(response, status, message) {
  assert.equal(response.status, status, message + ': ' + JSON.stringify(response.body))
  console.log('PASS ' + message); passed++
}

/** A browser stand-in: keeps its own cookies and fetches a CSRF token before each write. */
function client() {
  const cookies = new Map()
  async function request(path, method = 'GET', body, csrf = true) {
    const headers = { Accept: 'application/json' }
    if (method !== 'GET' && csrf) headers['X-XSRF-TOKEN'] = (await request('/api/auth/csrf')).body.token
    if (body !== undefined) headers['Content-Type'] = 'application/json'
    headers.Cookie = [...cookies].map(([name, value]) => name + '=' + value).join('; ')
    const response = await fetch(base + path, { method, headers, body: body === undefined ? undefined : JSON.stringify(body), signal: AbortSignal.timeout(15000) })
    for (const cookie of response.headers.getSetCookie()) {
      const [pair] = cookie.split(';')
      cookies.set(pair.slice(0, pair.indexOf('=')), pair.slice(pair.indexOf('=') + 1))
    }
    const text = await response.text()
    let data
    try { data = JSON.parse(text) } catch { data = text }
    return { status: response.status, body: data }
  }
  return { request, login: (email, password, accountType) => request('/api/auth/login', 'POST', { email, password, accountType }) }
}

const tag = Date.now().toString()
const today = new Date()
const isoDay = offset => { const date = new Date(sql('SELECT CURDATE()') + 'T00:00:00Z'); date.setUTCDate(date.getUTCDate() + offset); return date.toISOString().slice(0, 10) }

// Before any write: prove the API reads THIS disposable database. A local backend could
// otherwise have been pointed at a shared one.
const probeId = count(`CALL sp_catalogue_create_product('TEST-PROBE-${tag}','Disposable API probe',NULL,NULL,1,1,1.00,1,@probe);SELECT @probe;`)
const probe = await fetch(base + '/api/catalogue/products/' + probeId, { signal: AbortSignal.timeout(10000) })
assert.equal(probe.status, 200, 'The API does not read the disposable database; refusing to write')
assert.equal((await probe.json()).sku, 'TEST-PROBE-' + tag, 'The API is connected to a different database; refusing to write')

const email = `integration-${tag}@example.invalid`
const password = 'DisposableFixtureOnly2026'
const guest = client(), customer = client(), staff = client(), manager = client(), admin = client()

// ---- Public pages and customer accounts -------------------------------------------------
expectStatus(await guest.request('/api/catalogue/products'), 200, 'anonymous catalogue browsing')
expectStatus(await guest.request('/api/inventory/variants'), 401, 'anonymous inventory denied')
const cities = await guest.request('/api/delivery/cities')
check(cities.status === 200 && cities.body.length >= 4 && cities.body.every(city => typeof city.isMainCity === 'boolean' && city.name),
  'delivery cities are public and say which are main cities')
const inStock = await guest.request('/api/delivery/preview?cityId=1&variantIds=1')
check(inStock.status === 200 && inStock.body.estimated_delivery_date === isoDay(5), 'delivery preview: main city, in stock, 5 days')
const delayed = await guest.request('/api/delivery/preview?cityId=1&variantIds=1,3')
check(delayed.body.estimated_delivery_date === isoDay(8), 'delivery preview adds 3 days when an item is out of stock')
const beyondStock = await guest.request('/api/delivery/preview?cityId=1&variantIds=1&quantities=100000')
check(beyondStock.body.estimated_delivery_date === isoDay(8), 'delivery preview adds 3 days when a line asks for more than is in stock')
expectStatus(await guest.request('/api/delivery/preview?cityId=1&variantIds=1,3&quantities=1'), 400, 'delivery preview needs one quantity per variant')
expectStatus(await guest.request('/api/delivery/preview?cityId=2147483647&variantIds=1'), 400, 'delivery preview rejects an unknown city')

const registered = await customer.request('/api/auth/register', 'POST',
  { firstName: 'Integration', lastName: 'Fixture', email, password, phone: '555-0100', addressLine: '1 Saved Address Road', cityId: 1 })
expectStatus(registered, 200, 'customer registration')
const customerId = registered.body.customerId
expectStatus(await guest.request('/api/auth/register', 'POST', { firstName: 'Again', lastName: 'Fixture', email, password }), 409, 'duplicate email rejected')
check(count(`SELECT COUNT(*) FROM email_outbox WHERE recipient='${email}' AND category='registration'`) === 1, 'registration email queued')
const login = await customer.login(email, password, 'CUSTOMER')
check(login.status === 200 && login.body.user.id === customerId, 'customer login starts a session')
expectStatus(await customer.request('/api/auth/me'), 200, 'session cookie round trip')
const address = await customer.request('/api/addresses/me')
check(address.status === 200 && address.body.addressLine === '1 Saved Address Road' && address.body.cityId === 1, 'registration saved the delivery address')
for (const path of ['/api/inventory/variants', '/api/catalogue/staff/products', '/api/reports/category-order-counts']) {
  expectStatus(await customer.request(path), 403, 'customer denied ' + path)
}

// ---- Employees: the bootstrap administrator creates the rest ----------------------------
const adminLogin = await admin.login(adminEmail, adminPassword, 'EMPLOYEE')
expectStatus(adminLogin, 200, 'bootstrap administrator can sign in')
const adminId = adminLogin.body.user.id
const employee = (role, name) => ({ firstName: 'Test', lastName: name, email: `${name.toLowerCase()}-${tag}@example.invalid`, password, role })
expectStatus(await customer.request('/api/auth/employees', 'POST', employee('ADMIN', 'Intruder')), 403, 'customer cannot create employees')
const staffAccount = await admin.request('/api/auth/employees', 'POST', employee('WAREHOUSE_STAFF', 'Staff'))
expectStatus(staffAccount, 201, 'administrator creates a warehouse account')
expectStatus(await admin.request('/api/auth/employees', 'POST', employee('MANAGEMENT', 'Manager')), 201, 'administrator creates a management account')
const staffId = staffAccount.body.employeeId
check(count(`SELECT COUNT(*) FROM audit_log WHERE entity_type='employee' AND entity_id=${staffId} AND action='INSERT' AND actor='employee:${adminId}'`) === 1,
  'employee creation is audited with the administrator')
check(count(`SELECT COUNT(*) FROM audit_log WHERE entity_type='employee' AND (old_values LIKE '%$2%' OR new_values LIKE '%$2%')`) === 0,
  'the audit log holds no password hashes')
expectStatus(await staff.login(`staff-${tag}@example.invalid`, password, 'EMPLOYEE'), 200, 'warehouse staff login')
expectStatus(await staff.request('/api/auth/employees', 'POST', employee('WAREHOUSE_STAFF', 'Second')), 403, 'warehouse staff cannot create employees')
expectStatus(await staff.request('/api/orders'), 403, 'employee cannot read customer orders')
expectStatus(await staff.request('/api/addresses/me'), 403, 'employee cannot read customer addresses')
expectStatus(await staff.request('/api/checkout', 'POST', { cartItems: [{ variantId: 1, quantity: 1 }], deliveryMode: 'pickup', paymentMethod: 'cod' }), 403, 'employee checkout denied')

// ---- Inventory ---------------------------------------------------------------------------
expectStatus(await staff.request('/api/inventory/variants/1/stock?quantity=5', 'PUT', undefined, false), 403, 'stock change without a CSRF token rejected')
expectStatus(await staff.request('/api/inventory/variants/1/stock?quantity=-1', 'PUT'), 400, 'negative stock rejected')
expectStatus(await staff.request('/api/inventory/variants/2147483647/stock?quantity=1', 'PUT'), 404, 'stock change for a missing variant is not found')
const variants = await staff.request('/api/inventory/variants')
check(variants.status === 200 && variants.body.every(variant => variant.productName && variant.sku), 'inventory list names each product')
check(count('SELECT COUNT(*) FROM warehouse') === 1 && new Set(variants.body.map(variant => variant.warehouseId)).size === 1, 'all stock is held in the one central warehouse')
const stockBefore = count('SELECT stock_quantity FROM variant WHERE variant_id=1')
const stockChange = await staff.request('/api/inventory/variants/1/stock?quantity=' + (stockBefore + 1), 'PUT')
check(stockChange.status === 200 && stockChange.body.stockQuantity === stockBefore + 1, 'staff stock update returns the stored value')
check(sql('SELECT changed_by FROM variant_audit WHERE variant_id=1 ORDER BY audit_id DESC LIMIT 1') === 'employee:' + staffId, 'stock audit names the signed-in employee')
check((await staff.request('/api/inventory/low-stock?threshold=1')).body.every(variant => variant.stockQuantity < 1), 'low-stock list uses the threshold')

// ---- Catalogue maintenance ----------------------------------------------------------------
const sku = 'TEST-INTEGRATION-' + tag
const product = { sku, name: 'Integration phone', description: 'Disposable fixture', imageUrl: null, categoryId: 1, warehouseId: 1, price: 123.45, stock: 3 }
expectStatus(await staff.request('/api/catalogue/staff/products', 'POST', { ...product, warehouseId: 2147483647 }), 404, 'product with a missing warehouse is refused')
check(count(`SELECT COUNT(*) FROM product WHERE sku='${sku}'`) === 0, 'the refused product left nothing behind')
const created = await staff.request('/api/catalogue/staff/products', 'POST', product)
expectStatus(created, 201, 'staff creates a product')
const productId = created.body.productId
const variantId = count('SELECT variant_id FROM variant WHERE product_id=' + productId)
check(productId > 0 && variantId > 0 && count('SELECT COUNT(*) FROM product_category WHERE product_id=' + productId) === 1, 'product, category and first variant are created together')
expectStatus(await staff.request('/api/catalogue/staff/products', 'POST', product), 409, 'duplicate SKU rejected')
check(count(`SELECT COUNT(*) FROM audit_log WHERE entity_type='product' AND entity_id=${productId} AND actor='employee:${staffId}'`) === 1, 'catalogue audit names the signed-in employee')
expectStatus(await staff.request('/api/catalogue/staff/products/' + productId, 'PUT', { ...product, name: 'Updated integration phone' }), 200, 'product edit')
expectStatus(await staff.request('/api/catalogue/staff/products/' + productId + '/active', 'PATCH', { active: false }), 200, 'product retirement')
expectStatus(await guest.request('/api/catalogue/products/' + productId), 404, 'retired product is hidden from customers')
await staff.request('/api/catalogue/staff/products/' + productId + '/active', 'PATCH', { active: true })
expectStatus(await staff.request('/api/catalogue/staff/products/' + productId + '/categories/1', 'DELETE'), 400, 'the last category cannot be removed')
const category = await staff.request('/api/catalogue/staff/categories', 'POST', { name: 'Integration category ' + tag, description: 'Test category', parentCategoryId: null, active: true })
expectStatus(category, 201, 'staff creates a category')
const categoryId = category.body.categoryId
expectStatus(await staff.request('/api/catalogue/staff/categories/' + categoryId, 'PUT', { name: 'Integration category ' + tag, description: 'Edited', parentCategoryId: null, active: true }), 200, 'staff edits a category')
expectStatus(await staff.request(`/api/catalogue/staff/products/${productId}/categories/${categoryId}`, 'POST'), 200, 'staff assigns a category')
expectStatus(await staff.request(`/api/catalogue/staff/products/${productId}/categories/${categoryId}`, 'DELETE'), 200, 'staff removes a category that is not the last')

const secondVariant = await staff.request('/api/inventory/variants', 'POST', { productId, variantName: 'Integration phone - Blue 256GB', colour: 'Blue', memorySize: '256GB', price: 150, stock: 0 })
check(secondVariant.status === 201 && secondVariant.body.variantId > 0 && secondVariant.body.productId === productId, 'staff adds a second variant')
check(secondVariant.body.warehouseId === variants.body[0].warehouseId, 'a new variant goes to the central warehouse without being told')
const repriced = await staff.request('/api/inventory/variants/' + secondVariant.body.variantId, 'PUT', { variantName: 'Integration phone - Blue 256GB', colour: 'Blue', memorySize: '256GB', price: 149.5 })
check(repriced.status === 200 && Number(repriced.body.price) === 149.5, 'staff changes a variant price')
check(count(`SELECT COUNT(*) FROM audit_log WHERE entity_type='variant' AND entity_id=${secondVariant.body.variantId} AND action='UPDATE' AND actor='employee:${staffId}'`) === 1, 'price change is audited')
expectStatus(await staff.request('/api/inventory/variants', 'POST', { productId: 2147483647, variantName: 'Orphan', price: 1, stock: 0 }), 404, 'variant for a missing product is refused')
expectStatus(await staff.request('/api/inventory/variants/' + secondVariant.body.variantId, 'PUT', { variantName: 'Free', price: 0 }), 400, 'zero price rejected')

// ---- Checkout: validation, card payment, cash on delivery ---------------------------------
const checkout = { cartItems: [{ variantId, quantity: 1 }], deliveryMode: 'delivery', paymentMethod: 'cod', cityId: 1, addressLine: '101 Integration Test Street' }
const card = { number: '4242424242424242', expiryMonth: 12, expiryYear: today.getFullYear() + 2, cvv: '123', holderName: 'Integration Fixture' }
let ordersBefore = count('SELECT COUNT(*) FROM orders')
const paymentsBefore = count('SELECT COUNT(*) FROM payment')
const stockAtStart = sql('SELECT stock_quantity FROM variant WHERE variant_id=' + variantId)
const refused = async (body, status, code, message) => {
  const response = await customer.request('/api/checkout', 'POST', body)
  assert.equal(response.status, status, message + ': ' + JSON.stringify(response.body))
  if (code) assert.equal(response.body.status, code, message)
  console.log('PASS ' + message); passed++
  return response
}
await refused({ ...checkout, cartItems: [] }, 400, null, 'empty cart rejected')
await refused({ ...checkout, cartItems: [{ variantId, quantity: 1.5 }] }, 400, null, 'fractional quantity rejected')
await refused({ ...checkout, cartItems: [{ variantId, quantity: 1 }, { variantId, quantity: 1 }] }, 400, 'DUPLICATE_VARIANTS_IN_CART', 'duplicate cart lines rejected')
await refused({ ...checkout, addressLine: null }, 400, 'INVALID_DELIVERY_ADDRESS', 'delivery without an address rejected')
await refused({ ...checkout, paymentMethod: 'card' }, 400, 'INVALID_PAYMENT_DETAILS', 'card payment without card details rejected')
await refused({ ...checkout, paymentMethod: 'card', card: { ...card, number: '4242424242424241' } }, 400, 'INVALID_CARD', 'mistyped card number rejected')
await refused({ ...checkout, paymentMethod: 'card', card: { ...card, expiryYear: today.getFullYear() - 1 } }, 400, 'INVALID_CARD', 'expired card rejected')
await refused({ ...checkout, paymentMethod: 'card', card: { ...card, number: '4000000000000002' } }, 402, 'CARD_DECLINED', 'declined card creates no order')
const unsold = await refused({ ...checkout, cartItems: [{ variantId, quantity: 1 }, { variantId: 2147483647, quantity: 1 }] }, 409, 'ITEM_UNAVAILABLE', 'one item that is not sold refuses the whole order')
check(unsold.body.unavailableVariantIds.length === 1 && unsold.body.unavailableVariantIds[0] === 2147483647, 'the refusal names the line to remove')
await refused({ ...checkout, paymentMethod: 'card', card, cartItems: [{ variantId: 2147483647, quantity: 1 }] }, 409, 'ITEM_UNAVAILABLE', 'a card is not charged for an order that cannot be placed')
check(sql('SELECT stock_quantity FROM variant WHERE variant_id=' + variantId) === stockAtStart && count('SELECT COUNT(*) FROM orders') === ordersBefore
  && count('SELECT COUNT(*) FROM payment') === paymentsBefore, 'no refused checkout changed stock, orders or payments')
check(sql(`CALL ProcessCheckout(${customerId},JSON_ARRAY(JSON_OBJECT('variantId',${variantId},'quantity',0.5)),'pickup','cod',NULL,NULL,NULL,NULL,NULL,NULL,NULL,@status,@order);SELECT @status;`) === 'INVALID_CART',
  'the database also rejects a fractional quantity')

const cod = await customer.request('/api/checkout', 'POST', { ...checkout, customerId: 1, totalAmount: 0 })
expectStatus(cod, 201, 'cash-on-delivery order placed')
const orderId = cod.body.orderId
check(sql('SELECT customer_id FROM orders WHERE order_id=' + orderId) === String(customerId), 'a customer ID in the request cannot place an order for someone else')
check(sql('SELECT total_amount FROM orders WHERE order_id=' + orderId) === '123.45', 'the database price is the price charged')
check(sql('SELECT address_line FROM delivery WHERE order_id=' + orderId) === '101 Integration Test Street', 'the delivery address at purchase time is stored')
check(sql('SELECT payment_status FROM payment WHERE order_id=' + orderId) === 'Pending', 'cash on delivery leaves the payment pending')
check(sql(`SELECT changed_by FROM variant_audit WHERE variant_id=${variantId} ORDER BY audit_id DESC LIMIT 1`) === 'customer:' + customerId, 'checkout stock change is audited with the customer')
check(count(`SELECT COUNT(*) FROM email_outbox WHERE recipient='${email}' AND category='order_confirmation' AND related_id=${orderId}`) === 1, 'order confirmation email queued')

const paid = await customer.request('/api/checkout', 'POST', { ...checkout, paymentMethod: 'card', card })
expectStatus(paid, 201, 'card order placed with a test card')
check(sql(`SELECT CONCAT_WS('|',payment_method,payment_status,card_type,card_last_four,gateway_token LIKE 'tok_sim_%',gateway_reference IS NOT NULL) FROM payment WHERE order_id=${paid.body.orderId}`)
  === 'card|Paid|Visa|4242|1|1', 'card payment is recorded as paid with token, type and last four digits')
check(count(`SELECT (SELECT COUNT(*) FROM payment WHERE CONCAT_WS('|',gateway_token,gateway_reference,card_last_four) LIKE '%${card.number}%')
  + (SELECT COUNT(*) FROM email_outbox WHERE body LIKE '%${card.number}%') + (SELECT COUNT(*) FROM audit_log WHERE new_values LIKE '%${card.number}%')`) === 0,
  'the card number is stored nowhere')

expectStatus(await customer.request('/api/addresses/me', 'PUT', { addressLine: '202 Changed Profile Street', cityId: 2 }), 200, 'customer updates the saved address')
expectStatus(await customer.request('/api/addresses/me', 'PUT', { addressLine: '202 Changed Profile Street', cityId: 2147483647 }), 400, 'unknown city rejected')
check(sql('SELECT address_line FROM delivery WHERE order_id=' + orderId) === '101 Integration Test Street', 'a profile change does not rewrite an earlier delivery')

const history = await customer.request('/api/orders')
const codOrder = history.body.find(order => order.orderId === orderId)
const cardOrder = history.body.find(order => order.orderId === paid.body.orderId)
check(history.status === 200 && codOrder && cardOrder, 'order history lists the new orders')
check(codOrder.items.length === 1 && Number(codOrder.items[0].unitPrice) === 123.45 && codOrder.items[0].productSku === sku
  && codOrder.items[0].backorderedQuantity === 0
  && codOrder.deliveryCity && codOrder.estDeliveryDate === isoDay(5) && codOrder.paymentMethod === 'cod', 'order history shows lines, price paid and delivery estimate')
check(cardOrder.cardType === 'Visa' && cardOrder.cardLastFour === '4242' && cardOrder.paymentStatus === 'Paid', 'order history shows the card type and last four digits only')
expectStatus(await customer.request('/api/delivery/estimate?cityId=1&orderId=' + orderId), 200, 'own delivery estimate')
expectStatus(await customer.request('/api/delivery/estimate?cityId=1&orderId=101'), 404, 'another customer\'s delivery is not exposed')
expectStatus(await customer.request('/api/delivery/estimate?cityId=2&orderId=' + orderId), 400, 'the request cannot replace the order\'s destination')

const pickup = await customer.request('/api/checkout', 'POST', { ...checkout, deliveryMode: 'pickup', cityId: null, addressLine: null })
expectStatus(pickup, 201, 'store pickup needs no address')
check(sql('SELECT IF(city_id IS NULL AND est_delivery_date IS NULL,1,0) FROM delivery WHERE order_id=' + pickup.body.orderId) === '1', 'pickup has no delivery date')

// ---- Out of stock at the time of order: back-ordered, 3 days later -------------------------
// Seed variant 3 has no stock. The order is accepted, nothing leaves stock, the estimate is 7 + 3.
const backorder = await customer.request('/api/checkout', 'POST', { ...checkout, cityId: 3, cartItems: [{ variantId: 3, quantity: 2 }] })
expectStatus(backorder, 201, 'an out-of-stock item can be ordered')
check(sql(`SELECT CONCAT_WS('|', quantity, backordered_quantity) FROM order_item WHERE order_id=${backorder.body.orderId}`) === '2|2'
  && sql('SELECT stock_quantity FROM variant WHERE variant_id=3') === '0', 'the whole line is back-ordered and stock stays at zero')
const backorderSummary = (await customer.request('/api/orders')).body.find(order => order.orderId === backorder.body.orderId)
check(backorderSummary.estDeliveryDate === isoDay(10) && backorderSummary.items[0].backorderedQuantity === 2, 'the customer sees the 3-day delay and the back-ordered quantity')
check(count(`SELECT COUNT(*) FROM email_outbox WHERE related_id=${backorder.body.orderId} AND category='order_confirmation' AND body LIKE '%will follow%'`) === 1, 'the confirmation email mentions the back-order')

// ---- Concurrency (SAF-1, SAF-2) ------------------------------------------------------------
await staff.request(`/api/inventory/variants/${variantId}/stock?quantity=1`, 'PUT')
ordersBefore = count('SELECT COUNT(*) FROM orders')
const raced = await Promise.all([customer.request('/api/checkout', 'POST', checkout), customer.request('/api/checkout', 'POST', checkout)])
const racedIds = raced.map(result => result.body.orderId).join(',')
check(raced.every(result => result.status === 201) && count('SELECT COUNT(*) FROM orders') === ordersBefore + 2, 'two orders at once for the last unit are both accepted')
check(sql(`SELECT GROUP_CONCAT(backordered_quantity ORDER BY backordered_quantity) FROM order_item WHERE order_id IN (${racedIds})`) === '0,1'
  && sql('SELECT stock_quantity FROM variant WHERE variant_id=' + variantId) === '0', 'the last unit is sold exactly once: one order gets it, the other is back-ordered, stock is zero');
check(sql(`SELECT GROUP_CONCAT(DATEDIFF(est_delivery_date,DATE(order_date)) ORDER BY DATEDIFF(est_delivery_date,DATE(order_date))) FROM delivery JOIN orders USING(order_id) WHERE order_id IN (${racedIds})`) === '5,8',
  'the buyer of the last unit keeps 5 days; the back-order gets 8')
await staff.request(`/api/inventory/variants/${variantId}/stock?quantity=20`, 'PUT')
const buyers = Array.from({ length: 20 }, () => client())
for (const buyer of buyers) assert.equal((await buyer.login(email, password, 'CUSTOMER')).status, 200)
const started = performance.now()
const concurrent = await Promise.all(buyers.map(async (buyer, index) => {
  const time = performance.now()
  const body = { ...checkout, deliveryMode: 'pickup', cityId: null, addressLine: null, ...(index % 2 ? { paymentMethod: 'card', card } : {}) }
  return { ...await buyer.request('/api/checkout', 'POST', body), ms: Math.round(performance.now() - time) }
}))
check(concurrent.every(result => result.status === 201) && new Set(concurrent.map(result => result.body.orderId)).size === 20, '20 sessions at once each place exactly one order')
check(sql('SELECT stock_quantity FROM variant WHERE variant_id=' + variantId) === '0'
  && count(`SELECT SUM(backordered_quantity) FROM order_item WHERE order_id IN (${concurrent.map(result => result.body.orderId).join(',')})`) === 0,
  '20 orders at once take exactly the 20 units in stock, none back-ordered')
check(count('SELECT COUNT(*) FROM variant WHERE stock_quantity < 0') === 0, 'no variant ever has negative stock')
console.log(`MEASUREMENT 20 concurrent checkouts: elapsed_ms=${Math.round(performance.now() - started)}, max_ms=${Math.max(...concurrent.map(result => result.ms))}`)

// ---- Reports -----------------------------------------------------------------------------
const managerLogin = await manager.login(`manager-${tag}@example.invalid`, password, 'EMPLOYEE')
expectStatus(managerLogin, 200, 'management login')
expectStatus(await staff.request('/api/reports/category-order-counts'), 403, 'warehouse staff cannot run reports')
sql('CALL sp_populate_sales_summary(7)')
const year = Number(sql('SELECT YEAR(CURDATE())'))
for (const path of [`quarterly-sales?year=${year}`, `top-selling-products?startDate=${year}-01-01&endDate=${year}-12-31&topN=10`, 'category-order-counts', 'delivery-estimates', 'customer-order-summary']) {
  const result = await manager.request('/api/reports/' + path + (path.includes('?') ? '&' : '?') + 'employeeId=' + staffId)
  check(result.status === 200 && Array.isArray(result.body), 'management report ' + path.split('?')[0])
}
check(sql('SELECT employee_id FROM report_access_log ORDER BY log_id DESC LIMIT 1') === String(managerLogin.body.user.id), 'report log ignores an employee ID in the request')
const quarterly = await manager.request('/api/reports/quarterly-sales?year=' + year)
const expectedRevenue = Number(sql(`SELECT SUM(total_amount) FROM orders WHERE YEAR(order_date)=${year} AND QUARTER(order_date)=QUARTER(CURDATE()) AND order_status<>'Cancelled'`))
check(Number(quarterly.body.find(row => row.quarter === Number(sql('SELECT QUARTER(CURDATE())'))).totalRevenue) === expectedRevenue, 'quarterly revenue includes today and excludes cancelled orders')
const top = await manager.request(`/api/reports/top-selling-products?startDate=${year}-01-01&endDate=${year}-12-31&topN=100`)
check(top.status === 200 && top.body.some(row => row.productId === productId), 'top products include today\'s sales')
expectStatus(await manager.request(`/api/reports/top-selling-products?startDate=${year}-12-31&endDate=${year}-01-01`), 400, 'reversed date range rejected')
expectStatus(await manager.request(`/api/reports/top-selling-products?startDate=${year}-01-01&endDate=${year}-12-31&topN=101`), 400, 'oversized report rejected')

// ---- Password recovery (UI-7) ----------------------------------------------------------------
const resetBody = { email, accountType: 'CUSTOMER' }
const resetCode = () => (/code to choose a new password: ([A-Za-z0-9_-]{32,})/.exec(
  sql(`SELECT body FROM email_outbox WHERE recipient='${email}' AND category='password_reset' ORDER BY email_id DESC LIMIT 1`)) ?? [])[1]
const known = await guest.request('/api/auth/password-reset/request', 'POST', resetBody)
const unknown = await guest.request('/api/auth/password-reset/request', 'POST', { ...resetBody, email: `nobody-${tag}@example.invalid` })
check(known.status === 202 && unknown.status === 202 && known.body.message === unknown.body.message, 'a reset request does not reveal whether the account exists')
check(count(`SELECT COUNT(*) FROM email_outbox WHERE recipient='nobody-${tag}@example.invalid'`) === 0, 'no email is queued for an unknown account')
const code = resetCode()
check(typeof code === 'string' && count(`SELECT COUNT(*) FROM password_reset_token WHERE token_hash='${code}'`) === 0
  && count(`SELECT COUNT(*) FROM password_reset_token WHERE token_hash=SHA2('${code}',256) AND used_at IS NULL`) === 1, 'the reset code is emailed and only its hash is stored')
const newPassword = 'ReplacementFixture2026'
expectStatus(await guest.request('/api/auth/password-reset/confirm', 'POST', { code: 'x'.repeat(43), newPassword }), 400, 'a wrong reset code is refused')
expectStatus(await guest.request('/api/auth/password-reset/confirm', 'POST', { code, newPassword: 'short' }), 400, 'a weak new password is refused')
expectStatus(await guest.request('/api/auth/password-reset/confirm', 'POST', { code, newPassword }), 204, 'the emailed code sets a new password')
expectStatus(await guest.request('/api/auth/password-reset/confirm', 'POST', { code, newPassword: password }), 400, 'a reset code works once')
check(resetCode() === undefined, 'the used code is removed from the stored email')
expectStatus(await client().login(email, password, 'CUSTOMER'), 401, 'the old password no longer works')
expectStatus(await client().login(email, newPassword, 'CUSTOMER'), 200, 'the new password works')

// ---- Emails, disabled accounts, sign-out ----------------------------------------------------
for (let attempt = 0; attempt < 30 && count("SELECT COUNT(*) FROM email_outbox WHERE status='Pending'") > 0; attempt++) await new Promise(resolve => setTimeout(resolve, 500))
check(count("SELECT COUNT(*) FROM email_outbox WHERE status='Pending'") === 0 && count("SELECT COUNT(*) FROM email_outbox WHERE status='Sent' AND sent_at IS NOT NULL") > 20,
  'queued emails are handed to the email service')
sql('UPDATE employee SET is_active=FALSE WHERE employee_id IN (' + staffId + ',' + adminId + ')')
expectStatus(await staff.request('/api/catalogue/staff/products'), 403, 'a disabled employee\'s open session loses staff access')
expectStatus(await admin.request('/api/auth/employees', 'POST', employee('ADMIN', 'Late')), 403, 'a disabled administrator\'s open session cannot create employees')
expectStatus(await customer.request('/api/auth/logout', 'POST'), 204, 'sign-out')
expectStatus(await customer.request('/api/auth/me'), 401, 'sign-out ends the session')
console.log('PASS ' + passed + ' HTTP and MySQL integration checks')
