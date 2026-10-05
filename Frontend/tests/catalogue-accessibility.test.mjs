import assert from 'node:assert/strict'
import { test } from 'node:test'
import { browseTitle, resultSummary } from '../src/catalogue/browsePresentation.ts'
import { defaultSearch } from '../src/catalogue/search.ts'

test('Home has a recognisable browser title', () => {
  assert.equal(browseTitle(defaultSearch, 'All products', true), 'Home · BrightBuy')
})
test('browse titles include category and page', () => {
  assert.equal(browseTitle({ ...defaultSearch, categoryId: '1', page: 2 }, 'Electronics', false),
    'Electronics · Page 2 · BrightBuy')
})
test('search titles include keyword and optional category context', () => {
  assert.equal(browseTitle({ ...defaultSearch, keyword: 'phone' }, 'All products', false),
    'Search: “phone” · Page 1 · BrightBuy')
  assert.equal(browseTitle({ ...defaultSearch, keyword: 'phone', categoryId: '1' }, 'Electronics', false),
    'Search: “phone” · Electronics · Page 1 · BrightBuy')
})
test('result announcements include counts, keyword and current page', () => {
  assert.equal(resultSummary(25, 2, 3, 'phone'), '25 products matching “phone”. Page 2 of 3.')
  assert.equal(resultSummary(1, 1, 1, ''), '1 product. Page 1 of 1.')
})
test('empty results do not announce page one of zero', () => {
  assert.equal(resultSummary(0, 1, 0, ''), '0 products.')
  assert.equal(resultSummary(0, 1, 0, 'phone'), '0 products matching “phone”.')
})
