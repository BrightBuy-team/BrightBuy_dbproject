import { useEffect, useState } from 'react'
import type { FormEvent } from 'react'
import { ArrowRight, ChevronLeft, ChevronRight, CreditCard, PackageCheck, Clock3, SlidersHorizontal, Truck } from 'lucide-react'
import { motion } from 'framer-motion'
import { decodeCategories, decodeProducts } from './api'
import type { Category } from './api'
import { defaultSearch, parseSearch, searchParams, sorts } from './search'
import type { Search } from './search'
import { navigate, useBrowseNavigation, useCatalogue, useSearchLocation } from './useCatalogue'
import { resultSummary } from './browsePresentation'
import { catalogueHref, parseCatalogueRoute } from './routes'
import ProductDetailPage from './ProductDetailPage'
import ProductImage, { PackageIcon } from './ProductImage'
import ProductCard from './ProductCard'
import HomeHighlights from './HomeHighlights'
import { isCatalogueHome } from './home'
import CategoryNavigation from './CategoryNavigation'
import CatalogueFooter from './CatalogueFooter'
import CatalogueHeader from './CatalogueHeader'
import CartView from './CartView'
import CheckoutView from './CheckoutView'
import OrderHistoryView from './OrderHistoryView'
import AccountView from './AccountView'
import { MotionRoot, Reveal, Stagger, StaggerItem, ViewTransition } from '../ui/motion'

// Staff pages used to live under ?view= here. They now have their own console.
const consoleSections: Record<string, string> = { staff: 'products', reports: 'reports', admin: 'staff' }

function ErrorNotice({ message, retry }: { message: string; retry: () => void }) {
  return <div className="catalogue-notice" role="alert"><h3>Something needs attention</h3><p>{message}</p><button className="bb-btn" onClick={retry}>Try again</button></div>
}

function Filters({ query, categories, reset }: { query: Search; categories: Category[]; reset: () => void }) {
  const [error, setError] = useState('')
  function apply(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const data = new FormData(event.currentTarget)
    const params = searchParams({ ...query, page: 1 })
    for (const name of ['minPrice', 'maxPrice']) {
      const value = String(data.get(name) ?? '').trim()
      if (value) params.set(name, value)
      else params.delete(name)
    }
    params.set('inStockOnly', data.has('inStockOnly') ? 'true' : 'false')
    try { const next = parseSearch(params); setError(''); navigate(next) }
    catch (failure) { setError((failure as Error).message) }
  }
  const ordered = categories.filter(category => category.parent_category_id === null)
    .flatMap(root => [root, ...categories.filter(category => category.parent_category_id === root.category_id)])
  return <aside className="catalogue-sidebar bb-card" aria-label="Catalogue filters">
    <div className="catalogue-sidebar-head"><SlidersHorizontal aria-hidden="true" /><h2>Filter products</h2></div>
    <h3>Categories</h3>
    <nav aria-label="Product categories">
      <button className={!query.categoryId ? 'selected' : ''} aria-current={!query.categoryId ? 'page' : undefined}
        onClick={() => navigate({ ...query, categoryId: '', page: 1 })}>All products</button>
      {ordered.map(category => <button key={category.category_id}
        className={`${category.parent_category_id ? 'child' : ''} ${query.categoryId === String(category.category_id) ? 'selected' : ''}`}
        aria-current={query.categoryId === String(category.category_id) ? 'page' : undefined}
        onClick={() => navigate({ ...query, categoryId: String(category.category_id), page: 1 })}>
        {category.name}<span>{category.product_count}</span>
      </button>)}
    </nav>
    <form onSubmit={apply} className="catalogue-price-form">
      <h3>Price and availability</h3>
      <div className="catalogue-price-fields">
        <label className="bb-field">Minimum (USD)<input name="minPrice" inputMode="decimal" placeholder="0.00" defaultValue={query.minPrice} aria-invalid={!!error} aria-describedby={error ? 'filter-error' : undefined} /></label>
        <label className="bb-field">Maximum (USD)<input name="maxPrice" inputMode="decimal" placeholder="Any" defaultValue={query.maxPrice} aria-invalid={!!error} aria-describedby={error ? 'filter-error' : undefined} /></label>
      </div>
      <label className="catalogue-checkbox"><input name="inStockOnly" type="checkbox" defaultChecked={query.inStockOnly} />In stock only</label>
      {error && <p className="catalogue-field-error" id="filter-error" role="alert">{error}</p>}
      <button className="bb-btn bb-btn-primary bb-btn-block" type="submit">Apply filters</button>
      <button className="bb-btn bb-btn-ghost bb-btn-block" type="button" onClick={reset}>Reset all filters</button>
    </form>
    <p className="catalogue-fine-print">All prices are shown in USD.</p>
  </aside>
}

function Results({ query, title, home, reset }: { query: Search; title: string; home: boolean; reset: () => void }) {
  useBrowseNavigation(query, title, home)
  const { data, error, loading, retry } = useCatalogue(`/products?${searchParams(query)}`, decodeProducts)
  const Heading = home ? 'h2' : 'h1'
  return <section className="catalogue-results" aria-labelledby="results-heading" aria-busy={loading}>
    <div className="catalogue-results-header bb-card">
      <div><p className="bb-eyebrow">The catalogue</p><Heading id="results-heading" tabIndex={-1}>{title}</Heading>
        <p className="catalogue-result-count" role="status" aria-atomic="true">{loading ? 'Finding your products…' : data ? resultSummary(data.total_products, data.page, data.total_pages, query.keyword) : 'Products unavailable'}</p>
      </div>
      <label className="catalogue-sort">Sort by<select value={query.sort} onChange={event => navigate({ ...query, sort: event.target.value as Search['sort'], page: 1 })}>
        {Object.entries(sorts).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
      </select></label>
    </div>
    {loading && <div className="catalogue-grid" aria-hidden="true">{Array.from({ length: 6 }, (_, index) => <div className="catalogue-skeleton bb-skeleton" key={index} />)}</div>}
    {error && <ErrorNotice message={error} retry={retry} />}
    {data && data.items.length === 0 && <div className="catalogue-empty bb-card"><PackageIcon /><h3>{data.total_products ? 'No products on this page' : 'No products found'}</h3>
      <p>{data.total_products ? 'Go back to the first page to see the matching products.' : 'Try a different search or widen your filters.'}</p>
      <button className="bb-btn bb-btn-primary" onClick={() => data.total_products ? navigate({ ...query, page: 1 }) : reset()}>{data.total_products ? 'Go to first page' : 'Clear search & filters'}</button>
    </div>}
    {data && data.items.length > 0 && <>
      <Stagger key={`${searchParams(query)}`} className="catalogue-grid">{data.items.map(product =>
        <StaggerItem key={`${product.product_id}:${product.image_url}`}><ProductCard product={product} query={query} /></StaggerItem>)}</Stagger>
      <nav className="catalogue-pagination bb-card" aria-label="Product pages">
        <button className="bb-btn bb-btn-sm" disabled={query.page <= 1} onClick={() => navigate({ ...query, page: query.page - 1 })}><ChevronLeft aria-hidden="true" />Previous</button>
        <span>Page {data.page} of {data.total_pages}</span>
        <button className="bb-btn bb-btn-sm" disabled={query.page >= data.total_pages || query.page >= 1000000} onClick={() => navigate({ ...query, page: query.page + 1 })}>Next<ChevronRight aria-hidden="true" /></button>
      </nav>
    </>}
  </section>
}

export function CatalogueHero() {
  const float = (delay: number) => ({ animate: { y: [0, -7, 0] }, transition: { duration: 5, repeat: Infinity, ease: 'easeInOut' as const, delay } })
  return <section className="catalogue-hero" aria-labelledby="catalogue-heading">
    <motion.div className="catalogue-hero-copy" initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}>
      <p className="bb-chip">Electronics and toys, delivered across Texas</p>
      <h1 id="catalogue-heading">Premium tech,<br /><em>Texas velocity.</em></h1>
      <p>Phones, laptops, audio, smart devices and toys. Delivered in 5 days to main Texas cities, or ready for store pickup.</p>
      <div className="catalogue-hero-actions">
        <a className="bb-btn bb-btn-primary bb-btn-lg" href="#results-heading">Explore products<ArrowRight aria-hidden="true" /></a>
        <a className="bb-btn bb-btn-lg" href="?view=orders">Track my orders</a>
      </div>
      <dl className="catalogue-hero-facts">
        <div><dt>5 days</dt><dd>Main Texas cities</dd></div>
        <div><dt>7 days</dt><dd>Other Texas cities</dd></div>
        <div><dt>+3 days</dt><dd>If an item is back-ordered</dd></div>
      </dl>
    </motion.div>
    <div className="catalogue-hero-art" role="group" aria-label="Featured product photos">
      <motion.figure className="hero-product hero-laptop" {...float(0)}>
        <ProductImage src={null} name="BrightBuy Air Laptop" />
      </motion.figure>
      <motion.figure className="hero-product hero-phone" {...float(0.8)}>
        <ProductImage src={null} name="Apple iPhone 15 Pro" />
      </motion.figure>
      <motion.figure className="hero-product hero-headset" {...float(1.6)}>
        <ProductImage src={null} name="BrightBuy Gaming Headset" />
      </motion.figure>
      <motion.figure className="hero-product hero-toy" {...float(2.4)}>
        <ProductImage src={null} name="BrightBuy Toy Robot" />
      </motion.figure>
    </div>
  </section>
}

function Promises() {
  const items = [
    { icon: <Truck aria-hidden="true" />, title: '5 or 7 day delivery', text: 'Main Texas cities in 5 days, other cities in 7.' },
    { icon: <PackageCheck aria-hidden="true" />, title: 'Store pickup', text: 'Order online and collect at the store.' },
    { icon: <CreditCard aria-hidden="true" />, title: 'Cash or card', text: 'Pay on delivery, or by card at checkout.' },
    { icon: <Clock3 aria-hidden="true" />, title: 'Out of stock? Still order', text: 'We back-order it: delivery takes 3 days longer.' },
  ]
  return <Stagger className="catalogue-promises">{items.map(item => <StaggerItem key={item.title} className="bb-card">
    <span>{item.icon}</span><div><strong>{item.title}</strong><p>{item.text}</p></div></StaggerItem>)}</Stagger>
}

export default function CatalogueApp() {
  const location = useSearchLocation()
  const categories = useCatalogue('/categories', decodeCategories)
  let query = defaultSearch
  let linkError: string
  let productId: number | null = null
  // ?view= opens an account page; everything else is the catalogue search.
  const urlParams = new URLSearchParams(location)
  const view = urlParams.get('view')
  urlParams.delete('view')
  try {
    const route = parseCatalogueRoute(`?${urlParams}`)
    query = route.query
    productId = route.productId
    linkError = route.error
  }
  catch (error) { linkError = (error as Error).message }
  const [resetVersion, setResetVersion] = useState(0)
  const formKey = `${location}:${resetVersion}`
  useEffect(() => {
    if (resetVersion > 0) document.getElementById('results-heading')?.focus()
  }, [resetVersion])
  const consoleSection = view ? consoleSections[view] : undefined
  useEffect(() => {
    if (consoleSection) window.location.replace(`/console.html?section=${consoleSection}`)
  }, [consoleSection])
  const activeCategory = categories.data?.find(category => String(category.category_id) === query.categoryId)
  const title = activeCategory?.name ?? (query.categoryId ? 'Category products' : 'All products')
  const home = isCatalogueHome(query, productId, linkError) && !view
  function resetFilters() {
    // A same-URL reset still needs to discard unsubmitted drafts and errors.
    setResetVersion(version => version + 1)
    navigate(defaultSearch)
  }
  const viewKey = view ?? (productId ? `product-${productId}` : linkError ? 'error' : 'browse')
  return <MotionRoot><div className="catalogue-app">
    <a href="#catalogue-content" className="catalogue-skip">Skip to products</a>
    <div className="catalogue-topline">Free store pickup · 5-day delivery to main Texas cities · Out-of-stock items can be back-ordered</div>
    <CatalogueHeader key={formKey} query={query} homeHref={window.location.pathname} />
    <CategoryNavigation categories={categories.data} loading={categories.loading} error={categories.error}
      retry={categories.retry} currentCategoryId={!productId && !linkError && !view ? query.categoryId : undefined} />
    <main id="catalogue-content" tabIndex={-1}>
      <ViewTransition viewKey={viewKey}>
        {consoleSection ? <p role="status" className="bb-muted">Opening the staff console…</p>
          : view === 'orders' ? <OrderHistoryView />
          : view === 'account' ? <AccountView />
          : view === 'cart' ? <CartView onCheckout={() => window.location.assign('?view=checkout')}
            onContinueShopping={() => window.location.assign(catalogueHref(query))} />
          : view === 'checkout' ? <CheckoutView onBack={() => window.location.assign('?view=cart')} />
          : <>
            {home && <CatalogueHero />}
            {home && <Promises />}
            {home && <Reveal><HomeHighlights categories={categories} /></Reveal>}
            <div className="catalogue-breadcrumb"><a href={window.location.pathname}>Home</a><span aria-hidden="true">/</span><span>{productId ? 'Product details' : title}</span></div>
            {linkError ? <div className="catalogue-detail-state" role="alert"><h1>Invalid catalogue link</h1><p>{linkError}</p><a href={catalogueHref(query)}>Back to results</a></div>
              : productId ? <ProductDetailPage key={productId} productId={productId} query={query} /> : <div className="catalogue-layout">
              <div>
                {categories.loading && <p role="status">Loading categories…</p>}
                {categories.error && <ErrorNotice message={categories.error} retry={categories.retry} />}
                <Filters key={formKey} query={query} categories={categories.data ?? []} reset={resetFilters} />
              </div>
              <Results query={query} title={title} home={home} reset={resetFilters} />
            </div>}
          </>}
      </ViewTransition>
    </main>
    <CatalogueFooter />
  </div></MotionRoot>
}
