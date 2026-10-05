import type { Category } from './api'
import { defaultSearch } from './search'
import { catalogueHref } from './routes'

// Reuses the app's category request; no extra request for the header.
export default function CategoryNavigation({ categories, loading, error, retry, currentCategoryId }: {
  categories?: Category[]
  loading: boolean
  error?: string
  retry: () => void
  currentCategoryId?: string
}) {
  const roots = categories?.filter(category => category.parent_category_id === null) ?? []
  return <nav className="catalogue-category-navigation" aria-label="Catalogue navigation" aria-busy={loading}>
    <a href={catalogueHref(defaultSearch)}>All products</a>
    {loading ? <span role="status">Loading categories…</span>
      : error ? <div className="catalogue-navigation-error" role="alert">
        <span>Category navigation is unavailable.</span><button type="button" onClick={retry}>Retry navigation</button>
      </div>
      : roots.map(category => <a key={category.category_id}
        href={catalogueHref({ ...defaultSearch, categoryId: String(category.category_id) })}
        aria-current={String(category.category_id) === currentCategoryId ? 'page' : undefined}>
        {category.name}
      </a>)}
  </nav>
}
