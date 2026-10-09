# Project work log
# S.D.A.P. Senadheera
# Role : 

## 2026.09.16

## Completed
 -- Management reporting 
   - Created the required tables for the Management Reporting section.
   - Added sample/summary data insertion logic for the sales_summary table.
   - Added report_access_log insertion logic.
   - Created the following reporting queries:
        - Quarterly Sales Report
        - Top Selling Products Report
        - Category-wise Total Number of Orders
        - Delivery Time Estimates for Upcoming Orders
        - Customer-wise Order Summary with Payment Status


## NEXT
- Create API endpoints for each report.
- Implement query parameters to extract `startDate` and `endDate` filters from the request.
- Connect the Express routes to execute the completed MySQL queries.
- Format and send the database results back to the client as JSON arrays.

## Catalogue & Search — Kavindu Mihisara

Updated: 2026-10-09. Status reflects this local checkout, not unmerged teammate branches.

### Catalogue integration repairs — 2026-10-09

- Changed catalogue/card/detail/shared-cart currency display to LKR at the user's
  request. Numeric database prices are unchanged; no exchange-rate conversion.
  Checkout/reporting currency formatting remains with those owners.
- Adapted catalogue Add to Cart to Adeesha's current cart interface through
  `cartHandoff.ts`; kept his cart storage, cart page and checkout files unchanged.
  Restored success/error announcements and checks for combined quantities,
  invalid snapshots and storage failures. Adding items never creates orders.
- Fixed catalogue navigation lint, cart badge subscription and mobile header
  wrapping. Cart links now open the implemented cart view.
- Restored account status from the real session endpoint only; removed catalogue
  mock-login fallback and browser-only logout. Updated stale footer guidance.
- Added catalogue-only TypeScript configuration and updated regression checks
  and `Frontend/CATALOGUE_UI.md` to document the current shared cart contract.
- All 179 frontend tests, catalogue typecheck, scoped lint and separate production
  build passed. Browser checks used fictional local HTTP fixtures: three units
  added, excess refused, shared cart received them, unavailable variant disabled,
  and no overflow on a 360px product-detail screen. No Azure/database writes.
- Shared blockers remain with their owners: real frontend authentication,
  authenticated checkout/address/payment/delivery integration, default home-page
  build error, shared HTML build entries and full disposable-database verification.

### Install script and session cart — 2026-10-08

- Added `Database/install_all.sh` and `Database/INSTALL.md`: one command that
  installs all five modules in dependency order on a fresh database. It reads
  teammates' SQL unchanged and works around the duplicate `delivery` table, the
  invalid `--Run` comment lines and the conflicting checkout seed.
- Verified on an isolated MySQL 9.7.1 instance: full install, second run
  refused, catalogue suites passed, and a test checkout of two units created
  the order, reduced stock once and wrote one audit row. Not run on MySQL 8.0.
- Added the session cart (`Frontend/src/catalogue/cart.ts`), enabled Add to
  Cart and added the header cart count (SRS AS-11, UI-3, UI-1). Contract for
  the cart and checkout pages is in `Frontend/CATALOGUE_UI.md`.
- 179 frontend tests, catalogue lint, typecheck and build passed; checked in a
  browser against a local backend. No teammate file was edited.
- Still needed from others: cart page and checkout screens (Adeesha), login and
  registration screens (Atapattu). No order can be placed in the browser yet.

### Catalogue database completion — 2026-10-08

- Added seven maintenance procedures for warehouse staff (SRS 2.2.4, BR-14) in
  `Database/Catalogue/08_catalogue_maintenance_procedures.sql`: create/update
  category, create/update product, retire/restore product, assign/unassign
  category. Products are never deleted; a product keeps at least one category.
- Added `09_catalogue_roles.sql` with least-privilege reader and maintainer
  roles (SEC-7). It creates no accounts and stores no passwords.
- Added `10_catalogue_explain.sql` with recorded results (CON-6) and
  `DATA_DICTIONARY.md` for the three catalogue tables (DB-4), including the
  documented `ON DELETE RESTRICT` deviation from SRS 2.5.2.
- Verified on an isolated MySQL 9.7.1 instance only: 41 new maintenance
  assertions passed, both role types were checked with real restricted
  accounts, and the existing procedure and foundation suites still passed.
  Not yet rerun on MySQL 8.0.
- Not done: backend endpoints and a staff screen for these procedures, and
  audit-log rows for staff actions (SEC-11). Both need the inventory and auth
  owners. No teammate file was edited.

### Catalogue-only handoff — 2026-10-08

- Removed the temporary direct Buy Now request with hardcoded Azure URL/customer
  ID 1; restored disabled Add to Cart until the actual cart/auth contract is ready.
  Variant/quantity selection remains available; no purchases or stock writes occur.
- Fixed catalogue hooks/lint issues and added read-only account status against
  `/api/auth/me`, with cookie-enabled requests, response validation, signed-out
  handling, cancellation/timeout and retry. Auth base follows the configured
  catalogue deployment or optional `VITE_AUTH_API_URL`; no credentials are stored.
- Added six regression tests: total 167 passing. Catalogue lint and frontend
  build passed. Local browser verification used fictional fixtures, not Azure.
- Backend/database and teammates' inventory, delivery and reporting components
  were not edited. Login/account routes, cart, CSRF-protected checkout, team
  configuration choices and full-system verification remain shared work.

### Completed

- Created catalogue tables, indexes, constraints, and variant integration.
- Added sample data covering 40 products, 10 categories, and 48 variants.
- Implemented SQL procedures and backend APIs for product search, filtering, sorting, pagination, categories, and product details.
- Built Home with top-level categories and up to six newest in-stock featured products, plus catalogue browsing/search/filtering/sorting/pagination.
- Built Product Detail with variant selection, immediate USD price/stock updates, quantity validation, image fallback, and browse-return links.
- Added persistent category navigation and delivery/payment information. Contact is explicitly a non-working demo address.
- Added loading, retry, empty-result and unavailable-product states; safe API response handling; keyboard focus and result announcements.
- Fixed form-reset/stale-error behaviour and long-content layouts, checked at 360, 390, 768 and 1280px.
- Previous live verification (2026-10-04): 161 frontend tests, lint and both builds passed; browser checks used the real catalogue API and isolated MySQL 8.0.46, not mock responses. This is historical evidence, not a full-team verification of the current checkout.
- Passed all 77 backend tests with no skips, including six real HTTP/MySQL tests, and 126 catalogue SQL assertions. Added checks for restricted database UPDATE permission and live HTTP CORS/write denial.

### Remaining

- Agree on the cart contract with Adeesha, then wire Add to Cart and cart-count updates. The button is currently disabled; nothing is saved or reserved.
- Agree on account/cart routes and authentication integration with their owners; connect the shared website navigation.
- Obtain the agreed Low Stock threshold and a real contact mailbox before final deployment.
- Coordinate the reporting build repairs below with Senadheera and confirm the team's deployment MySQL version, database permissions and allowed frontend origins.
- Complete full-team cart/auth/checkout/stock verification and representative performance testing. The successful catalogue-only live checks do not establish that the combined purchase flow works.

### Integration Notes

- Backend routes: `/api/catalogue/products`, `/api/catalogue/products/{id}`, `/api/catalogue/categories`.
- The current root `/` entry mounts the catalogue; `/catalogue.html` also remains available. This is not yet a fully integrated multi-module website.
- Catalogue reads stock; inventory and checkout own stock updates.
- Owner questions, acceptance checks and the next implementation order are in [the catalogue handoff checklist](Frontend/CATALOGUE_UI.md#integration-handoff-checklist).
- Checkout now has `POST /api/checkout` with variant/quantity items; this is not an Add to Cart interface. Do not create orders when a user adds an item to a cart.
- The fresh `brightbuy-catalogue-final8` verification container was stopped and retained, with existing containers untouched. Test credentials were not committed. Details: [live verification record](Backend/CATALOGUE_API.md#live-catalogue-verification--2026-10-04).

### Shared backend build repairs — 2026-10-04

- With permission to edit overlapping reporting files, removed the duplicate reporting application entry and added the scheduling import to the root application.
- Renamed `reporting/SalesSummary.java` to `SalesSummaryJob.java`, fixed constructor injection, and aligned logs with its existing procedure call. Preserved the daily schedule and seven-day refresh window.
- Added the missing `ReportService`, delegating the five existing controller operations to `ReportRepository`, plus eight service/scheduler tests.
- Controller routes, repository queries, DTOs, SQL, checkout and authentication behaviour were not changed. Senadheera should coordinate any local versions of the removed/renamed files and missing service before merging.
- Full Maven verification and packaging passed with a temporary in-memory H2 database: 71 passed, 4 live-MySQL tests skipped. No shared database was used; live reporting correctness remains unverified.
