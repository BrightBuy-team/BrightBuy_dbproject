import assert from 'node:assert/strict'
import { test, after } from 'node:test'
import { createServer } from 'vite'
import { readCard, testCards } from '../src/catalogue/card.ts'
import { csvCell, toCsv } from '../src/catalogue/csv.ts'

const today = new Date(2026, 9, 10)
const entry = { number: '4242 4242 4242 4242', expiry: '12/30', cvv: '123', holderName: ' Test Customer ' }

test('a valid card is read into the fields the backend expects', () => {
  assert.deepEqual(readCard(entry, today),
    { number: '4242424242424242', expiryMonth: 12, expiryYear: 2030, cvv: '123', holderName: 'Test Customer' })
  assert.equal(readCard({ ...entry, expiry: '1/2031' }, today).expiryYear, 2031)
})
test('every advertised test card passes the number check', () => {
  for (const card of testCards) assert.equal(typeof readCard({ ...entry, number: card.number, cvv: '1234' }, today), 'object')
})
test('card mistakes are named before anything is sent', () => {
  assert.match(readCard({ ...entry, number: '4242 4242 4242 4241' }, today), /card number/)
  assert.match(readCard({ ...entry, number: '42' }, today), /card number/)
  assert.match(readCard({ ...entry, expiry: '13/30' }, today), /MM\/YY/)
  assert.match(readCard({ ...entry, expiry: '09/26' }, today), /expired/)
  assert.equal(typeof readCard({ ...entry, expiry: '10/26' }, today), 'object', 'a card is valid through its expiry month')
  assert.match(readCard({ ...entry, cvv: '12a' }, today), /security code/)
  assert.match(readCard({ ...entry, holderName: '  ' }, today), /name/)
})

test('CSV cells are quoted only when needed', () => {
  assert.equal(csvCell('plain'), 'plain')
  assert.equal(csvCell('a,b'), '"a,b"')
  assert.equal(csvCell('say "hi"'), '"say ""hi"""')
  assert.equal(csvCell('two\nlines'), '"two\nlines"')
  assert.equal(csvCell(null), '')
  assert.equal(csvCell(undefined), '')
  assert.equal(csvCell(12.5), '12.5')
})
test('CSV text cannot become a spreadsheet formula, while negative numbers stay numbers', () => {
  for (const text of ['=1+1', '+1', '-1', '@SUM(A1)']) assert.equal(csvCell(text), `'${text}`)
  assert.equal(csvCell('=HYPERLINK("x","y")'), `"'=HYPERLINK(""x"",""y"")"`)
  assert.equal(csvCell(-12.5), '-12.5')
})
test('a CSV file has a header row and CRLF line endings', () => {
  assert.equal(toCsv(['Quarter', 'Revenue'], [['Q1', 10], ['Q2', null]]), 'Quarter,Revenue\r\nQ1,10\r\nQ2,\r\n')
})

const vite = await createServer({ server: { middlewareMode: true, hmr: false, ws: false, watch: null }, appType: 'custom' })
after(() => vite.close())
const { ApiError, apiRequest } = await vite.ssrLoadModule('/src/catalogue/client.ts')

async function withResponse(response, run) {
  const original = globalThis.fetch
  globalThis.fetch = async () => response
  try { await run() } finally { globalThis.fetch = original }
}
test('a refused request carries its status and the server\'s JSON answer', async () => {
  const body = JSON.stringify({ status: 'ITEM_UNAVAILABLE', orderId: null, unavailableVariantIds: [7] })
  await withResponse(new Response(body, { status: 409, headers: { 'content-type': 'application/json' } }), () =>
    assert.rejects(() => apiRequest('https://example.invalid/api/checkout'), failure => failure instanceof ApiError
      && failure.status === 409 && failure.body.status === 'ITEM_UNAVAILABLE'
      && failure.body.unavailableVariantIds[0] === 7 && /Stock or records changed/.test(failure.message)))
})
test('a declined card is reported with its status', async () => {
  await withResponse(new Response('{"status":"CARD_DECLINED"}', { status: 402, headers: { 'content-type': 'application/json' } }), () =>
    assert.rejects(() => apiRequest('https://example.invalid/api/checkout'),
      failure => failure.status === 402 && failure.body.status === 'CARD_DECLINED'))
})
test('an error page is never kept as the answer', async () => {
  await withResponse(new Response('<html>private SQL details</html>', { status: 500, headers: { 'content-type': 'text/html' } }), () =>
    assert.rejects(() => apiRequest('https://example.invalid'),
      failure => failure.status === 500 && failure.body === null && !failure.message.includes('SQL')))
  await withResponse(new Response('not json', { status: 400, headers: { 'content-type': 'application/json' } }), () =>
    assert.rejects(() => apiRequest('https://example.invalid'), failure => failure.status === 400 && failure.body === null))
})
