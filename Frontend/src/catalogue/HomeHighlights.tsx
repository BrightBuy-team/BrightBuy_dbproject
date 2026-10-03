import { decodeProducts } from './api'
import type { Category, ProductPage } from './api'
import { defaultSearch } from './search'
import { catalogueHref } from './routes'
import { featuredProductsPath } from './home'
import { useCatalogue } from './useCatalogue'
import ProductCard from './ProductCard'

type LoadState<T> = { data?: T; loading: boolean; error?: string; retry: () => void }

export default function HomeHighlights({ categories }: { categories: LoadState<Category[]> }) {
  const featured = useCatalogue(featuredProductsPath, decodeProducts)
  return <HomeHighlightsView categories={categories} featured={featured} />
}

export function HomeHighlightsView({ categories, featured }: {
  categories: LoadState<Category[]>
  featured: LoadState<ProductPage>
}) {
  const roots = categories.data?.filter(category => category.parent_category_id === null) ?? []
  return <div className="catalogue-home-highlights">
    <section aria-labelledby="home-categories-heading" aria-busy={categories.loading}>
      <p className="catalogue-section-label">EXPLORE THE COLLECTION</p>
      <h2 id="home-categories-heading">Shop by category</h2>
      {categories.loading ? <p role="status">Loading categories…</p>
        : categories.error ? <div className="catalogue-notice" role="alert"><p>{categories.error}</p><button onClick={categories.retry}>Retry categories</button></div>
        : roots.length ? <nav className="catalogue-root-categories" aria-label="Top-level categories">
          {roots.map(category => <a key={category.category_id} href={catalogueHref({ ...defaultSearch, categoryId: String(category.category_id) })}>
            <strong>{category.name}</strong><span>{category.product_count} {category.product_count === 1 ? 'product' : 'products'} <span aria-hidden="true">↗</span></span>
          </a>)}
        </nav> : <p>No categories are available yet. You can still browse all products below.</p>}
    </section>
    <section aria-labelledby="featured-heading" aria-busy={featured.loading}>
      <div className="catalogue-home-section-heading"><div>
        <p className="catalogue-section-label">A PLACE TO START</p>
        <h2 id="featured-heading">Featured products</h2>
        <p>Explore up to six of our newest in-stock products.</p>
      </div><a href="#results-heading">Browse all products <span aria-hidden="true">↘</span></a></div>
      {featured.loading ? <><p role="status">Loading featured products…</p><div className="catalogue-grid" aria-hidden="true">{[1, 2, 3].map(id => <div className="catalogue-skeleton" key={id} />)}</div></>
        : featured.error ? <div className="catalogue-notice" role="alert"><p>{featured.error}</p><button onClick={featured.retry}>Retry featured products</button></div>
        : featured.data?.items.length ? <div className="catalogue-grid">{featured.data.items.slice(0, 6).map(product => <ProductCard key={product.product_id} product={product} query={defaultSearch} />)}</div>
        : <p className="catalogue-empty">No featured products are available right now. Browse the full catalogue below.</p>}
    </section>
  </div>
}
