import { useState, useSyncExternalStore } from 'react'
import type { FormEvent } from 'react'
import type { Search } from './search'
import { navigate } from './useCatalogue'
import { catalogueCartQuantity, subscribeCatalogueCart } from './cartHandoff'
import AccountStatus from './AccountStatus'

const readCartCount = () => catalogueCartQuantity()
const serverCartCount = () => 0

// The parent keys this component by route/reset so draft errors cannot leak
// into a different browse or detail page.
export default function CatalogueHeader({ query, homeHref }: { query: Search; homeHref: string }) {
  const [error, setError] = useState('')
  const cartCount = useSyncExternalStore(subscribeCatalogueCart, readCartCount, serverCartCount)

  function search(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const keyword = String(new FormData(event.currentTarget).get('keyword') ?? '').trim()
    if ([...keyword].length > 255) { setError('Search must be 255 characters or fewer.'); return }
    setError('')
    navigate({ ...query, keyword, page: 1 })
  }
  return <>
    <header className="catalogue-header">
      <a className="catalogue-brand" href={homeHref} aria-label="BrightBuy home"><span className="catalogue-brand-mark">b.</span><span>BrightBuy<small> TEXAS RETAIL</small></span></a>
      <form className="catalogue-search" role="search" onSubmit={search}>
        <label className="catalogue-visually-hidden" htmlFor="catalogue-keyword">Search products</label>
        <input id="catalogue-keyword" name="keyword" type="search" defaultValue={query.keyword} placeholder="Search products, brands, or SKUs" aria-invalid={!!error} aria-describedby={error ? 'search-error' : undefined} />
        <button type="submit"><span className="catalogue-search-icon" aria-hidden="true">⌕</span><span className="catalogue-search-label">Search</span></button>
      </form>
      <nav className="catalogue-site-navigation" aria-label="Site navigation">
        <a href="/catalogue.html">Shop</a>
        <a href="?view=orders">My orders</a>
        <a href="/delivery.html">Track delivery</a>
      </nav>
      <a className="catalogue-cart" href="?view=cart" aria-label={`Cart, ${cartCount} items`}>
        <span aria-hidden="true">▱</span>
        Cart (<span id="cart-count">{cartCount}</span>)
      </a>
      <a className="catalogue-sign-in" href="/?view=login"><span aria-hidden="true">♙</span> Sign in</a>
      <details className="catalogue-more-links">
        <summary>More</summary>
        <div>
          <a href="/inventory.html">Inventory</a>
          <a href="?view=staff">Catalogue staff</a>
          <a href="?view=reports">Reports</a>
          <a href="?view=admin">Admin</a>
        </div>
      </details>
    </header>
    {error && <p className="catalogue-field-error catalogue-search-error" id="search-error" role="alert">{error}</p>}
    <AccountStatus />
  </>
}
