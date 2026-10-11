import { useEffect, useState } from 'react'
import { AlertTriangle, ArrowRight, BadgeDollarSign, Boxes, CircleDollarSign, PackageSearch, PackageX, ShoppingBag, Truck, UserPlus, Users, Warehouse } from 'lucide-react'
import { apiBase, apiRequest } from '../catalogue/client'
import { formatPrice } from '../catalogue/search'
import { BarList, Kpi, KpiRow, PageHeader } from './parts'
import type { SectionId } from './roles'
import { lowStockThreshold } from './types'
import type { Variant } from './types'

type Quarter = { quarter: number; orderCount: number; totalRevenue: number }
type TopProduct = { productId: number; name: string; unitsSold: number; revenue: number }
type CategoryOrders = { categoryId: number; name: string; totalOrders: number }
type CustomerSummary = { customerId: number; lifetimeSpend: number | null }

const count = (value: number) => new Intl.NumberFormat('en-US').format(value)
// Whole dollars: a headline figure, not an invoice.
const dollars = (value: number) => `USD ${count(Math.round(value))}`

function useLoad<T>(load: (signal: AbortSignal) => Promise<T>) {
  const [state, setState] = useState<{ data?: T; error?: string }>({})
  useEffect(() => {
    const controller = new AbortController()
    load(controller.signal).then(data => setState({ data }))
      .catch(failure => { if (!controller.signal.aborted) setState({ error: (failure as Error).message }) })
    return () => controller.abort()
    // The loader is defined once per dashboard and never changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])
  return state
}

function Loading() {
  return <div className="console-kpis" aria-hidden="true">{[1, 2, 3, 4].map(id => <div key={id} className="bb-skeleton console-kpi-skeleton" />)}</div>
}

function StockDashboard({ admin, open }: { admin: boolean; open: (section: SectionId) => void }) {
  const { data: variants, error } = useLoad(signal => apiRequest<Variant[]>(apiBase('inventory') + '/variants', { signal }))
  if (error) return <p className="bb-notice error" role="alert">{error}</p>
  if (!variants) return <><p role="status" className="bb-visually-hidden">Loading inventory…</p><Loading /></>
  const units = variants.reduce((sum, variant) => sum + variant.stockQuantity, 0)
  const value = variants.reduce((sum, variant) => sum + variant.stockQuantity * Number(variant.price), 0)
  const out = variants.filter(variant => variant.stockQuantity === 0)
  const low = variants.filter(variant => variant.stockQuantity > 0 && variant.stockQuantity < lowStockThreshold)
  const attention = [...out, ...low].slice(0, 7)
  const largest = [...variants].sort((a, b) => b.stockQuantity - a.stockQuantity).slice(0, 6)
  return <>
    <KpiRow>
      <Kpi label="Products" value={count(new Set(variants.map(variant => variant.productId)).size)} hint={`${count(variants.length)} variants`} icon={<PackageSearch aria-hidden="true" />} />
      <Kpi label="Units in stock" value={count(units)} hint="Central warehouse" icon={<Warehouse aria-hidden="true" />} />
      <Kpi label="Stock value" value={dollars(value)} hint="At current prices" icon={<CircleDollarSign aria-hidden="true" />} />
      <Kpi label="Low stock" value={count(low.length)} hint={`Fewer than ${lowStockThreshold} units`} icon={<AlertTriangle aria-hidden="true" />} tone={low.length ? 'warn' : undefined} />
      <Kpi label="Out of stock" value={count(out.length)} hint="New orders are back-ordered" icon={<PackageX aria-hidden="true" />} tone={out.length ? 'danger' : undefined} />
    </KpiRow>
    <div className="console-grid-2">
      <section className="bb-card bb-card-pad">
        <div className="console-card-head"><div><h2 className="bb-card-title">Needs restocking</h2><p className="bb-card-sub">Out of stock first, then the lowest quantities</p></div>
          <button className="bb-btn bb-btn-sm" onClick={() => open('inventory')}>Open inventory<ArrowRight aria-hidden="true" /></button></div>
        {attention.length === 0 ? <p className="bb-notice">Every variant has at least {lowStockThreshold} units.</p>
          : <ul className="console-list">{attention.map(variant => <li key={variant.variantId}>
            <div><strong>{variant.productName}</strong><small>{variant.variantName} · SKU {variant.sku}</small></div>
            <span className={`bb-chip ${variant.stockQuantity === 0 ? 'danger' : 'warn'}`}>{variant.stockQuantity === 0 ? 'Out of stock' : `${variant.stockQuantity} left`}</span>
          </li>)}</ul>}
      </section>
      <section className="bb-card bb-card-pad">
        <div className="console-card-head"><div><h2 className="bb-card-title">Largest holdings</h2><p className="bb-card-sub">Variants with the most units in the warehouse</p></div></div>
        <BarList rows={largest.map(variant => ({ label: variant.variantName || variant.productName, value: variant.stockQuantity, note: `SKU ${variant.sku}` }))} format={value => `${count(value)} units`} />
      </section>
    </div>
    {admin && <section className="bb-card bb-card-pad console-callout">
      <div><Users aria-hidden="true" /><div><h2 className="bb-card-title">Staff accounts</h2><p className="bb-card-sub">Create warehouse, management and administrator accounts.</p></div></div>
      <button className="bb-btn bb-btn-primary" onClick={() => open('staff')}><UserPlus aria-hidden="true" />Create an account</button>
    </section>}
  </>
}

function SalesDashboard({ open }: { open: (section: SectionId) => void }) {
  const year = new Date().getFullYear()
  const { data, error } = useLoad(async signal => {
    const base = apiBase('reports')
    const get = <T,>(path: string) => apiRequest<T>(`${base}/${path}`, { signal })
    const [quarters, top, categories, deliveries, customers] = await Promise.all([
      get<Quarter[]>(`quarterly-sales?year=${year}`),
      get<TopProduct[]>(`top-selling-products?startDate=${year}-01-01&endDate=${year}-12-31&topN=5`),
      get<CategoryOrders[]>('category-order-counts'),
      get<unknown[]>('delivery-estimates'),
      get<CustomerSummary[]>('customer-order-summary'),
    ])
    return { quarters, top, categories, deliveries, customers }
  })
  if (error) return <p className="bb-notice error" role="alert">{error}</p>
  if (!data) return <><p role="status" className="bb-visually-hidden">Loading sales figures…</p><Loading /></>
  const revenue = data.quarters.reduce((sum, quarter) => sum + Number(quarter.totalRevenue), 0)
  const orders = data.quarters.reduce((sum, quarter) => sum + Number(quarter.orderCount), 0)
  const buyers = data.customers.filter(customer => Number(customer.lifetimeSpend ?? 0) > 0).length
  return <>
    <KpiRow>
      <Kpi label={`Revenue ${year}`} value={dollars(revenue)} hint="Cancelled orders left out" icon={<BadgeDollarSign aria-hidden="true" />} />
      <Kpi label={`Orders ${year}`} value={count(orders)} hint={orders ? `${formatPrice(revenue / orders)} average order` : 'No orders yet'} icon={<ShoppingBag aria-hidden="true" />} />
      <Kpi label="Customers with orders" value={count(buyers)} hint={`${count(data.customers.length)} registered`} icon={<Users aria-hidden="true" />} />
      <Kpi label="Upcoming deliveries" value={count(data.deliveries.length)} hint="Not yet delivered" icon={<Truck aria-hidden="true" />} />
    </KpiRow>
    <div className="console-grid-2">
      <section className="bb-card bb-card-pad">
        <div className="console-card-head"><div><h2 className="bb-card-title">Revenue by quarter</h2><p className="bb-card-sub">{year}, in USD</p></div>
          <button className="bb-btn bb-btn-sm" onClick={() => open('reports')}>All reports<ArrowRight aria-hidden="true" /></button></div>
        <BarList rows={data.quarters.map(quarter => ({ label: `Quarter ${quarter.quarter}`, value: Number(quarter.totalRevenue), note: `${quarter.orderCount} orders` }))} format={formatPrice} />
      </section>
      <section className="bb-card bb-card-pad">
        <div className="console-card-head"><div><h2 className="bb-card-title">Top products</h2><p className="bb-card-sub">By revenue, {year}</p></div></div>
        <BarList rows={data.top.map(product => ({ label: product.name, value: Number(product.revenue), note: `${product.unitsSold} units sold` }))} format={formatPrice} />
      </section>
    </div>
    <section className="bb-card bb-card-pad">
      <div className="console-card-head"><div><h2 className="bb-card-title">Orders by category</h2><p className="bb-card-sub">Orders that include a product of each category</p></div></div>
      <BarList rows={[...data.categories].sort((a, b) => b.totalOrders - a.totalOrders).slice(0, 8).map(category => ({ label: category.name, value: Number(category.totalOrders) }))} format={value => `${count(value)} orders`} />
    </section>
  </>
}

export default function Overview({ role, open }: { role: string; open: (section: SectionId) => void }) {
  const management = role === 'Management'
  return <div className="console-page">
    <PageHeader eyebrow={management ? 'Management' : role === 'Admin' ? 'Administration' : 'Warehouse'}
      title={management ? 'Sales overview' : 'Operations overview'}
      text={management ? 'Live figures from the order tables. Open Reports for the full tables and CSV export.'
        : 'Stock held in the central warehouse, and what needs attention.'}
      actions={management ? <button className="bb-btn bb-btn-primary" onClick={() => open('reports')}>Open reports</button>
        : <button className="bb-btn bb-btn-primary" onClick={() => open('inventory')}><Boxes aria-hidden="true" />Manage inventory</button>} />
    {management ? <SalesDashboard open={open} /> : <StockDashboard admin={role === 'Admin'} open={open} />}
  </div>
}
