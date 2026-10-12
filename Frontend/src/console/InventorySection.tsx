import { useEffect, useMemo, useState } from 'react'
import type { FormEvent } from 'react'
import { Pencil, Plus, Search } from 'lucide-react'
import { apiBase, apiRequest } from '../catalogue/client'
import { formatPrice } from '../catalogue/search'
import { Drawer, Feedback, PageHeader } from './parts'
import { lowStockThreshold } from './types'
import type { Variant } from './types'

type Filter = 'all' | 'low' | 'out'

function StockForm({ variant, busy, save }: { variant: Variant; busy: boolean; save: (variantId: number, quantity: number) => void }) {
  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    save(variant.variantId, Number(new FormData(event.currentTarget).get('quantity')))
  }
  // Keyed by the stored quantity, so the box shows the new value after a save.
  return <form className="console-stock-form" key={variant.stockQuantity} onSubmit={submit}>
    <input name="quantity" type="number" min={0} max={2147483647} step={1} required defaultValue={variant.stockQuantity}
      aria-label={`Stock quantity for ${variant.variantName}`} />
    <button className="bb-btn bb-btn-sm" disabled={busy}>Save</button>
  </form>
}

export default function InventorySection() {
  const [variants, setVariants] = useState<Variant[] | null>(null)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [busy, setBusy] = useState(false)
  const [filter, setFilter] = useState<Filter>('all')
  const [term, setTerm] = useState('')
  const [editing, setEditing] = useState<Variant | null>(null)
  const [adding, setAdding] = useState(false)
  const base = apiBase('inventory')

  useEffect(() => {
    const controller = new AbortController()
    apiRequest<Variant[]>(base + '/variants', { signal: controller.signal }).then(setVariants)
      .catch(failure => { if (!controller.signal.aborted) setError((failure as Error).message) })
    return () => controller.abort()
  }, [base])

  /** Sends one change, then reloads the list so the page shows what the database holds. */
  async function change(url: string, method: string, body: unknown, done: string) {
    setBusy(true); setError(''); setNotice('')
    try {
      await apiRequest(url, { method, body: body === undefined ? undefined : JSON.stringify(body) })
      setVariants(await apiRequest<Variant[]>(base + '/variants'))
      setNotice(done); setEditing(null); setAdding(false)
    } catch (failure) { setError((failure as Error).message) }
    finally { setBusy(false) }
  }

  function setStock(variantId: number, quantity: number) {
    if (!Number.isSafeInteger(quantity) || quantity < 0 || quantity > 2147483647) {
      setError('Enter a whole number of zero or more.'); return
    }
    void change(`${base}/variants/${variantId}/stock?quantity=${quantity}`, 'PUT', undefined, `Stock for variant #${variantId} set to ${quantity}.`)
  }

  function saveVariant(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const data = new FormData(event.currentTarget)
    const text = (name: string) => String(data.get(name) ?? '').trim()
    const details = { variantName: text('variantName'), colour: text('colour') || null, memorySize: text('memorySize') || null, price: Number(text('price')) }
    if (editing) void change(`${base}/variants/${editing.variantId}`, 'PUT', details, `Variant #${editing.variantId} updated.`)
    else void change(base + '/variants', 'POST', { ...details, productId: Number(text('productId')), stock: Number(text('stock')) }, 'Variant added.')
  }

  const counts = useMemo(() => ({
    all: variants?.length ?? 0,
    low: variants?.filter(variant => variant.stockQuantity > 0 && variant.stockQuantity < lowStockThreshold).length ?? 0,
    out: variants?.filter(variant => variant.stockQuantity === 0).length ?? 0,
  }), [variants])
  const shown = (variants ?? []).filter(variant => {
    if (filter === 'low' && !(variant.stockQuantity > 0 && variant.stockQuantity < lowStockThreshold)) return false
    if (filter === 'out' && variant.stockQuantity !== 0) return false
    const needle = term.trim().toLowerCase()
    return !needle || `${variant.productName} ${variant.variantName} ${variant.sku}`.toLowerCase().includes(needle)
  })
  const filters: { id: Filter; label: string }[] = [
    { id: 'all', label: 'All variants' }, { id: 'low', label: 'Low stock' }, { id: 'out', label: 'Out of stock' }]

  return <div className="console-page">
    <PageHeader eyebrow="Central warehouse" title="Inventory"
      text="Set counted stock and maintain variants. Every stock change is recorded with your account, the time, and the quantity before and after."
      actions={<button className="bb-btn bb-btn-primary" onClick={() => { setAdding(true); setEditing(null) }}><Plus aria-hidden="true" />Add variant</button>} />
    <Feedback notice={notice} error={error} />
    <div className="bb-card console-toolbar">
      <div className="console-filter" role="group" aria-label="Stock filter">
        {filters.map(item => <button key={item.id} type="button" className={filter === item.id ? 'active' : ''} aria-pressed={filter === item.id}
          onClick={() => setFilter(item.id)}>{item.label}<span>{counts[item.id]}</span></button>)}
      </div>
      <label className="console-search"><Search aria-hidden="true" /><span className="bb-visually-hidden">Search inventory</span>
        <input type="search" value={term} onChange={event => setTerm(event.target.value)} placeholder="Search product, variant or SKU" /></label>
    </div>
    {!variants && !error && <><p role="status" className="bb-visually-hidden">Loading inventory…</p><div className="bb-skeleton console-table-skeleton" aria-hidden="true" /></>}
    {variants && <div className="bb-table-wrap"><table className="bb-table">
      <thead><tr><th>Variant</th><th>Product</th><th>SKU</th><th>Price</th><th>Stock</th><th>Set stock</th><th><span className="bb-visually-hidden">Actions</span></th></tr></thead>
      <tbody>
        {shown.length === 0 ? <tr><td colSpan={7} className="console-empty-row">No variants match.</td></tr>
          : shown.map(variant => <tr key={variant.variantId}>
            <td><strong>{variant.variantName}</strong><br /><small className="bb-muted">#{variant.variantId}{[variant.colour, variant.memorySize].filter(value => value && value !== 'N/A').map(value => ` · ${value}`).join('')}</small></td>
            <td>{variant.productName}<br /><small className="bb-muted">Product #{variant.productId}</small></td>
            <td className="bb-num">{variant.sku}</td>
            <td className="bb-num">{formatPrice(variant.price)}</td>
            <td><span className={`bb-chip ${variant.stockQuantity === 0 ? 'danger' : variant.stockQuantity < lowStockThreshold ? 'warn' : 'ok'}`}>{variant.stockQuantity}</span></td>
            <td><StockForm variant={variant} busy={busy} save={setStock} /></td>
            <td><button className="bb-icon-btn" aria-label={`Edit ${variant.variantName}`} disabled={busy} onClick={() => { setEditing(variant); setAdding(false) }}><Pencil aria-hidden="true" /></button></td>
          </tr>)}
      </tbody>
    </table></div>}

    <Drawer open={adding || !!editing} title={editing ? `Edit variant #${editing.variantId}` : 'Add a variant'} onClose={() => { setAdding(false); setEditing(null) }}>
      <form className="bb-form" key={editing?.variantId ?? 'new'} onSubmit={saveVariant}>
        {!editing && <label className="bb-field">Product ID<input name="productId" type="number" min={1} required />
          <span className="bb-hint">The product this is a new version of. Find the ID under Products.</span></label>}
        <label className="bb-field">Variant name<input name="variantName" required maxLength={100} defaultValue={editing?.variantName} /></label>
        <div className="bb-form-row">
          <label className="bb-field">Colour<input name="colour" maxLength={50} defaultValue={editing?.colour ?? ''} /></label>
          <label className="bb-field">Memory size<input name="memorySize" maxLength={50} defaultValue={editing?.memorySize ?? ''} /></label>
        </div>
        <div className="bb-form-row">
          <label className="bb-field">Price (USD)<input name="price" type="number" min="0.01" step="0.01" required defaultValue={editing?.price} /></label>
          {!editing && <label className="bb-field">Opening stock<input name="stock" type="number" min={0} step={1} required defaultValue={0} /></label>}
        </div>
        {!editing && <p className="bb-hint">All stock is held in the central warehouse.</p>}
        {error && <p className="bb-notice error" role="alert">{error}</p>}
        <button className="bb-btn bb-btn-primary" disabled={busy}>{busy ? 'Saving…' : editing ? 'Save changes' : 'Add variant'}</button>
      </form>
    </Drawer>
  </div>
}
