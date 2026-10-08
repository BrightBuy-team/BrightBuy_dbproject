import { useEffect } from 'react'
import type { ProductDetail } from './api'
import ProductImage from './ProductImage'
import { catalogueHref } from './routes'
import { defaultSearch } from './search'
import type { Search } from './search'
import { useProductDetail } from './useCatalogue'
import VariantSelection from './VariantSelection'

export default function ProductDetailPage({ productId, query }: { productId: number; query: Search }) {
  const { data, error, status, loading, retry } = useProductDetail(productId)
  useEffect(() => {
    document.title = `${data?.name ?? (status === 404 ? 'Product unavailable' : 'Product details')} · BrightBuy`
    return () => { document.title = 'BrightBuy · Catalogue' }
  }, [data?.name, status])
  return <ProductDetailView query={query} data={data} error={error} status={status} loading={loading} retry={retry} />
}

type DetailViewProps = {
  query: Search
  data?: ProductDetail
  error?: string
  status?: number
  loading: boolean
  retry: () => void
}

export function ProductDetailView({ query, data, error, status, loading, retry }: DetailViewProps) {
  const backHref = catalogueHref(query)

  return <section className="catalogue-detail" aria-label="Product details" aria-busy={loading}>
    <a className="catalogue-back" href={backHref}>← Back to results</a>
    {loading && <div className="catalogue-detail-state"><h1>Product details</h1><p role="status">Loading product details…</p><div className="catalogue-detail-skeleton" aria-hidden="true" /></div>}
    {error && <div className="catalogue-detail-state" role="alert">
      <h1>{status === 404 ? 'Product unavailable' : 'Unable to load product'}</h1>
      <p>{status === 404 ? 'This product may have been removed or is no longer available.' : error}</p>
      {status !== 404 && <button onClick={retry}>Try again</button>}
      <a href={backHref}>Return to results</a>
    </div>}
    {data && <div className="catalogue-detail-layout">
      <div className="catalogue-product-image catalogue-detail-image"><ProductImage key={data.image_url} src={data.image_url} name={data.name} /></div>
      <div className="catalogue-detail-content">
        <p className="catalogue-section-label">PRODUCT DETAILS</p>
        <h1>{data.name}</h1>
        <p className="catalogue-sku">SKU: {data.sku}</p>
        <VariantSelection key={data.product_id} variants={data.variants} productId={data.product_id} productName={data.name} />
        <h2>About this product</h2>
        <p className="catalogue-description">{data.description?.trim() ? data.description : 'No description is available for this product yet.'}</p>
        {data.categories.length > 0 && <>
          <h2>Categories</h2>
          <ul className="catalogue-detail-categories">{data.categories.map(category => <li key={category.category_id}>
            <a href={catalogueHref({ ...defaultSearch, categoryId: String(category.category_id) })}>{category.name}</a>
          </li>)}</ul>
        </>}
      </div>
    </div>}
  </section>
}
