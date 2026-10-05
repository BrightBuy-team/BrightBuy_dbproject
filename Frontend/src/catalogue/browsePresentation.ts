import type { Search } from './search'

export function browseTitle(query: Search, categoryTitle: string, home: boolean): string {
  if (home) return 'Home · BrightBuy'
  const subject = query.keyword ? `Search: “${query.keyword}”` : categoryTitle
  const category = query.keyword && query.categoryId ? ` · ${categoryTitle}` : ''
  return `${subject}${category} · Page ${query.page} · BrightBuy`
}

export function resultSummary(total: number, page: number, pages: number, keyword: string): string {
  const count = `${total} ${total === 1 ? 'product' : 'products'}`
  const match = keyword ? ` matching “${keyword}”` : ''
  return `${count}${match}${total > 0 ? `. Page ${page} of ${pages}.` : '.'}`
}
