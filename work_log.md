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

Updated: 2026-10-04. Status reflects this local checkout, not unmerged teammate branches.

### Completed

- Created catalogue tables, indexes, constraints, and variant integration.
- Added sample data covering 40 products, 10 categories, and 48 variants.
- Implemented SQL procedures and backend APIs for product search, filtering, sorting, pagination, categories, and product details.
- Built Home with top-level categories and up to six newest in-stock featured products, plus catalogue browsing/search/filtering/sorting/pagination.
- Built Product Detail with variant selection, immediate USD price/stock updates, quantity validation, image fallback, and browse-return links.
- Added persistent category navigation and delivery/payment information. Contact is explicitly a non-working demo address.
- Added loading, retry, empty-result and unavailable-product states; safe API response handling; keyboard focus and result announcements.
- Fixed form-reset/stale-error behaviour and long-content layouts, checked at 360, 390, 768 and 1280px.
- Latest frontend milestone verification: 161 tests, lint and both builds passed. Browser checks used mock data, not the full live team system.

### Remaining

- Agree on the cart contract with Adeesha, then wire Add to Cart and cart-count updates. The button is currently disabled; nothing is saved or reserved.
- Agree on account/cart routes and authentication integration with their owners; connect the shared website navigation.
- Obtain the agreed Low Stock threshold and a real contact mailbox before final deployment.
- Coordinate the reporting build repairs below with Senadheera, then run live frontend/API checks on the team's MySQL 8 setup and full checkout/stock integration checks.
- Record final end-to-end results. Earlier isolated database/backend checks do not establish that the latest combined application works.

### Integration Notes

- Backend routes: `/api/catalogue/products`, `/api/catalogue/products/{id}`, `/api/catalogue/categories`.
- The current root `/` entry mounts the catalogue; `/catalogue.html` also remains available. This is not yet a fully integrated multi-module website.
- Catalogue reads stock; inventory and checkout own stock updates.
- Owner questions, acceptance checks and the next implementation order are in [the catalogue handoff checklist](Frontend/CATALOGUE_UI.md#integration-handoff-checklist).

### Shared backend build repairs — 2026-10-04

- With permission to edit overlapping reporting files, removed the duplicate reporting application entry and added the scheduling import to the root application.
- Renamed `reporting/SalesSummary.java` to `SalesSummaryJob.java`, fixed constructor injection, and aligned logs with its existing procedure call. Preserved the daily schedule and seven-day refresh window.
- Added the missing `ReportService`, delegating the five existing controller operations to `ReportRepository`, plus eight service/scheduler tests.
- Controller routes, repository queries, DTOs, SQL, checkout and authentication behaviour were not changed. Senadheera should coordinate any local versions of the removed/renamed files and missing service before merging.
- Full Maven verification and packaging passed with a temporary in-memory H2 database: 71 passed, 4 live-MySQL tests skipped. No shared database was used; live reporting correctness remains unverified.
