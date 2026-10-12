import { useEffect, useState } from 'react'
import type { FormEvent } from 'react'
import { Archive, ArchiveRestore, ChevronLeft, ChevronRight, Pencil, Plus, Search, X } from 'lucide-react'
import { ApiError, apiRequest, catalogueBase } from '../catalogue/client'
import type { StaffCategory } from './CategoriesSection'
import { Drawer, Feedback, PageHeader } from './parts'

type StaffProduct = { product_id: number; sku: string; name: string; description: string | null; image_url: string | null; is_active: boolean | number }

export default function ProductsSection() {
  const [products, setProducts] = useState<StaffProduct[] | null>(null)
  const [categories, setCategories] = useState<StaffCategory[]>([])
  const [keyword, setKeyword] = useState('')
  const [page, setPage] = useState(1)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [busy, setBusy] = useState(false)
  const [editing, setEditing] = useState<StaffProduct | null>(null)
  const [adding, setAdding] = useState(false)
  const [assigned, setAssigned] = useState<number[]>([])
  const base = catalogueBase + '/staff'
  const productsUrl = `${base}/products?${new URLSearchParams({ keyword, page: String(page) })}`

  const load = (signal?: AbortSignal) => Promise.all([
    apiRequest<StaffProduct[]>(productsUrl, { signal }), apiRequest<StaffCategory[]>(base + '/categories', { signal })])

  useEffect(() => {
    const controller = new AbortController()
    Promise.all([apiRequest<StaffProduct[]>(productsUrl, { signal: controller.signal }),
      apiRequest<StaffCategory[]>(base + '/categories', { signal: controller.signal })])
      .then(([list, all]) => { setProducts(list); setCategories(all) })
      .catch(failure => { if (!controller.signal.aborted) setError((failure as Error).message) })
    return () => controller.abort()
  }, [base, productsUrl])

  // The categories of the product being edited.
  useEffect(() => {
    if (!editing) return
    const controller = new AbortController()
    apiRequest<{ category_id: number }[]>(`${base}/products/${editing.product_id}/categories`, { signal: controller.signal })
      .then(rows => setAssigned(rows.map(row => row.category_id)))
      .catch(() => { if (!controller.signal.aborted) setAssigned([]) })
    return () => { controller.abort(); setAssigned([]) }
  }, [base, editing])

  async function write(url: string, method: string, body: unknown, done: string, close = true) {
    setBusy(true); setError(''); setNotice('')
    try {
      await apiRequest(url, { method, body: body === undefined ? undefined : JSON.stringify(body) })
      const [list, all] = await load()
      setProducts(list); setCategories(all)
      setNotice(done)
      if (close) { setEditing(null); setAdding(false) }
      return true
    } catch (failure) { setError((failure as Error).message); return false }
    finally { setBusy(false) }
  }

  async function saveProduct(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const data = new FormData(event.currentTarget)
    const text = (name: string) => String(data.get(name) ?? '').trim()
    const details = { sku: text('sku'), name: text('name'), description: text('description') || null }
    const file = data.get('imageFile')
    setBusy(true); setError(''); setNotice('')
    try {
      let imageUrl = text('imageUrl') || null
      if (file instanceof File && file.size > 0) {
        const upload = new FormData()
        upload.append('file', file)
        const result = await apiRequest<{ imageUrl: string }>(`${base}/product-images`, { method: 'POST', body: upload })
        imageUrl = result.imageUrl
      }
      const product = { ...details, imageUrl }
      if (editing) {
        await apiRequest(`${base}/products/${editing.product_id}`, { method: 'PUT', body: JSON.stringify(product) })
      } else {
        await apiRequest(base + '/products', {
          method: 'POST',
          body: JSON.stringify({ ...product, categoryId: Number(text('categoryId')), price: Number(text('price')), stock: Number(text('stock')) }),
        })
      }
      const [list, all] = await load()
      setProducts(list); setCategories(all)
      setNotice(editing ? `“${details.name}” updated.` : `“${details.name}” created with its first category and default variant.`)
      setEditing(null); setAdding(false)
    } catch (failure) {
      setError(file instanceof File && file.size > 0 && failure instanceof ApiError && failure.status === 503
        ? 'Product image storage is unavailable. Configure Azure Blob Storage on the backend or enter an image address instead.'
        : (failure as Error).message)
    } finally {
      setBusy(false)
    }
  }

  async function setCategory(categoryId: number, add: boolean) {
    if (!editing) return
    const name = categories.find(category => category.category_id === categoryId)?.name ?? 'category'
    const saved = await write(`${base}/products/${editing.product_id}/categories/${categoryId}`, add ? 'POST' : 'DELETE', undefined,
      add ? `Added to ${name}.` : `Removed from ${name}.`, false)
    if (saved) setAssigned(current => add ? [...current, categoryId] : current.filter(id => id !== categoryId))
  }

  const unassigned = categories.filter(category => !assigned.includes(category.category_id))
  return <div className="console-page">
    <PageHeader eyebrow="Catalogue" title="Products"
      text="Create and edit products. A product is retired, never deleted, because past orders refer to it."
      actions={<button className="bb-btn bb-btn-primary" onClick={() => { setAdding(true); setEditing(null) }}><Plus aria-hidden="true" />New product</button>} />
    <Feedback notice={notice} error={error} />
    <div className="bb-card console-toolbar">
      <form className="console-search" role="search" onSubmit={event => { event.preventDefault(); setKeyword(String(new FormData(event.currentTarget).get('keyword') ?? '').trim()); setPage(1) }}>
        <Search aria-hidden="true" /><label className="bb-visually-hidden" htmlFor="console-product-search">Search products</label>
        <input id="console-product-search" name="keyword" type="search" maxLength={255} placeholder="Search by name or SKU, including retired products" />
        <button className="bb-btn bb-btn-sm">Search</button>
      </form>
      <div className="console-pager">
        <button className="bb-icon-btn" aria-label="Previous page" disabled={page === 1 || busy} onClick={() => setPage(current => current - 1)}><ChevronLeft aria-hidden="true" /></button>
        <span>Page {page}</span>
        <button className="bb-icon-btn" aria-label="Next page" disabled={(products?.length ?? 0) < 100 || busy} onClick={() => setPage(current => current + 1)}><ChevronRight aria-hidden="true" /></button>
      </div>
    </div>
    {!products && !error && <div className="bb-skeleton console-table-skeleton" aria-hidden="true" />}
    {products && <div className="bb-table-wrap"><table className="bb-table">
      <thead><tr><th>ID</th><th>Product</th><th>SKU</th><th>Status</th><th><span className="bb-visually-hidden">Actions</span></th></tr></thead>
      <tbody>
        {products.length === 0 ? <tr><td colSpan={5} className="console-empty-row">No products match.</td></tr>
          : products.map(product => <tr key={product.product_id}>
            <td className="bb-num">#{product.product_id}</td>
            <td><strong>{product.name}</strong>{product.description && <><br /><small className="bb-muted console-clip">{product.description}</small></>}</td>
            <td className="bb-num">{product.sku}</td>
            <td><span className={`bb-chip ${product.is_active ? 'ok' : 'neutral'}`}>{product.is_active ? 'Active' : 'Retired'}</span></td>
            <td className="console-row-actions">
              <button className="bb-btn bb-btn-sm" disabled={busy} onClick={() => { setEditing(product); setAdding(false) }}><Pencil aria-hidden="true" />Edit</button>
              <button className={`bb-btn bb-btn-sm ${product.is_active ? 'bb-btn-danger' : ''}`} disabled={busy}
                onClick={() => void write(`${base}/products/${product.product_id}/active`, 'PATCH', { active: !product.is_active },
                  product.is_active ? `“${product.name}” retired: hidden from customers.` : `“${product.name}” restored.`)}>
                {product.is_active ? <><Archive aria-hidden="true" />Retire</> : <><ArchiveRestore aria-hidden="true" />Restore</>}</button>
            </td>
          </tr>)}
      </tbody>
    </table></div>}

    <Drawer open={adding || !!editing} title={editing ? `Edit product #${editing.product_id}` : 'New product'} onClose={() => { setAdding(false); setEditing(null) }}>
      <form className="bb-form" key={editing?.product_id ?? 'new'} onSubmit={saveProduct}>
        <div className="bb-form-row">
          <label className="bb-field">SKU<input name="sku" required maxLength={50} defaultValue={editing?.sku} /></label>
          <label className="bb-field">Name<input name="name" required maxLength={150} defaultValue={editing?.name} /></label>
        </div>
        <label className="bb-field">Description<textarea name="description" defaultValue={editing?.description ?? ''} /></label>
        <label className="bb-field">Product image<input name="imageFile" type="file" accept="image/png,image/jpeg,.png,.jpg,.jpeg" /></label>
        <p className="bb-hint">Upload a PNG or JPEG up to 5 MB. Azure image storage must be configured. If selected, the uploaded image replaces the image address below.</p>
        <label className="bb-field">Image address (optional)<input name="imageUrl" maxLength={500} placeholder="https://…" defaultValue={editing?.image_url ?? ''} /></label>
        {!editing && <>
          <label className="bb-field">First category<select name="categoryId" required defaultValue="">
            <option value="">Choose a category</option>
            {categories.map(category => <option key={category.category_id} value={category.category_id}>{category.name}</option>)}</select></label>
          <div className="bb-form-row">
            <label className="bb-field">Price of the first variant (USD)<input name="price" type="number" min="0.01" step="0.01" required /></label>
            <label className="bb-field">Opening stock<input name="stock" type="number" min={0} step={1} required defaultValue={0} /></label>
          </div>
          <p className="bb-hint">The product, its first category and its default variant are saved together, or not at all.</p>
        </>}
        {error && <p className="bb-notice error" role="alert">{error}</p>}
        <button className="bb-btn bb-btn-primary" disabled={busy}>{busy ? 'Saving…' : editing ? 'Save changes' : 'Create product'}</button>
      </form>
      {editing && <section className="console-membership">
        <h3>Categories of this product</h3>
        <p className="bb-hint">A product always keeps at least one category.</p>
        <ul>{assigned.map(id => <li key={id} className="bb-chip plain">{categories.find(category => category.category_id === id)?.name ?? `#${id}`}
          <button type="button" aria-label="Remove from category" disabled={busy} onClick={() => void setCategory(id, false)}><X aria-hidden="true" /></button></li>)}</ul>
        {unassigned.length > 0 && <form className="console-inline-form" onSubmit={event => { event.preventDefault(); const value = Number(new FormData(event.currentTarget).get('category')); if (value) void setCategory(value, true) }}>
          <label className="bb-visually-hidden" htmlFor="console-add-category">Add to category</label>
          <select id="console-add-category" name="category" className="bb-input" defaultValue="">
            <option value="">Add to a category…</option>
            {unassigned.map(category => <option key={category.category_id} value={category.category_id}>{category.name}</option>)}</select>
          <button className="bb-btn" disabled={busy}>Add</button>
        </form>}
      </section>}
    </Drawer>
  </div>
}
