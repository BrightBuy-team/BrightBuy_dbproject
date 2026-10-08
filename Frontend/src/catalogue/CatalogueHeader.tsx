import { useState, useEffect } from 'react'
import type { FormEvent } from 'react'
import type { Search } from './search'
import { navigate } from './useCatalogue'
import { getCartTotalQuantity } from './cart'

// The parent keys this component by route/reset so draft errors cannot leak
// into a different browse or detail page.
export default function CatalogueHeader({ query, homeHref }: { query: Search; homeHref: string }) {
  const [error, setError] = useState('')
  const [cartCount, setCartCount] = useState(0)

  useEffect(() => {
    setCartCount(getCartTotalQuantity())
    const handleUpdate = () => setCartCount(getCartTotalQuantity())
    window.addEventListener('cart-updated', handleUpdate)
    return () => window.removeEventListener('cart-updated', handleUpdate)
  }, [])

  function search(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const keyword = String(new FormData(event.currentTarget).get('keyword') ?? '').trim()
    if ([...keyword].length > 255) { setError('Search must be 255 characters or fewer.'); return }
    setError('')
    navigate({ ...query, keyword, page: 1 })
  }
  const localEmail = localStorage.getItem('currentUserEmail');
  const localRole = localStorage.getItem('role');
  const displayEmail = localEmail || localRole;
  const isSignedIn = !!displayEmail;

  return <>
    <header className="catalogue-header" style={{ alignItems: 'center' }}>
      <a className="catalogue-brand" href={homeHref} aria-label="BrightBuy home"><span className="catalogue-brand-mark">b.</span>BrightBuy<span className="catalogue-brand-dot">●</span></a>
      <nav style={{display: 'flex', gap: '1.5rem', margin: '0 1.5rem', fontWeight: 600}}>
        <a href="/catalogue.html" style={{color: 'inherit', textDecoration: 'none'}}>Catalogue</a>
        <a href="/inventory.html" style={{color: 'inherit', textDecoration: 'none'}}>Inventory</a>
        <a href="/delivery.html" style={{color: 'inherit', textDecoration: 'none'}}>Delivery</a>
      </nav>
      <form className="catalogue-search" role="search" onSubmit={search}>
        <label className="catalogue-visually-hidden" htmlFor="catalogue-keyword">Search products</label>
        <input id="catalogue-keyword" name="keyword" type="search" defaultValue={query.keyword} placeholder="Search products, brands, or SKUs" aria-invalid={!!error} aria-describedby={error ? 'search-error' : undefined} />
        <button type="submit">Search <span aria-hidden="true">↗</span></button>
      </form>
      <a className="catalogue-management-link" href="?view=cart" style={{marginRight: '1rem', marginLeft: '1rem'}}>
        Cart (<span id="cart-count">{cartCount}</span>)
      </a>
      {isSignedIn ? (
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', fontSize: '13px' }}>
          <span>Signed in as <strong>{displayEmail}</strong></span>
          <button onClick={() => {
            localStorage.removeItem('role');
            localStorage.removeItem('currentUserEmail');
            window.location.href = '/';
          }} style={{ padding: '0.25rem 0.75rem', background: '#ef4444', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold' }}>
            Logout
          </button>
        </div>
      ) : (
        <a className="catalogue-management-link" href="/">Login</a>
      )}
    </header>
    {error && <p className="catalogue-field-error catalogue-search-error" id="search-error" role="alert">{error}</p>}
  </>
}
