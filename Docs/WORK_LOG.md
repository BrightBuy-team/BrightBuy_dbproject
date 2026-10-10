# Work log

Who built what, taken from the repository history. Dates are commit dates in 2026.

## By member

### Mihisara LHK — product catalogue and search

- 15 Sep: set up the Spring Boot backend and the React and TypeScript frontend.
- 19 Sep: catalogue tables, indexes and hierarchy triggers; sample data of 40 products in
  10 categories with 48 variants; search and product-detail procedures; catalogue API;
  storefront with search, filters, sorting and paging.
- 24 Sep – 4 Oct: product detail page with variant selection; home page categories and
  featured products; keyboard and screen-reader support; responsive layout; link between
  catalogue and inventory (`variant.product_id`).
- 8 Oct: maintenance procedures for products and categories, database roles, index
  evidence, data dictionary; combined installer; session cart and Add to Cart.
- 9 – 10 Oct: staff catalogue pages, session and CSRF handling across modules, audit of
  maintenance actions, one-command project verification and its CI workflow, production
  safety checks.

### Adeesha W.G.I. — cart, checkout and orders; deployment

- 19 – 26 Sep: `orders`, `order_item`, `delivery` and `payment` tables; the transactional
  `ProcessCheckout` procedure with row locking and JSON cart parsing; checkout tests.
- 4 – 6 Oct: checkout API; checkout page; fix for stock being deducted twice.
- 5 Oct: Dockerfile, backend CI pipeline and deployment to Azure.
- 8 – 9 Oct: order history, address and inventory APIs; cart page with a cart per customer;
  backend connection to the shared Azure database.

### Nirmal U.K.N — inventory and delivery

- 5 – 27 Sep: `city`, `warehouse`, `variant` and `variant_audit` tables; stock audit
  trigger; delivery date function; sample cities and warehouses.
- 30 Sep: inventory and delivery backend; warehouse inventory page.
- 8 Oct: delivery estimate page, home page and sign-in page.

### Atapattu D.M. — users and authentication

- 28 Sep: `customer`, `employee` and `login_attempts` tables; registration, sign-in,
  sign-in logging, rate-limit and role-check procedures; sample accounts.
- 5 – 8 Oct: authentication repository and service in the backend.

### Senadheera S.D.A.P — management reporting

- 5 – 6 Sep: repository folders; the queries for the five management reports.
- 16 – 24 Sep: `sales_summary` and `report_access_log` tables; report procedures.
- 25 Sep – 5 Oct: report records, repository and controller in the backend; nightly
  sales-summary job; reports page.

## Final integration — 10 Oct

One pass over the whole project to finish the remaining requirements and tidy the repository.

**Finished**

- Card payment (BR-12): simulated gateway, authorisation before confirmation, token and
  last four digits stored, never the card number. `ProcessCheckout` gained the payment
  parameters and replaces the earlier `ProcessCheckoutV2`.
- Password recovery (UI-7): one-time emailed code, stored as a hash.
- Emails (SRS 3.3.3): registration, order confirmation and password reset are queued in
  `email_outbox` and handed to a simulated email service.
- Checkout page: delivery estimate before ordering, card entry, server-confirmed order
  confirmation. Order history shows lines, delivery and payment.
- Warehouse page: new variants, variant details and price, stock entry in the page.
- Reports: CSV export (UI-12).
- Administrator page for creating employees, and a first administrator created from
  private settings, because the sample accounts cannot sign in.
- One audit log for catalogue, variant and employee changes (SEC-11).
- Tighter database role for the backend (SEC-7), verified by tests.
- Backup and restore procedure (SAF-4, SAF-5), tested on every verification run.

**Restructured**

- Inventory, delivery, checkout and reporting moved from JPA to plain JDBC and stored
  procedures; JPA and Flyway were removed. Six security configuration classes became one.
- `Database/` now has one folder per module with numbered scripts, a `Shared/` folder, a
  `Tests/` folder, and one installer that can also upgrade an existing database.
  `User and Auth/` became `Auth/` and `Management reporting/` became `Reporting/`.
- Removed: a committed npm download cache, unused frontend components and packages, the
  abandoned currency-conversion script, and separate build configurations that the main
  ones had replaced.
- Twenty-one scattered documents were replaced by seven: README, database guide, data
  dictionary, API reference, operations guide, user guide and this log.

**Verified** with `scripts/verify-project.sh`: 199 frontend tests, 145 backend unit tests,
264 SQL assertions in seven suites, 6 catalogue tests on MySQL, 118 HTTP checks through
the running application, installer refusal and upgrade, backup and restore, and
least-privilege checks. An upgrade from the previous release was tested separately.

## Alignment with the project brief — 10 Oct

A check against the lecturer's brief found two differences, both now closed.

- **Out of stock at the time of order.** The brief adds 3 days to the delivery estimate for
  such an order, so it must be possible to place one. Checkout used to refuse it. Now
  `ProcessCheckout` takes the units in stock, records the rest in the new column
  `order_item.backordered_quantity`, and applies the 3-day delay. Stock never goes below
  zero. The shop pages let a customer order an out-of-stock item and say what is back-ordered;
  the delivery preview takes quantities into account. This replaces SRS rules BR-7 and SAF-3.
- **One central warehouse.** The sample data used three warehouses. It now has one, new
  variants go to it automatically, and the upgrade script consolidates an existing database.
- **Assumptions** are listed in one table in `Database/README.md`.

Verified with `scripts/verify-project.sh`: 200 frontend tests, 145 backend unit tests, 276
SQL assertions, 127 HTTP checks, and an upgrade from the previous release.

## Open items

| Item | Why it is open |
|---|---|
| Real payment provider and email provider | Not chosen for this phase (TBD-3, TBD-4); both are simulated |
| Delivery charge | The amount is not decided (TBD-2); orders are charged for their items only |
| Sales tax | Out of scope for this phase (TBD-9) |
| Order status changes after purchase (shipped, delivered, cancelled) | No screen or procedure yet; orders stay *Confirmed* |
| Page design | Functional but plain; styling was left for later |
