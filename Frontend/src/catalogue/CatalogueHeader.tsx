import { useState } from 'react'
import type { FormEvent } from 'react'
import type { Search } from './search'
import { navigate, useCart } from './useCatalogue'
import AccountStatus from './AccountStatus'
import { cartHref, cartUnitCount } from './cart'

// Set once the cart page exists; until then the indicator is plain text.
const cartUrl = cartHref(import.meta.env.VITE_CART_URL)

// The parent keys this component by route/reset so draft errors cannot leak
// into a different browse or detail page.
export default function CatalogueHeader({ query, homeHref }: { query: Search; homeHref: string }) {
  const [error, setError] = useState('')
  const units = cartUnitCount(useCart())
  const cartLabel = `Cart, ${units} ${units === 1 ? 'item' : 'items'}`
  function search(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const keyword = String(new FormData(event.currentTarget).get('keyword') ?? '').trim()
    if ([...keyword].length > 255) { setError('Search must be 255 characters or fewer.'); return }
    setError('')
    navigate({ ...query, keyword, page: 1 })
  }
  return <>
    <header className="catalogue-header">
      <a className="catalogue-brand" href={homeHref} aria-label="BrightBuy home"><span className="catalogue-brand-mark">b.</span>BrightBuy<span className="catalogue-brand-dot">●</span></a>
      <form className="catalogue-search" role="search" onSubmit={search}>
        <label className="catalogue-visually-hidden" htmlFor="catalogue-keyword">Search products</label>
        <input id="catalogue-keyword" name="keyword" type="search" defaultValue={query.keyword} placeholder="Search products, brands, or SKUs" aria-invalid={!!error} aria-describedby={error ? 'search-error' : undefined} />
        <button type="submit">Search <span aria-hidden="true">↗</span></button>
      </form>
      <a className="catalogue-management-link" href="/" style={{marginRight: '1rem', fontWeight: 'bold'}}>← Back to Home</a>
      <a className="catalogue-management-link" href="/management-reports">Management reports</a>
      {cartUrl
        ? <a className="catalogue-cart" href={cartUrl} aria-label={cartLabel}>Cart <span aria-hidden="true">({units})</span></a>
        : <span className="catalogue-cart" role="status" aria-label={cartLabel}>Cart <span aria-hidden="true">({units})</span></span>}
      <span className="catalogue-header-note">The everyday collection</span>
    </header>
    <AccountStatus />
    {error && <p className="catalogue-field-error catalogue-search-error" id="search-error" role="alert">{error}</p>}
  </>
}
