import { useEffect, useState } from 'react'
import type { FormEvent } from 'react'
import { decodeCategories, decodeProducts } from './api'
import type { Category } from './api'
import { defaultSearch, parseSearch, searchParams, sorts } from './search'
import type { Search } from './search'
import { navigate, useBrowseNavigation, useCatalogue, useSearchLocation } from './useCatalogue'
import { resultSummary } from './browsePresentation'
import { catalogueHref, parseCatalogueRoute } from './routes'
import ProductDetailPage from './ProductDetailPage'
import { PackageIcon } from './ProductImage'
import ProductCard from './ProductCard'
import HomeHighlights from './HomeHighlights'
import { isCatalogueHome } from './home'
import CategoryNavigation from './CategoryNavigation'
import CatalogueFooter from './CatalogueFooter'
import CatalogueHeader from './CatalogueHeader'
import ManagementReports from './ManagementReports'

function ErrorNotice({ message, retry }: { message: string; retry: () => void }) {
  return <div className="catalogue-notice" role="alert"><h3>Something needs attention</h3><p>{message}</p><button onClick={retry}>Try again</button></div>
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
  return <aside className="catalogue-sidebar" aria-label="Catalogue filters">
    <div className="catalogue-section-label">FIND YOUR NEXT PICK</div>
    <h2>Categories</h2>
    <nav aria-label="Product categories">
      <button className={!query.categoryId ? 'selected' : ''} aria-current={!query.categoryId ? 'page' : undefined}
        onClick={() => navigate({ ...query, categoryId: '', page: 1 })}>All products <span>↗</span></button>
      {ordered.map(category => <button key={category.category_id}
        className={`${category.parent_category_id ? 'child' : ''} ${query.categoryId === String(category.category_id) ? 'selected' : ''}`}
        aria-current={query.categoryId === String(category.category_id) ? 'page' : undefined}
        onClick={() => navigate({ ...query, categoryId: String(category.category_id), page: 1 })}>
        {category.name}<span>{category.product_count}</span>
      </button>)}
    </nav>
    <form onSubmit={apply} className="catalogue-price-form">
      <h2>Price & availability</h2>
      <div className="catalogue-price-fields">
        <label>Minimum<input name="minPrice" inputMode="decimal" placeholder="0.00" defaultValue={query.minPrice} aria-invalid={!!error} aria-describedby={error ? 'filter-error' : undefined} /></label>
        <label>Maximum<input name="maxPrice" inputMode="decimal" placeholder="Any" defaultValue={query.maxPrice} aria-invalid={!!error} aria-describedby={error ? 'filter-error' : undefined} /></label>
      </div>
      <label className="catalogue-checkbox"><input name="inStockOnly" type="checkbox" defaultChecked={query.inStockOnly} />In stock only</label>
      {error && <p className="catalogue-field-error" id="filter-error" role="alert">{error}</p>}
      <button className="catalogue-primary" type="submit">Apply filters</button>
      <button className="catalogue-text-button" type="button" onClick={reset}>Reset all filters</button>
    </form>
    <p className="catalogue-fine-print">All prices are shown in USD.</p>
  </aside>
}

function Results({ query, title, home, reset }: { query: Search; title: string; home: boolean; reset: () => void }) {
  useBrowseNavigation(query, title, home)
  const { data, error, loading, retry } = useCatalogue(`/products?${searchParams(query)}`, decodeProducts)
  const Heading = home ? 'h2' : 'h1'
  return <section className="catalogue-results" aria-labelledby="results-heading" aria-busy={loading}>
    <div className="catalogue-results-header">
      <div><p className="catalogue-section-label">THE CATALOGUE</p><Heading id="results-heading" tabIndex={-1}>{title}</Heading>
        <p className="catalogue-result-count" role="status" aria-atomic="true">{loading ? 'Finding your products…' : data ? resultSummary(data.total_products, data.page, data.total_pages, query.keyword) : 'Products unavailable'}</p>
      </div>
      <label className="catalogue-sort">Sort by<select value={query.sort} onChange={event => navigate({ ...query, sort: event.target.value as Search['sort'], page: 1 })}>
        {Object.entries(sorts).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
      </select></label>
    </div>
    {loading && <div className="catalogue-grid" aria-hidden="true">{Array.from({ length: 6 }, (_, index) => <div className="catalogue-skeleton" key={index} />)}</div>}
    {error && <ErrorNotice message={error} retry={retry} />}
    {data && data.items.length === 0 && <div className="catalogue-empty"><PackageIcon /><h3>{data.total_products ? 'No products on this page' : 'No products found'}</h3>
      <p>{data.total_products ? 'Go back to the first page to see the matching products.' : 'Try a different search or widen your filters.'}</p>
      <button onClick={() => data.total_products ? navigate({ ...query, page: 1 }) : reset()}>{data.total_products ? 'Go to first page' : 'Clear search & filters'}</button>
    </div>}
    {data && data.items.length > 0 && <>
      <div className="catalogue-grid">{data.items.map(product => <ProductCard key={`${product.product_id}:${product.image_url}`} product={product} query={query} />)}</div>
      <nav className="catalogue-pagination" aria-label="Product pages">
        <button disabled={query.page <= 1} onClick={() => navigate({ ...query, page: query.page - 1 })}>← Previous</button>
        <span>Page {data.page} of {data.total_pages}</span>
        <button disabled={query.page >= data.total_pages || query.page >= 1000000} onClick={() => navigate({ ...query, page: query.page + 1 })}>Next →</button>
      </nav>
    </>}
  </section>
}

function CatalogueStorefront() {
  const location = useSearchLocation()
  const categories = useCatalogue('/categories', decodeCategories)
  let query = defaultSearch
  let linkError: string
  let productId: number | null = null
  try {
    const route = parseCatalogueRoute(location)
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
  const activeCategory = categories.data?.find(category => String(category.category_id) === query.categoryId)
  const title = activeCategory?.name ?? (query.categoryId ? 'Category products' : 'All products')
  const home = isCatalogueHome(query, productId, linkError)
  function resetFilters() {
    // A same-URL reset still needs to discard unsubmitted drafts and errors.
    setResetVersion(version => version + 1)
    navigate(defaultSearch)
  }
  return <div className="catalogue-app">
    <a href="#catalogue-content" className="catalogue-skip">Skip to products</a>
    <div className="catalogue-topline">A little discovery. A brighter day.</div>
    <CatalogueHeader key={formKey} query={query} homeHref={window.location.pathname} />
    <CategoryNavigation categories={categories.data} loading={categories.loading} error={categories.error}
      retry={categories.retry} currentCategoryId={!productId && !linkError ? query.categoryId : undefined} />
    <main id="catalogue-content" tabIndex={-1}>
      {home && <section className="catalogue-hero" aria-labelledby="catalogue-heading">
        <div><p className="catalogue-section-label">WELCOME TO BRIGHTBUY</p><h1 id="catalogue-heading">Good finds.<br /><em>Everyday possibilities.</em></h1><p>Explore the collection. Find the details that make it yours.</p><a href="#results-heading">Explore products <span aria-hidden="true">↘</span></a></div>
        <div className="catalogue-hero-art" aria-hidden="true"><div className="catalogue-art-orbit" /><div className="catalogue-art-box"><PackageIcon /></div><span className="catalogue-art-caption">YOUR NEXT FIND</span><span className="catalogue-art-spark">✳</span></div>
      </section>}
      {home && <HomeHighlights categories={categories} />}
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
    </main>
    <CatalogueFooter />
  </div>
}

export default function CatalogueApp() {
  return window.location.pathname === '/management-reports'
    ? <ManagementReports />
    : <CatalogueStorefront />
}
