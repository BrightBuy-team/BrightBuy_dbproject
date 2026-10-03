import { defaultSearch, searchParams } from './search.ts'
import type { Search } from './search.ts'

export function isCatalogueHome(query: Search, productId: number | null, error: string): boolean {
  return !productId && !error && searchParams(query).toString() === searchParams(defaultSearch).toString()
}

// A transparent, reproducible selection rule; not a sales/popularity claim.
export const featuredProductsPath = `/products?${searchParams({ ...defaultSearch, inStockOnly: true, sort: 'newest', pageSize: 6 })}`
