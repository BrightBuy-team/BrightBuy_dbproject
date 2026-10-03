# Catalogue frontend

Start the backend using [its catalogue profile instructions](../Backend/CATALOGUE_API.md),
then run from `Frontend`:

```sh
npm run dev -- --port 5173 --strictPort
```

Open `http://localhost:5173/catalogue.html` through the development server,
not by opening the HTML file with a `file://` URL. The shared `/` starter is
unchanged. If needed, set `VITE_CATALOGUE_API_URL` to the full catalogue API
base URL before starting Vite; its default is `http://localhost:8080/api/catalogue`.
Keep credentials out of frontend environment variables.

## Home / catalogue landing (UI-1)

The default catalogue route shows the hero, a top-level category list and a
featured-products section, followed by the full browse catalogue. Featured means
**up to six newest in-stock products**, selected with the existing search API
(`sort=newest`, `inStockOnly=true`, `page=1`, `pageSize=6`); this is not a
popularity ranking or a manually curated database flag. One additional read is
made only while Home is mounted. Category data reuses the existing request.

Category links open unfiltered category page 1. Featured cards link to product
details with the default browse return context. Search, category/price/stock
filters, non-default sorting/pagination, details and invalid links hide the
Home-only sections. Resetting to default browse restores them. Each section has
independent loading, retry and empty states; a failed featured request does not
hide normal browse results. The shared `/` starter remains untouched.

## Persistent navigation and footer

Top-level category links and All products remain available on browse, detail
and invalid-link pages. Links start a fresh browse at page 1; the exact selected
root category is marked as current. Navigation reuses the category request and
provides loading/retry states without hiding All products.

The footer explains the SRS Texas delivery restriction, planned Store Pickup,
destination/stock-dependent estimates, and planned Cash on Delivery/Card Payment
methods in USD. It explicitly states that this catalogue cannot accept orders
or payments yet. No delivery fees or fixed delivery dates are invented.

The default contact is `support@brightbuy.example`, labelled as a non-working
demo address with no mail link. Once the team owns a real mailbox, set the public
`VITE_BRIGHTBUY_CONTACT_EMAIL` before starting/building Vite. Valid plain email
addresses become mail links; invalid or blank configuration shows contact details
pending. Addresses ending in `.example` remain labelled demo addresses.
This configuration does not create a mailbox. Account links, cart count and
working cart handoff still require the owners' integration contracts.

## Product details

Product-name links open details using `?productId=1` alongside the browse query
parameters. Direct links, refresh, browser history and opening in a new tab
work with normal links. Back to results preserves search, filters, sorting and
page. Category links from details start a fresh browse of that category.

The page shows name, SKU, description, image/fallback and categories. A variant
selector displays the available colour/memory combinations, including zero-stock
choices. Selecting an option immediately changes its USD price, stock status and
available quantity without a reload, and resets quantity to 1. A single default
variant is selected automatically without showing a selector. Browse cards retain
their matching-variant price ranges; all prices show USD with two decimal places
as required by SRS AS-12.

Quantity must be a positive whole number no greater than the selected stock;
invalid input displays an inline error. Quantity is disabled for zero stock.
The Add to Cart button remains disabled **for all variants** with an explicit
integration-pending message: there is no cart implementation/contract yet. No
local/session cart, backend mutation or stock reservation is performed. UI-3's
working Add to Cart requirement remains unfinished pending checkout integration.

Low-stock threshold is SRS TBD-5. Set `VITE_CATALOGUE_LOW_STOCK_THRESHOLD` to
the agreed positive integer before starting/building Vite. A positive stock value
at or below that threshold displays Low Stock; zero displays Out of Stock.
Unset/invalid values use only In Stock/Out of Stock without guessing a threshold.
This is public display configuration, not a security or checkout stock check.

Loading is announced; invalid IDs are rejected before a detail request.
Missing/inactive products show an unavailable state with a return link.
Network/server/invalid-response failures offer a retry. Out-of-stock products
remain readable. Requests are cancelled when leaving or changing products.

## Checks (from Frontend)

### Keyboard navigation and page context

After a changed search, filter, sort or page (including browser Back/Forward),
focus moves to the results heading. Initial load and API completion do not move
focus. The heading and main content accept programmatic/skip-link focus without
adding extra stops to the normal Tab order. Existing visible focus outlines remain.

Browse tab titles identify Home or the search/category and page. Result status
announcements include the count and page, with singular/empty wording. Invalid
search and price fields expose `aria-invalid` alongside their existing error text.
Product-detail titles retain their existing behaviour.

Both **Reset all filters** and the empty-results **Clear search & filters**
discard unsubmitted search/price/stock drafts and validation errors, even if the
URL already contains the default filters. They return keyboard focus to results.
Search errors belong to the current route and do not persist after category,
sort, page or browser-history navigation. Applied query values are restored from
the URL; the existing validation limits remain unchanged.

### Automated checks

```sh
node --test tests/catalogue*.test.mjs
npm run lint
npm run build
npx vite build --config vite.catalogue.config.ts
```

Use a Node release supporting native TypeScript stripping (validated with
Node 26). The rendering tests use the existing Vite/React dependencies, without
opening a browser or connecting to the backend. API tests mock HTTP responses.
The default build retains the shared starter; the separate catalogue build
outputs to `dist/catalogue`. Run the shared build before the catalogue build,
because the shared build clears `dist`.

Manual checks: open a product from filtered results, return and check the
filters/page, refresh a detail link, browse a category from details, check
an inactive/missing ID, retry after a connection failure, and check a narrow
screen. The team's actual MySQL 8 deployment still requires integration testing.

## Variant-selection milestone verification

- 134 frontend tests passed; lint and both builds passed.
- Browser checks with temporary mock data verified USD price changes between
  variants, zero-stock disabling, Low Stock with an explicit test-only threshold
  of 5, and excessive-quantity feedback. This is not a live backend/MySQL test.
- Still pending after that milestone: working cart handoff, agreed low-stock
  threshold, shared navigation/account/cart integration and required footer details.

## Home milestone verification

- 144 frontend tests passed; lint and both builds passed.
- Mock-data browser checks verified top-level category navigation, featured card
  detail links and return navigation. Home-only content hides on category/detail
  routes and returns on Home.
- At the SRS minimum 360px viewport, category cards and featured content fit
  without horizontal page overflow. Browser checks used temporary fixtures,
  not the blocked shared backend or MySQL.
- No backend, database, shared app entry or teammate files changed.

## Keyboard-navigation milestone verification

- 159 frontend tests passed; lint and both builds passed.
- Mock-data browser checks verified search submission, Next, Back, corrected
  price filters and skip-link focus. Invalid price ranges expose `aria-invalid`.
  A completed API response left the user's current focus unchanged.
- These checks do not replace live backend/MySQL testing or a full screen-reader
  audit. Cart/account integration and the agreed low-stock threshold remain pending.
- Only catalogue frontend code, tests and this guide changed.

## Navigation/footer milestone verification

- 154 frontend tests passed; lint and both builds passed.
- A mock-data browser check verified category switching and the demo contact
  notice. At 360px, the footer stacks into one column with no horizontal overflow.
- Checks used temporary fixtures, not a live backend/MySQL connection.
- Still pending: a real team contact mailbox, shared account/cart navigation,
  working cart handoff and the agreed low-stock threshold.
- No backend, database, shared app entry or teammate files changed.

## Form-recovery milestone verification

- 161 frontend tests passed; lint and both builds passed.
- Browser checks with temporary mock data verified simultaneous search/price
  errors followed by same-URL reset, stock checkbox reset, the empty-results reset,
  search-error cleanup on category navigation, and applied price restoration on Back.
- The header now owns its search error state. Route/reset keys recreate the header
  and filter forms together, so stale drafts cannot survive an explicit reset.
- No database, backend, shared entry or teammate files changed. Live integration,
  cart/account contracts, the low-stock threshold and real contact details remain pending.
