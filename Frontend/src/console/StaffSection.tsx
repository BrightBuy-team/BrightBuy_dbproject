import { useState } from 'react'
import type { FormEvent } from 'react'
import { ShieldCheck, UserPlus } from 'lucide-react'
import { AnimatePresence, motion } from 'framer-motion'
import { ApiError, apiBase, apiRequest } from '../catalogue/client'
import { Feedback, PageHeader } from './parts'
import { roleTitles } from './roles'

type Employee = { employeeId: number; email: string; role: string }

const roleNotes = [
  { value: 'WAREHOUSE_STAFF', title: 'Warehouse staff', text: 'Stock, variants, products and categories.' },
  { value: 'DELIVERY_DRIVER', title: 'Delivery driver', text: 'See assigned pending deliveries and mark them delivered.' },
  { value: 'MANAGEMENT', title: 'Management', text: 'The five sales reports. Read only.' },
  { value: 'ADMIN', title: 'Administrator', text: 'Everything warehouse staff can do, plus staff accounts.' },
]

/** Administrators create the staff accounts; customers register themselves (BR-14). */
export default function StaffSection() {
  const [created, setCreated] = useState<Employee[]>([])
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [busy, setBusy] = useState(false)

  async function create(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const form = event.currentTarget
    const data = new FormData(form)
    const field = (name: string) => String(data.get(name) ?? '').trim()
    if (data.get('password') !== data.get('confirmPassword')) { setError('The two passwords do not match.'); return }
    setBusy(true); setError(''); setNotice('')
    try {
      const employee = await apiRequest<Employee>(apiBase('auth') + '/employees', { method: 'POST', body: JSON.stringify({
        firstName: field('firstName'), lastName: field('lastName'), email: field('email'),
        password: String(data.get('password') ?? ''), contactNo: field('contactNo') || null, role: field('role'),
      }) })
      setCreated(current => [employee, ...current])
      setNotice(`Account created for ${employee.email}.`)
      form.reset()
    } catch (failure) {
      const body = failure instanceof ApiError ? failure.body : null
      setError(failure instanceof ApiError && failure.status === 409 ? 'An employee with that email already exists.'
        : body && typeof body === 'object' && 'message' in body && typeof body.message === 'string' ? body.message
        : (failure as Error).message)
    } finally { setBusy(false) }
  }

  return <div className="console-page">
    <PageHeader eyebrow="Administration" title="Staff accounts"
      text="Create an account for each employee. They sign in on the employee or admin sign-in page with the email and password you set here." />
    <Feedback notice={notice} error={error} />
    <div className="console-grid-2 wide-left">
      <form className="bb-card bb-card-pad bb-form" onSubmit={create}>
        <h2 className="bb-card-title"><UserPlus aria-hidden="true" /> New employee</h2>
        <div className="bb-form-row">
          <label className="bb-field">First name<input name="firstName" required maxLength={100} /></label>
          <label className="bb-field">Last name<input name="lastName" required maxLength={100} /></label>
        </div>
        <div className="bb-form-row">
          <label className="bb-field">Email<input name="email" type="email" required maxLength={150} autoComplete="off" /></label>
          <label className="bb-field">Contact number (optional)<input name="contactNo" type="tel" maxLength={20} /></label>
        </div>
        <div className="bb-form-row">
          <label className="bb-field">Temporary password (8 or more characters)<input name="password" type="password" required minLength={8} maxLength={72} autoComplete="new-password" /></label>
          <label className="bb-field">Confirm password<input name="confirmPassword" type="password" required minLength={8} maxLength={72} autoComplete="new-password" /></label>
        </div>
        <fieldset className="console-role-choice">
          <legend>Role</legend>
          {roleNotes.map((role, index) => <label key={role.value}><input type="radio" name="role" value={role.value} defaultChecked={index === 0} required />
            <span><strong>{role.title}</strong><small>{role.text}</small></span></label>)}
        </fieldset>
        <div><button className="bb-btn bb-btn-primary" disabled={busy}>{busy ? 'Creating…' : 'Create employee account'}</button></div>
      </form>
      <section className="bb-card bb-card-pad">
        <h2 className="bb-card-title"><ShieldCheck aria-hidden="true" /> Created in this session</h2>
        <p className="bb-card-sub">Each new account is also written to the audit log with your name.</p>
        {created.length === 0 ? <p className="bb-muted console-empty-note">No accounts created yet.</p>
          : <ul className="console-list"><AnimatePresence initial={false}>{created.map(employee =>
            <motion.li key={employee.employeeId} initial={{ opacity: 0, x: 16 }} animate={{ opacity: 1, x: 0 }}>
              <div><strong>{employee.email}</strong><small>Employee #{employee.employeeId}</small></div>
              <span className="bb-chip plain">{roleTitles[employee.role] ?? employee.role}</span>
            </motion.li>)}</AnimatePresence></ul>}
      </section>
    </div>
  </div>
}
