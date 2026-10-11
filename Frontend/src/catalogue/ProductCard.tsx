import { ArrowRight } from 'lucide-react'
import type { Product } from './api'
import type { Search } from './search'
import { formatPrice } from './search'
import { catalogueHref } from './routes'
import ProductImage from './ProductImage'

export default function ProductCard({ product, query }: { product: Product; query: Search }) {
  const inStock = product.matching_stock_quantity > 0
  const href = catalogueHref(query, product.product_id)
  return <article className="catalogue-card">
    <div className="catalogue-product-image">
      <span className={`catalogue-stock ${inStock ? '' : 'unavailable'}`}>{inStock ? 'In stock' : 'Out of stock'}</span>
      <ProductImage src={product.image_url} name={product.name} />
    </div>
    <div className="catalogue-card-content">
      <p className="catalogue-sku">{product.sku}</p>
      <h3><a href={href}>{product.name}</a></h3>
      <p className="catalogue-card-caption">{product.matching_variant_count} matching {product.matching_variant_count === 1 ? 'variant' : 'variants'}<span aria-hidden="true"> · </span>{product.matching_stock_quantity} units available</p>
      <div className="catalogue-card-foot">
        <p className="catalogue-product-price">{formatPrice(product.min_price)}{product.max_price !== product.min_price && <><span> – </span>{formatPrice(product.max_price)}</>}</p>
        <span className="catalogue-card-action" aria-hidden="true"><ArrowRight /></span>
      </div>
    </div>
  </article>
}
