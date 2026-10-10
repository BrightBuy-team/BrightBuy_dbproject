import { useState } from 'react'
import { ApiError, apiBase, apiRequest } from './client'
import { downloadCsv, toCsv } from './csv'
import { formatPrice } from './search'

type ReportKey = 'quarterly-sales' | 'top-selling-products' | 'category-order-counts' | 'delivery-estimates' | 'customer-order-summary'
type ReportRow = Record<string, unknown>
type Column = { key: string; label: string; kind?: 'money' | 'date' }

const reports: { key: ReportKey; label: string; title: string; description: string; columns: Column[] }[] = [
  { key: 'quarterly-sales', label: 'Quarterly sales', title: 'Quarterly sales report', description: 'Order volume and revenue by quarter.', columns: [
    { key: 'quarter', label: 'Quarter' }, { key: 'orderCount', label: 'Orders' }, { key: 'totalRevenue', label: 'Revenue', kind: 'money' },
  ] },
  { key: 'top-selling-products', label: 'Top products', title: 'Top selling products', description: 'Best selling products for a selected date range.', columns: [
    { key: 'productId', label: 'Product ID' }, { key: 'name', label: 'Product' }, { key: 'unitsSold', label: 'Units sold' }, { key: 'revenue', label: 'Revenue', kind: 'money' },
  ] },
  { key: 'category-order-counts', label: 'Category orders', title: 'Category order counts', description: 'Number of non-cancelled orders associated with each category.', columns: [
    { key: 'categoryId', label: 'Category ID' }, { key: 'name', label: 'Category' }, { key: 'totalOrders', label: 'Orders' },
  ] },
  { key: 'delivery-estimates', label: 'Delivery estimates', title: 'Upcoming delivery estimates', description: 'Orders still in the delivery process and their estimated dates.', columns: [
    { key: 'orderId', label: 'Order' }, { key: 'customer', label: 'Customer' }, { key: 'deliveryMode', label: 'Delivery' }, { key: 'destinationCity', label: 'Destination' }, { key: 'estDeliveryDate', label: 'Estimated date', kind: 'date' }, { key: 'deliveryStatus', label: 'Status' },
  ] },
  { key: 'customer-order-summary', label: 'Customer summary', title: 'Customer order summary', description: 'Customer lifetime spend and recorded payment statuses.', columns: [
    { key: 'customerId', label: 'Customer ID' }, { key: 'customer', label: 'Customer' }, { key: 'lifetimeSpend', label: 'Lifetime spend', kind: 'money' }, { key: 'paymentStatuses', label: 'Payment statuses' },
  ] },
]

function isRecord(value: unknown): value is ReportRow {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function customerName(row: ReportRow) {
  return [row.firstName, row.lastName].filter(part => typeof part === 'string' && part).join(' ')
}

function display(value: unknown, column: Column, row: ReportRow) {
  if (column.key === 'customer') return customerName(row) || '—'
  if (value === null || value === undefined || value === '') return '—'
  if (column.kind === 'money' && (typeof value === 'number' || typeof value === 'string')) {
    const amount = Number(value)
    return Number.isFinite(amount) ? formatPrice(amount) : String(value)
  }
  if (column.kind === 'date' && typeof value === 'string') {
    const date = new Date(`${value.slice(0, 10)}T00:00:00`)
    return Number.isNaN(date.getTime()) ? value : new Intl.DateTimeFormat(undefined, { dateStyle: 'medium' }).format(date)
  }
  return String(value)
}

function failureMessage(failure: unknown) {
  if (failure instanceof ApiError) {
    return failure.status === 401 || failure.status === 403
      ? 'Reports need a management account. Sign in with one and try again.'
      : 'The report could not be loaded. Try again.'
  }
  if (failure instanceof Error && failure.name === 'TimeoutError') return 'The report took too long to respond. Try again.'
  return failure instanceof TypeError ? 'Cannot reach the reporting service. Check that the backend is running.'
    : failure instanceof Error ? failure.message : 'The report could not be loaded.'
}

export default function ManagementReports() {
  const today = new Date()
  const todayText = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`
  const [active, setActive] = useState<ReportKey>('quarterly-sales')
  const [year, setYear] = useState(String(today.getFullYear()))
  const [startDate, setStartDate] = useState(`${today.getFullYear()}-01-01`)
  const [endDate, setEndDate] = useState(todayText)
  const [topN, setTopN] = useState('10')
  const [rows, setRows] = useState<ReportRow[] | null>(null)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [ran, setRan] = useState(today)
  const report = reports.find(item => item.key === active)!

  async function loadReport() {
    const params = new URLSearchParams()
    if (active === 'quarterly-sales') {
      const reportYear = Number(year)
      if (!Number.isInteger(reportYear) || reportYear < 2000 || reportYear > 2100) {
        setError('Enter a year between 2000 and 2100.')
        setRows(null)
        return
      }
      params.set('year', String(reportYear))
    }
    if (active === 'top-selling-products') {
      const limit = Number(topN)
      if (!startDate || !endDate || startDate > endDate) {
        setError('Choose a valid date range.')
        setRows(null)
        return
      }
      if (!Number.isInteger(limit) || limit < 1 || limit > 100) {
        setError('Choose between 1 and 100 products.')
        setRows(null)
        return
      }
      params.set('startDate', startDate)
      params.set('endDate', endDate)
      params.set('topN', String(limit))
    }

    setLoading(true)
    setError('')
    setRows(null)
    try {
      const data: unknown = await apiRequest(`${apiBase('reports')}/${active}?${params}`)
      if (!Array.isArray(data) || !data.every(isRecord)) throw new Error('The reporting service returned an unexpected answer.')
      setRows(data)
      setRan(new Date())
    } catch (failure) {
      setError(failureMessage(failure))
    } finally {
      setLoading(false)
    }
  }

  // Export (UI-12): the rows on screen, with unformatted numbers and dates so a spreadsheet can use them.
  function exportCsv() {
    if (!rows) return
    const csv = toCsv(report.columns.map(column => column.label),
      rows.map(row => report.columns.map(column => column.key === 'customer' ? customerName(row) : row[column.key])))
    downloadCsv(`brightbuy-${active}-${ran.toISOString().slice(0, 10)}.csv`, csv)
  }

  return <div className="management-app">
      <div className="management-intro">
        <p className="catalogue-section-label">BUSINESS OVERVIEW</p>
        <h1>Management reports</h1>
        <p>Review sales, products, orders, deliveries, and customer payment activity.</p>
      </div>
      <section className="management-panel" aria-label="Report controls">
        <p>Reports need a management account.</p>
        <div className="management-tabs" role="tablist" aria-label="Choose a report">
          {reports.map(item => <button key={item.key} type="button" role="tab" aria-selected={active === item.key}
            className={active === item.key ? 'active' : ''} onClick={() => { setActive(item.key); setRows(null); setError('') }}>{item.label}</button>)}
        </div>
        <div className="management-report-heading">
          <div><h2>{report.title}</h2><p>{report.description}</p></div>
          {active === 'quarterly-sales' && <label>Year<input type="number" min="2000" max="2100" value={year} onChange={event => setYear(event.target.value)} /></label>}
          {active === 'top-selling-products' && <div className="management-filters">
            <label>From<input type="date" value={startDate} onChange={event => setStartDate(event.target.value)} /></label>
            <label>To<input type="date" value={endDate} onChange={event => setEndDate(event.target.value)} /></label>
            <label>Top<input type="number" min="1" max="100" value={topN} onChange={event => setTopN(event.target.value)} /></label>
          </div>}
        </div>
        <button className="management-run" type="button" onClick={loadReport} disabled={loading}>{loading ? 'Loading report…' : 'Run report'}</button>
        {error && <div className="management-error" role="alert">{error}</div>}
        {loading && <p className="management-status" role="status">Loading {report.title.toLowerCase()}…</p>}
        {rows && rows.length === 0 && <div className="management-empty" role="status">No results for this report.</div>}
        {rows && rows.length > 0 && <button type="button" onClick={exportCsv}>Export CSV</button>}
        {rows && rows.length > 0 && <div className="management-table-wrap"><table className="management-table">
          <thead><tr>{report.columns.map(column => <th key={column.key} scope="col">{column.label}</th>)}</tr></thead>
          <tbody>{rows.map((row, index) => <tr key={String(row.productId ?? row.orderId ?? row.customerId ?? row.categoryId ?? row.quarter ?? index)}>
            {report.columns.map(column => <td key={column.key}>{display(row[column.key], column, row)}</td>)}
          </tr>)}</tbody>
        </table></div>}
      </section>
      <p className="management-note">Each report you run is recorded with your account.</p>
  </div>
}
