import { useState, useSyncExternalStore } from 'react'
import type { FormEvent } from 'react'
import { LayoutDashboard, PackageSearch, Search as SearchIcon, ShoppingBag, ShoppingCart, Truck } from 'lucide-react'
import type { Search } from './search'
import { navigate } from './useCatalogue'
import { catalogueCartQuantity, subscribeCatalogueCart } from './cartHandoff'
import { AccountStatusView } from './AccountStatus'
import { useSession, useSignOut } from './useSession'
import Logo from '../ui/Logo'

const readCartCount = () => catalogueCartQuantity()
const serverCartCount = () => 0

// The parent keys this component by route/reset so draft errors cannot leak
// into a different browse or detail page.
export default function CatalogueHeader({ query, homeHref }: { query: Search; homeHref: string }) {
  const [error, setError] = useState('')
  const cartCount = useSyncExternalStore(subscribeCatalogueCart, readCartCount, serverCartCount)
  const session = useSession()
  const { signOut, signingOut, error: signOutError } = useSignOut()
  const employee = session.data?.accountType === 'EMPLOYEE'

  function search(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const keyword = String(new FormData(event.currentTarget).get('keyword') ?? '').trim()
    if ([...keyword].length > 255) { setError('Search must be 255 characters or fewer.'); return }
    setError('')
    // From the cart, checkout or account pages a search goes back to the catalogue.
    if (new URLSearchParams(window.location.search).has('view')) {
      window.location.assign(`${window.location.pathname}?${new URLSearchParams({ keyword })}`)
      return
    }
    navigate({ ...query, keyword, page: 1 })
  }
  return <>
    <header className="catalogue-header">
      <div className="catalogue-header-inner">
        <Logo href={homeHref} />
        <form className="catalogue-search" role="search" onSubmit={search}>
          <label className="bb-visually-hidden" htmlFor="catalogue-keyword">Search products</label>
          <SearchIcon aria-hidden="true" />
          <input id="catalogue-keyword" name="keyword" type="search" defaultValue={query.keyword} placeholder="Search phones, laptops, audio, SKUs…" aria-invalid={!!error} aria-describedby={error ? 'search-error' : undefined} />
          <button type="submit">Search</button>
        </form>
        <nav className="catalogue-site-navigation" aria-label="Site navigation">
          <a href="/catalogue.html"><ShoppingBag aria-hidden="true" />Shop</a>
          {!employee && <a href="?view=orders"><PackageSearch aria-hidden="true" />My orders</a>}
          {!employee && <a href="/delivery.html"><Truck aria-hidden="true" />Track delivery</a>}
          {employee && <a href="/console.html"><LayoutDashboard aria-hidden="true" />Staff console</a>}
        </nav>
        <a className="catalogue-cart-link" href="?view=cart" aria-label={`Cart, ${cartCount} items`}>
          <ShoppingCart aria-hidden="true" />Cart <span id="cart-count">{cartCount}</span>
        </a>
        <AccountStatusView data={session.data} loading={session.loading} error={session.error} retry={session.retry}
          logout={signOut} signingOut={signingOut} />
      </div>
    </header>
    {error && <p className="catalogue-field-error catalogue-search-error" id="search-error" role="alert">{error}</p>}
    {signOutError && <p className="catalogue-field-error catalogue-search-error" role="alert">{signOutError}</p>}
  </>
}
