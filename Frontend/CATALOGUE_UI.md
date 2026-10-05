# Catalogue frontend

Start the backend using [its catalogue profile instructions](../Backend/CATALOGUE_API.md),
then run from `Frontend`:

```sh
npm run dev -- --port 5173 --strictPort
```

Open `http://localhost:5173/catalogue.html` through the development server,
not by opening the HTML file with a `file://` URL. The current root `/` entry
also mounts `CatalogueApp`; the unused `App.tsx` starter is not the active entry.
If needed, set `VITE_CATALOGUE_API_URL` to the full catalogue API
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
hide normal browse results. Other modules still need an agreed shared navigation.

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
The default build uses the current root catalogue entry; the separate catalogue build
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

## Long-content responsive milestone verification

- Long unbroken category/search text previously stretched the 360px browse page
  to 1,637px. Catalogue grid/flex children can now shrink, text wraps, and pagination
  can wrap onto another line. No content is hidden to suppress page overflow.
- With temporary mock data, browse and detail pages fit 360, 390, 768 and 1280px
  viewports. Checked heading, result-summary, price and detail-category text for
  clipping as well as overall page width. This is not live database validation.
- Repeat with an 88-character unbroken category name, a 224-character product
  name, a 255-character search term, a long unbroken description, and a price
  range of USD 99,999,998.99–99,999,999.99. Check category buttons, breadcrumbs,
  result headings, cards and detail links at each width. Use disposable fixtures,
  not edits to shared seed data. Confirm keyboard focus remains visible.
- 161 frontend tests, lint and both builds passed. Only catalogue CSS and this
  guide changed; cart/account integration is still pending.

## Integration handoff checklist

Checked against the local source tree on 2026-10-04. No cart/auth application
interface is present here yet; this does not describe unmerged teammate work.
The items below are questions and acceptance criteria, not invented endpoints
or an agreed API contract. No messages have been sent to teammates.

### Needed from Adeesha — cart and checkout

- [ ] Provide the cart UI route and the add/read-cart interface: HTTP method/path
  or frontend function, exact field names, response shape, and an example.
- [ ] Confirm whether adding a selected variant uses its existing `variant_id`
  and a quantity increment or an absolute total. Catalogue already has the
  selected variant ID and a validated positive whole-number quantity.
- [ ] Confirm guest-cart/session behaviour, persistence across refresh, login
  merging, and any cookies/CSRF requirements with the authentication owner.
- [ ] Define cart badge meaning (total units or distinct lines), success feedback,
  and how unavailable stock, invalid variants, timeouts and repeated submissions
  are reported. Agree on error codes before implementing frontend handling.
- [ ] Confirm that the server validates current price/stock and owns stock writes.
  Displayed prices/stock are snapshots, not trusted checkout inputs or reservations.

Once agreed, catalogue work is to connect the selected variant/quantity, show
pending/success/failure feedback, prevent duplicate in-flight submissions, and
refresh the cart count. Keep Add to Cart disabled until the real handoff works;
do not introduce a second local cart or catalogue stock-decrement logic.

### Needed from Atapattu — account and security

- [ ] Supply login/register/account routes and the session-status interface.
- [ ] Agree with checkout on guest-cart ownership, login transitions and CSRF.
- [ ] Integrate the existing catalogue security chain (order 10) and authenticated
  fallback. Public catalogue reads must remain public; unrelated routes must
  remain protected. Catalogue GET requests currently omit credentials, and its
  CORS allowlist does not permit credentialed requests. Do not reuse that policy
  as the cart authentication policy without an explicit design.

### Needed from Nirmal and the team

- [ ] Agree on the positive integer Low Stock threshold (SRS TBD-5); configure
  `VITE_CATALOGUE_LOW_STOCK_THRESHOLD`. Until then only In Stock/Out of Stock
  are shown. This display setting is not stock validation.
- [ ] Confirm stock ownership and warehouse assumptions with inventory/checkout
  before the combined test. Catalogue must remain read-only.
- [ ] Provide an owned contact mailbox for `VITE_BRIGHTBUY_CONTACT_EMAIL`.
  `support@brightbuy.example` is a labelled demo address, not a working service.
- [ ] Agree on shared account/cart navigation. Both `/` and `/catalogue.html`
  currently open catalogue; no additional routes are being fabricated here.

### Live verification gate and implementation order

1. Shared compilation blockers were repaired on 2026-10-04 with permission to
   edit the overlapping reporting files: one root application entry remains,
   scheduling has its import, `SalesSummaryJob.java` has the matching filename
   and constructor assignment, and the missing `ReportService` delegates all five
   existing report calls. Confirm these changes with the reporting owner before
   merging overlapping work. Full Maven verification/package passed using a
   temporary in-memory H2 database: 71 tests passed, 4 live-MySQL tests skipped.
   This does not validate report SQL, database row mapping or live checkout.
2. Prepare a separate disposable MySQL 8 instance using the documented owner
   prerequisites and [catalogue setup order](../Database/Catalogue/README.md).
   Never point fixture-dependent tests at the shared database. Use the
   [backend instructions](../Backend/CATALOGUE_API.md#tests) to enable real DB
   tests; keep credentials outside Git and record the exact MySQL version.
3. Verify real categories, search, combined filters, pagination, product detail,
   variant price/stock, empty results and error recovery in the browser.
4. After the owners supply the contracts above, implement cart/account handoff
   in one reviewable milestone. Test guest and signed-in behaviour, repeated adds,
   stock changed since page load, failed requests and refresh persistence with
   the cart owner. Do not claim purchase completion from an Add to Cart response.
5. Run browse → detail → variant/quantity → cart → checkout on that disposable
   system with the team. Verify order/stock results and failed-checkout behaviour
   with the owners, and record actual results in the work log.

The catalogue-only parts of steps 2–3 have now been verified against real MySQL
8.0.46; the full-team setup and steps 4–5 remain pending. Checkout code now includes
`POST /api/checkout` and `CartItemDto(variantId, quantity)`, but that endpoint
performs checkout: it is not an add/read-cart interface and must not be called
by the catalogue's Add to Cart button.

## Live catalogue verification — 2026-10-04

- 161 frontend tests, lint and both builds passed.
- The real frontend → catalogue API → MySQL 8.0.46 flow was checked using a fresh
  disposable catalogue-only database: 39 visible products, six featured products,
  page 2 of 4, combined keyword/category/price/stock filters and price sorting.
- The combined Nova Phone filter returned one matching variant at USD 449.00.
  Detail variant selection changed the price from USD 399.00 to USD 449.00;
  quantity 25 correctly failed against stock 24, and Back to results preserved filters.
- Empty search, inactive product 40, and zero-stock product 38 displayed the
  expected states. Zero-stock quantity input stayed disabled. The detail page
  fit at 360px without horizontal overflow. Add to Cart remains explicitly disabled.
- Backend verification passed all 77 tests (including six live database tests)
  with no skips; the SQL regression passed 126 assertions. See
  [the backend record](../Backend/CATALOGUE_API.md#live-catalogue-verification--2026-10-04)
  for environment and reproduction prerequisites.
- Still pending: real cart/account handoff, the Low Stock threshold, real contact
  mailbox, deployment configuration, representative performance testing and full
  purchase-flow verification with the owners. No cart/order/payment was created.
