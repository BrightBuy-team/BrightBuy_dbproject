import assert from 'node:assert/strict'
import { test } from 'node:test'
import { authApiBase, requestSession } from '../src/catalogue/session.ts'

test('account API follows the catalogue deployment or an explicit override', () => {
  assert.equal(authApiBase('http://localhost:8080/api/catalogue'), 'http://localhost:8080/api/auth')
  assert.equal(authApiBase('https://example.com/api/catalogue/'), 'https://example.com/api/auth')
  assert.equal(authApiBase('https://example.com/api/catalogue', ' https://accounts.example.com/api/auth/ '), 'https://accounts.example.com/api/auth')
  for (const base of ['javascript:alert(1)', 'https://user:secret@example.com/api/catalogue',
    'https://example.com/api/catalogue?secret=x', 'https://example.com/api/catalogue#x', 'https://example.com/unknown']) {
    assert.throws(() => authApiBase(base))
  }
})

const user = { id: 1, email: 'customer@example.com', accountType: 'CUSTOMER', role: 'Customer' }
test('session reads use cookies without sending passwords or making mutations', async t => {
  t.mock.method(globalThis, 'fetch', async (url, options) => {
    assert.equal(url, 'http://localhost:8080/api/auth/me')
    assert.equal(options.credentials, 'include')
    assert.equal(options.method, undefined)
    assert.equal(options.body, undefined)
    assert.equal(options.headers.Accept, 'application/json')
    return Response.json({ user })
  })
  assert.deepEqual(await requestSession('http://localhost:8080/api/auth', new AbortController().signal), user)
})
test('only 401 means signed out; other server failures remain errors', async t => {
  const fetchMock = t.mock.method(globalThis, 'fetch', async () => new Response('', { status: 401 }))
  assert.equal(await requestSession('http://localhost/api/auth', new AbortController().signal), null)
  for (const status of [403, 404, 500]) {
    fetchMock.mock.mockImplementation(async () => new Response('secret SQL error', { status }))
    await assert.rejects(requestSession('http://localhost/api/auth', new AbortController().signal), /Account status is unavailable/)
  }
})
test('malformed responses cannot impersonate signed-in users', async t => {
  const fetchMock = t.mock.method(globalThis, 'fetch', async () => Response.json({}))
  for (const body of [{}, { user: null }, { user: { ...user, id: 0 } },
    { user: { ...user, id: '1' } }, { user: { ...user, email: '' } },
    { user: { ...user, accountType: 'UNKNOWN' } }, { user: { ...user, accountType: ['CUSTOMER'] } }]) {
    fetchMock.mock.mockImplementation(async () => Response.json(body))
    await assert.rejects(requestSession('http://localhost/api/auth', new AbortController().signal), /Account status is unavailable/)
  }
  fetchMock.mock.mockImplementation(async () => new Response('<html>Login</html>', { headers: { 'Content-Type': 'text/html' } }))
  await assert.rejects(requestSession('http://localhost/api/auth', new AbortController().signal))
})
test('network failure does not expose raw diagnostics', async t => {
  t.mock.method(globalThis, 'fetch', async () => { throw new Error('private connection details') })
  await assert.rejects(requestSession('http://localhost/api/auth', new AbortController().signal), error =>
    error.message === 'Account status is unavailable. Catalogue browsing still works.')
})
