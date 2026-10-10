import { useEffect, useState } from 'react'
import type { FormEvent } from 'react'
import { apiBase, apiRequest } from '../catalogue/client'
import { formatPrice } from '../catalogue/search'
import { requestSession } from '../catalogue/session'

// Matches the backend's inventory Variant record.
interface Variant {
  variantId: number
  productId: number
  productName: string
  sku: string
  warehouseId: number
  variantName: string
  colour: string | null
  memorySize: string | null
  price: number
  stockQuantity: number
}

const lowStockThreshold = 10

function StockForm({ variant, busy, label, save }: {
  variant: Variant; busy: boolean; label: string; save: (variantId: number, quantity: number) => void
}) {
  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    save(variant.variantId, Number(new FormData(event.currentTarget).get('quantity')))
  }
  // Keyed by the stored quantity, so the box shows the new value after a save.
  return <form className="stock-form" key={variant.stockQuantity} onSubmit={submit}>
    <input name="quantity" type="number" min={0} max={2147483647} step={1} required defaultValue={variant.stockQuantity}
      aria-label={`Stock quantity for ${variant.variantName}`} />
    <button className="btn btn-primary" disabled={busy}>{label}</button>
  </form>
}

export default function InventoryApp() {
  const [variants, setVariants] = useState<Variant[]>([])
  const [loading, setLoading] = useState(true)
  const [allowed, setAllowed] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [busy, setBusy] = useState(false)
  const [editing, setEditing] = useState<Variant | null>(null)
  const base = apiBase('inventory')
  const lowStock = variants.filter(variant => variant.stockQuantity < lowStockThreshold)

  useEffect(() => {
    const controller = new AbortController()
    requestSession(apiBase('auth'), controller.signal).then(async user => {
      if (user?.accountType !== 'EMPLOYEE' || !['WarehouseStaff', 'Admin'].includes(user.role)) {
        throw new Error('Sign in with a warehouse staff or admin account.')
      }
      setVariants(await apiRequest<Variant[]>(base + '/variants', { signal: controller.signal }))
      setAllowed(true); setLoading(false)
    }).catch(failure => { if (!controller.signal.aborted) { setError((failure as Error).message); setLoading(false) } })
    return () => controller.abort()
  }, [base])

  /** Sends one change, then reloads the list so the page shows what the database holds. */
  async function change(url: string, method: string, body: unknown, done: string) {
    setBusy(true); setError(''); setNotice('')
    try {
      await apiRequest(url, { method, body: body === undefined ? undefined : JSON.stringify(body) })
      setVariants(await apiRequest<Variant[]>(base + '/variants'))
      setNotice(done); setEditing(null)
      return true
    } catch (failure) { setError((failure as Error).message); return false }
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
    const form = event.currentTarget
    const data = new FormData(form)
    const text = (name: string) => String(data.get(name) ?? '').trim()
    const details = { variantName: text('variantName'), colour: text('colour') || null, memorySize: text('memorySize') || null, price: Number(text('price')) }
    if (editing) {
      void change(`${base}/variants/${editing.variantId}`, 'PUT', details, `Variant #${editing.variantId} updated.`)
    } else {
      void change(base + '/variants', 'POST', { ...details, productId: Number(text('productId')),
        warehouseId: text('warehouseId') ? Number(text('warehouseId')) : null, stock: Number(text('stock')) }, 'Variant added.')
        .then(saved => { if (saved) form.reset() })
    }
  }

  async function signOut() {
    try { await apiRequest(apiBase('auth') + '/logout', { method: 'POST' }); window.location.assign('/') }
    catch { setError('Sign-out failed. Your session may still be active; try again.') }
  }

  if (loading) return <main><p role="status">Checking staff session…</p></main>
  if (!allowed) return <main><h1>Inventory access</h1><p role="alert">{error}</p><a href="/?view=login">Sign in</a></main>
  return (
    <div className="dashboard-container">
      <header className="dashboard-header">
        <a className="dashboard-back" href="/">← Back to Home</a>
        <h1>BrightBuy <span>Warehouse</span></h1>
        <p>Inventory Management System · <a href="/catalogue.html?view=staff">Products and categories</a> · <button className="btn" onClick={signOut}>Sign out</button></p>
      </header>

      <main className="dashboard-content">
        {error && <p role="alert">{error}</p>}
        {notice && <p role="status">{notice}</p>}

        <section className="dashboard-section alerts-section">
          <h2>Low Stock Alerts</h2>
          {variants.length === 0 ? <div className="glass-card success-card"><p>No items in inventory to monitor.</p></div>
            : lowStock.length === 0 ? <div className="glass-card success-card"><p>All items are sufficiently stocked!</p></div>
            : <div className="alerts-grid">
              {lowStock.map(variant => <div key={variant.variantId} className="glass-card alert-card">
                <div className="card-header">
                  <h3>{variant.productName}</h3>
                  <span className="badge critical">Stock: {variant.stockQuantity}</span>
                </div>
                <p>{variant.variantName} · SKU {variant.sku}</p>
                <StockForm variant={variant} busy={busy} label="Restock" save={setStock} />
              </div>)}
            </div>}
        </section>

        <section className="dashboard-section">
          <h2>{editing ? `Edit variant #${editing.variantId}` : 'Add a variant'}</h2>
          <form className="glass-card variant-form" key={editing?.variantId ?? 'new'} onSubmit={saveVariant}>
            {!editing && <>
              <label>Product ID<input name="productId" type="number" min={1} required /></label>
              <label>Warehouse ID (optional)<input name="warehouseId" type="number" min={1} /></label>
            </>}
            <label>Variant name<input name="variantName" required maxLength={100} defaultValue={editing?.variantName} /></label>
            <label>Colour<input name="colour" maxLength={50} defaultValue={editing?.colour ?? ''} /></label>
            <label>Memory size<input name="memorySize" maxLength={50} defaultValue={editing?.memorySize ?? ''} /></label>
            <label>Price (USD)<input name="price" type="number" min="0.01" step="0.01" required defaultValue={editing?.price} /></label>
            {!editing && <label>Opening stock<input name="stock" type="number" min={0} step={1} required defaultValue={0} /></label>}
            <div>
              <button className="btn btn-primary" disabled={busy}>{editing ? 'Save changes' : 'Add variant'}</button>
              {editing && <button className="btn" type="button" onClick={() => setEditing(null)}>Cancel</button>}
            </div>
          </form>
        </section>

        <section className="dashboard-section inventory-section">
          <h2>Full Inventory</h2>
          <div className="glass-card table-container">
            <table className="inventory-table">
              <thead>
                <tr><th>Variant</th><th>Product</th><th>SKU</th><th>Warehouse</th><th>Price</th><th>Stock</th><th>Set stock</th><th>Details</th></tr>
              </thead>
              <tbody>
                {variants.length === 0 ? <tr><td colSpan={8}>No variants found in the database.</td></tr>
                  : variants.map(variant => <tr key={variant.variantId}>
                    <td>#{variant.variantId} {variant.variantName}</td>
                    <td>#{variant.productId} {variant.productName}</td>
                    <td className="sku-cell">{variant.sku}</td>
                    <td>{variant.warehouseId}</td>
                    <td>{formatPrice(variant.price)}</td>
                    <td><span className={`stock-indicator ${variant.stockQuantity < lowStockThreshold ? 'low' : 'good'}`}>{variant.stockQuantity}</span></td>
                    <td><StockForm variant={variant} busy={busy} label="Save" save={setStock} /></td>
                    <td><button className="btn" disabled={busy} onClick={() => { setEditing(variant); window.scrollTo({ top: 0 }) }}>Edit</button></td>
                  </tr>)}
              </tbody>
            </table>
          </div>
        </section>
      </main>
    </div>
  )
}
