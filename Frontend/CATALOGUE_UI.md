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
- Still pending: working cart handoff, agreed low-stock threshold, featured Home
  content, shared navigation/account/cart integration and required footer details.
