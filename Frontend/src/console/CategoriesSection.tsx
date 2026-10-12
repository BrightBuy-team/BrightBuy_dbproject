import { useEffect, useState } from 'react'
import type { FormEvent } from 'react'
import { CornerDownRight, Pencil, Plus } from 'lucide-react'
import { apiRequest, catalogueBase } from '../catalogue/client'
import { Drawer, Feedback, PageHeader } from './parts'

export type StaffCategory = { category_id: number; name: string; description: string | null; parent_category_id: number | null; is_active: boolean | number }

export default function CategoriesSection() {
  const [categories, setCategories] = useState<StaffCategory[] | null>(null)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [busy, setBusy] = useState(false)
  const [editing, setEditing] = useState<StaffCategory | null>(null)
  const [adding, setAdding] = useState(false)
  const base = catalogueBase + '/staff'

  useEffect(() => {
    const controller = new AbortController()
    apiRequest<StaffCategory[]>(base + '/categories', { signal: controller.signal }).then(setCategories)
      .catch(failure => { if (!controller.signal.aborted) setError((failure as Error).message) })
    return () => controller.abort()
  }, [base])

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const data = new FormData(event.currentTarget)
    const body = { name: String(data.get('name') ?? '').trim(), description: String(data.get('description') ?? '').trim() || null,
      parentCategoryId: data.get('parent') ? Number(data.get('parent')) : null, active: data.has('active') }
    setBusy(true); setError(''); setNotice('')
    try {
      await apiRequest(base + '/categories' + (editing ? '/' + editing.category_id : ''), { method: editing ? 'PUT' : 'POST', body: JSON.stringify(body) })
      setCategories(await apiRequest<StaffCategory[]>(base + '/categories'))
      setNotice(editing ? `Category “${body.name}” updated.` : `Category “${body.name}” created.`)
      setEditing(null); setAdding(false)
    } catch (failure) { setError((failure as Error).message) }
    finally { setBusy(false) }
  }

  const roots = (categories ?? []).filter(category => category.parent_category_id === null)
  const ordered = roots.flatMap(root => [root, ...(categories ?? []).filter(category => category.parent_category_id === root.category_id)])
  return <div className="console-page">
    <PageHeader eyebrow="Catalogue" title="Categories"
      text="Two levels: a top-level category and its children. A product can belong to several categories."
      actions={<button className="bb-btn bb-btn-primary" onClick={() => { setAdding(true); setEditing(null) }}><Plus aria-hidden="true" />New category</button>} />
    <Feedback notice={notice} error={error} />
    {!categories && !error && <div className="bb-skeleton console-table-skeleton" aria-hidden="true" />}
    {categories && <div className="bb-table-wrap"><table className="bb-table">
      <thead><tr><th>Category</th><th>Description</th><th>Status</th><th><span className="bb-visually-hidden">Actions</span></th></tr></thead>
      <tbody>{ordered.map(category => <tr key={category.category_id}>
        <td className={category.parent_category_id ? 'console-child' : ''}>{category.parent_category_id && <CornerDownRight aria-hidden="true" />}
          <strong>{category.name}</strong> <small className="bb-muted">#{category.category_id}</small></td>
        <td className="bb-muted">{category.description || '—'}</td>
        <td><span className={`bb-chip ${category.is_active ? 'ok' : 'neutral'}`}>{category.is_active ? 'Active' : 'Hidden'}</span></td>
        <td><button className="bb-icon-btn" aria-label={`Edit ${category.name}`} onClick={() => { setEditing(category); setAdding(false) }}><Pencil aria-hidden="true" /></button></td>
      </tr>)}</tbody>
    </table></div>}

    <Drawer open={adding || !!editing} title={editing ? `Edit ${editing.name}` : 'New category'} onClose={() => { setAdding(false); setEditing(null) }}>
      <form className="bb-form" key={editing?.category_id ?? 'new'} onSubmit={save}>
        <label className="bb-field">Name<input name="name" required maxLength={100} defaultValue={editing?.name} /></label>
        <label className="bb-field">Description<textarea name="description" maxLength={500} defaultValue={editing?.description ?? ''} /></label>
        <label className="bb-field">Parent category<select name="parent" defaultValue={editing?.parent_category_id ?? ''}>
          <option value="">None (top level)</option>
          {roots.filter(root => root.category_id !== editing?.category_id).map(root => <option key={root.category_id} value={root.category_id}>{root.name}</option>)}
        </select><span className="bb-hint">Only top-level categories can be parents.</span></label>
        <label className="console-check"><input name="active" type="checkbox" defaultChecked={editing ? !!editing.is_active : true} />Shown to customers</label>
        {error && <p className="bb-notice error" role="alert">{error}</p>}
        <button className="bb-btn bb-btn-primary" disabled={busy}>{busy ? 'Saving…' : 'Save category'}</button>
      </form>
    </Drawer>
  </div>
}
