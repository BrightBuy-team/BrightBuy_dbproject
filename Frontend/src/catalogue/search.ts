export const sorts = {
  name_asc: 'Name: A–Z',
  name_desc: 'Name: Z–A',
  price_asc: 'Price: low to high',
  price_desc: 'Price: high to low',
  newest: 'Newest first',
} as const

export type Search = {
  keyword: string
  categoryId: string
  minPrice: string
  maxPrice: string
  inStockOnly: boolean
  sort: keyof typeof sorts
  page: number
  pageSize: number
}

const allowed = new Set(['keyword', 'categoryId', 'minPrice', 'maxPrice', 'inStockOnly', 'sort', 'page', 'pageSize'])

function integer(value: string, name: string, max: number) {
  if (!/^[0-9]+$/.test(value) || Number(value) < 1 || Number(value) > max) {
    throw new Error(`${name} must be a whole number between 1 and ${max}.`)
  }
  return Number(value)
}

export function parseSearch(params: URLSearchParams): Search {
  for (const name of params.keys()) {
    if (!allowed.has(name) || params.getAll(name).length !== 1) {
      throw new Error('This catalogue link contains an unknown or repeated filter. Reset the filters to continue.')
    }
  }
  const keyword = (params.get('keyword') ?? '').trim()
  if ([...keyword].length > 255) throw new Error('Search must be 255 characters or fewer.')
  const categoryId = params.get('categoryId') ?? ''
  if (params.has('categoryId')) integer(categoryId, 'Category', 2147483647)
  const minPrice = params.get('minPrice') ?? ''
  const maxPrice = params.get('maxPrice') ?? ''
  for (const name of ['minPrice', 'maxPrice']) {
    if (params.has(name) && !/^[0-9]{1,8}(\.[0-9]{1,2})?$/.test(params.get(name)!)) {
      throw new Error('Prices must be between 0 and 99999999.99, with at most two decimal places.')
    }
  }
  if (minPrice && maxPrice && Number(minPrice) > Number(maxPrice)) {
    throw new Error('Minimum price cannot be greater than maximum price.')
  }
  const stock = params.get('inStockOnly') ?? 'false'
  if (stock !== 'true' && stock !== 'false') throw new Error('The stock filter must be true or false.')
  const sort = (params.get('sort') ?? 'name_asc').trim().toLowerCase()
  if (!Object.hasOwn(sorts, sort)) throw new Error('This sort option is not supported.')
  return {
    keyword, categoryId, minPrice, maxPrice, inStockOnly: stock === 'true',
    sort: sort as Search['sort'],
    page: integer(params.get('page') ?? '1', 'Page', 1000000),
    pageSize: integer(params.get('pageSize') ?? '12', 'Page size', 100),
  }
}

export function searchParams(query: Search): URLSearchParams {
  const params = new URLSearchParams()
  for (const key of ['keyword', 'categoryId', 'minPrice', 'maxPrice'] as const) {
    if (query[key]) params.set(key, query[key])
  }
  if (query.inStockOnly) params.set('inStockOnly', 'true')
  params.set('sort', query.sort)
  params.set('page', String(query.page))
  params.set('pageSize', String(query.pageSize))
  return params
}

export const defaultSearch = parseSearch(new URLSearchParams())

export function formatPrice(price: number): string {
  // The requested LKR display applies to catalogue and shared cart snapshots.
  // Database migration converts USD amounts once; returned prices are already LKR.
  return new Intl.NumberFormat('en-LK', { style: 'currency', currency: 'LKR', currencyDisplay: 'code', minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(price)
}
