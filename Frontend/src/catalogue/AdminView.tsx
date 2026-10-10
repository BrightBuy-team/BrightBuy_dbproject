import { useState } from 'react'
import type { FormEvent } from 'react'
import { ApiError, apiBase, apiRequest } from './client'

type Employee = { employeeId: number; email: string; role: string }

/** Administrators create the staff accounts; customers register themselves (BR-14). */
export default function AdminView() {
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  async function create(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const form = event.currentTarget
    const data = new FormData(form)
    const field = (name: string) => String(data.get(name) ?? '').trim()
    setBusy(true); setError(''); setMessage('')
    try {
      const employee = await apiRequest<Employee>(apiBase('auth') + '/employees', { method: 'POST', body: JSON.stringify({
        firstName: field('firstName'), lastName: field('lastName'), email: field('email'),
        password: String(data.get('password') ?? ''), contactNo: field('contactNo') || null, role: field('role'),
      }) })
      setMessage(`Created ${employee.role} account #${employee.employeeId} for ${employee.email}.`)
      form.reset()
    } catch (failure) {
      const body = failure instanceof ApiError ? failure.body : null
      setError(failure instanceof ApiError && failure.status === 409 ? 'An employee with that email already exists.'
        : body && typeof body === 'object' && 'message' in body && typeof body.message === 'string' ? body.message
        : (failure as Error).message)
    } finally { setBusy(false) }
  }

  return <section className="catalogue-detail-state">
    <h1>Staff accounts</h1>
    <p>An admin account is required. The new employee signs in with this email and password, choosing the Employee account type.</p>
    <form className="catalogue-form" onSubmit={create}>
      <label>First name<input name="firstName" required maxLength={100} /></label>
      <label>Last name<input name="lastName" required maxLength={100} /></label>
      <label>Email<input name="email" type="email" required maxLength={150} autoComplete="off" /></label>
      <label>Temporary password (8 or more characters)<input name="password" type="password" required minLength={8} maxLength={72} autoComplete="new-password" /></label>
      <label>Contact number (optional)<input name="contactNo" type="tel" maxLength={20} /></label>
      <label>Role<select name="role" required>
        <option value="WAREHOUSE_STAFF">Warehouse staff</option>
        <option value="MANAGEMENT">Management</option>
        <option value="ADMIN">Admin</option>
      </select></label>
      {error && <p role="alert">{error}</p>}
      {message && <p role="status">{message}</p>}
      <button className="catalogue-primary" disabled={busy}>{busy ? 'Creating…' : 'Create employee account'}</button>
    </form>
    <a href="/catalogue.html">Back to catalogue</a>
  </section>
}
