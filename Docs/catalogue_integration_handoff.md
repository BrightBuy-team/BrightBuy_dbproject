# Catalogue and shared integration handoff — 2026-10-09

Hi team — I completed the remaining catalogue integration and the shared changes
needed for the real account/cart/COD flow. These changes are local and uncommitted;
nothing was deployed to Azure and no real payment was made.

## To Atapattu — auth/account

Implemented real customer registration and customer/employee login in
`Frontend/src/LoginPage.tsx`, replacing browser mock users/passwords.
`AccountStatus.tsx` now signs out through the backend, with CSRF and cookies.
Guest carts merge into the signed-in customer cart with quantity/capacity checks.
Cookie sessions, never client email/role/IDs, authorize protected requests.

Shared auth changes:
- `Backend/.../auth/AuthController.java`: employee provisioning rechecks the
  current active Admin role, including already-authenticated disabled admins.
- `auth/AddressController.java` (previous integration): customer account-type
  checks prevent employee/customer ID namespace confusion.
- `auth/AddressRepository.java`: unknown cities return 400; missing customer 404.
- `config/StrictJsonConfiguration.java`: fractional/string numeric IDs and
  quantities are rejected instead of silently coerced.
- `application.properties`: stack traces/messages are not exposed in error
  responses; cookie HTTP-only/Secure/SameSite settings are explicit.

Please review your parallel auth changes before merging. Configure production
cookie policy and CORS for the real frontend domain. Same-site local testing must
use the same hostname on both servers (localhost/localhost, not localhost/127.0.0.1).

## To Adeesha / Induru — checkout and Azure deployment

COD delivery and pickup now use the real session and a typed JSON API response.
Delivery requires an existing Texas city plus a street address. Checkout stores
an address snapshot, delivery estimate, pending COD payment, historical unit
prices and order items in the same transaction as the stock decrement.
Request-supplied customer IDs/totals are ignored; the server/database supplies them.

The purchase-time estimate is computed before decrementing stock, so buying the
last unit does not incorrectly add three days. Pickup has no invented date.
Duplicate/empty/fractional/invalid carts and unavailable stock are rejected.
The UI shows the confirmed order ID, clears the cart and links to own order
history. Duplicate clicks are guarded. Check history before retrying a timed-out
checkout; a persistent idempotency-key protocol would be a separate enhancement.

Shared files to coordinate:
- `checkout/repository/CheckoutRepository.java`: explicit callable parameters,
  V2 JSON result and customer audit actor reset on the same pooled connection.
- `Frontend/src/catalogue/CheckoutView.tsx`, `CartView.tsx`, `cart.ts`,
  `cartMerge.ts`, `OrderHistoryView.tsx` (the last originated in the previous commit).
- `Database/Checkout/02_checkout_procedures.sql` (previous commit): V2 plus
  legacy 5-argument wrapper. New backend uses V2; do not restore the old 3-argument call.
- `Database/Checkout/04_checkout_test.sql`: eight real failure/rollback assertions.
- `Database/Integration/01_schema_upgrade.sql`: prerequisite preflight, address
  column, constraints/indexes and unique payment/delivery order references.
- `Database/Integration/02_application_role.sql`: scoped writes, no schema/DBA
  privileges and no direct audit-table edits. Provision a real login privately.

Card checkout deliberately returns 503 before creating an order or deducting
stock: a real gateway authorization interface has not been supplied. Do not
turn this into fake card success. Connect and verify the gateway separately.
Rotate the previously committed/exposed Azure DB credential; removing it from
current files does not erase Git history. Configure the new secret privately.

## To Nirmal — inventory and delivery

`Frontend/src/inventory/InventoryApp.tsx` now checks real staff sessions,
uses the configured backend, sends cookies/CSRF, accepts only whole nonnegative
stock and displays LKR. Variant labels use the actual `variantName` response
rather than an absent `sku` field. Stock errors are visible and writes are guarded.

`Frontend/src/delivery/DeliveryApp.tsx` uses authenticated requests and the
current `est_delivery_date` response. Customers can query only their own orders;
destination mismatches are rejected. Pickup/date-null states are handled.
The purchase-time estimate is returned, not recomputed from today's stock.

`Backend/.../config/ActorJdbc.java` now uses native prepared CALL statements
without depending on routine-body metadata. Authenticated staff/customer actors
are reset on the same connection, avoiding cross-request audit contamination.
`Inventory_Delivery_DDL.sql` uses named nonnegative price/stock constraints.
The previous integration removed duplicate delivery ownership from inventory;
checkout is the one owner of that table.

Please retain these session/CSRF and audit contracts in your parallel changes.
Review the agreed low-stock threshold (UI currently uses 10) and production
warehouse/pickup instructions with the team.

## To Senadheera — reporting

Reporting uses authenticated Management identity, not a submitted employee ID.
Report currency display is LKR. Quarterly revenue and top products now read
authoritative non-cancelled order history, including today's purchases, instead
of mixing current order counts with a yesterday-only summary or requiring cron.
Historical order totals/unit prices are used. Category counts remain distinct
orders. Pickup appears in upcoming fulfilment results; cancelled orders are
excluded from customer spend/payment summaries.

Changed `Database/Management reporting/02_management_reporting_procedures.sql`
is reinstallable (drops/recreates routines only). `ReportController.java`
validates year, top-N bounds and date order. Summary tables/job remain available;
the live reports do not depend on a complete summary backfill. Please coordinate
any summary-optimization changes so today's and older history are not omitted.

## Catalogue-owned changes

Public keyword search retains FULLTEXT plus literal partial-name/description/SKU
semantics, but builds candidate IDs with UNION before variant aggregation.
This lets FULLTEXT use its index instead of evaluating MATCH in a per-variant OR.
All 67 procedure semantics assertions still pass.

Staff maintenance now supports keyword lookup and 100-row pages, including
retired products, rather than an inaccessible first-500-only list.
New products atomically receive a category and initial variant. Audit records
contain authenticated employee identifiers and old/new values. Product retirement
preserves references and historical orders.

The public home, working links, login styling, cart recovery, logout, delivery,
inventory and payment footer are consistent with the integrated functionality.
The user subsequently requested conversion of ALL existing amounts: this now
uses a one-time USD→LKR database migration at 330.9617 LKR/USD, not just a label.
See the currency migration instructions below before deploying against Azure.
Texas remains the supported delivery region. Contact is still an explicit demo.

## Verified locally

All tests used isolated containers, not Azure. MySQL Community 8.0.46 was pinned
to image digest `7dcddc01f13bab2f15cde676d44d01f61fc9f99fe7785e86196dfc07d358ae2b`.

- Full frontend: 188 tests passed, build passed, lint passed.
- Backend suite: 83 passed; 6 opt-in DB tests skipped in that run.
- Those 6 real HTTP/MySQL catalogue tests passed separately using a read-only account.
- SQL: 32 foundation + 67 read procedure + 41 maintenance + 8 checkout assertions.
- Fresh combined installation passed; rerunning the installer on a populated DB
  correctly refused with exit code 3, without deleting/reseeding anything.
- 73 HTTP/MySQL integration checks passed: real auth/session/logout, CSRF and
  role denial, disabled employees/admins, maintenance rollback/audit, COD totals,
  address snapshots, privacy, card fail-closed, pickup, all five reports and stock races.
- Twenty independent cookie sessions for one customer concurrently confirmed
  twenty pickup orders and deducted exactly twenty units: 83 ms total, 38 ms
  maximum measured request in this local smoke run. Not a sustained-load certification.
- Browser verification passed: register/login → detail → add/cart → COD
  confirmation → order history → logout. Fictional local order #115 was confirmed,
  with pending COD payment and persisted five-day delivery.

10,039 active products were used for performance smoke checks on a 2-CPU-limited
local MySQL container. Sequential p95 over ten requests: browse 55 ms, search
22 ms, detail 9 ms, category/price/stock filter 61 ms. A one-shot 200-search burst
completed all requests after optimization (no 503s), but p95 was 4,351 ms and max
4,535 ms: **this does not meet the 3-second search target under that burst**.
Tune/measure the actual Azure resources and sustained 200-browser workload before
performance sign-off. Do not present this as full SRS capacity compliance.

## Fresh local setup

Use Docker Desktop and a NEW local-only container. The installer refuses any
existing tables. Do not use a production account or reuse a populated container.

```sh
docker run --detach --name brightbuy-local \
  --label com.brightbuy.purpose=disposable-integration \
  --publish 127.0.0.1:33087:3306 \
  --env MYSQL_ROOT_PASSWORD=CHOOSE_A_LOCAL_TEST_PASSWORD \
  mysql@sha256:7dcddc01f13bab2f15cde676d44d01f61fc9f99fe7785e86196dfc07d358ae2b \
  --mysqlx=OFF --log-bin-trust-function-creators=1
```

Replace the local test password; never deploy these development settings.
Wait until the following succeeds, then install from the project root:

```sh
docker exec brightbuy-local sh -c 'MYSQL_PWD="$MYSQL_ROOT_PASSWORD" mysql -u root -e "SELECT VERSION();"'
bash Database/install_all.sh --docker brightbuy-local
docker exec -it brightbuy-local sh -c 'MYSQL_PWD="$MYSQL_ROOT_PASSWORD" exec mysql -u root brightbuy'
```

In that SQL prompt, create an application login with your own private local
password and the installed role (the installer creates roles, not login accounts):

```sql
CREATE USER 'brightbuy_local'@'%' IDENTIFIED BY 'CHOOSE_A_DIFFERENT_LOCAL_APP_PASSWORD';
GRANT 'brightbuy_application' TO 'brightbuy_local'@'%';
SET DEFAULT ROLE 'brightbuy_application' TO 'brightbuy_local'@'%';
```

Set the backend's environment privately. `Backend/.env.example` is a template:
Spring does not automatically load it. Copy to ignored `.env.local`, replace the
placeholders and export/source those variables in the backend terminal.

```sh
cd Backend
set -a
source .env.local
set +a
./mvnw spring-boot:run
```

In a separate terminal, copy `Frontend/.env.example` to ignored `.env.local`
and use `VITE_CATALOGUE_API_URL=http://localhost:8080/api/catalogue`, then:

```sh
cd Frontend
npm run dev -- --port 5173 --strictPort
```

Open `http://localhost:5173/catalogue.html`. Register a customer normally.
Auth employee seed passwords are placeholders, not working logins; provision
real staff via a privately bootstrapped admin, never a public default admin.

Regression commands (do not run fixture-count suites after the HTTP/load tests
have added rows):
```sh
cd Frontend
node --test tests/*.test.mjs
npm run build
npm run lint
# In Backend:
./mvnw -Dspring.profiles.active=test test
# From project root, with the labelled local test API running:
BRIGHTBUY_TEST_CONTAINER=brightbuy-local BRIGHTBUY_TEST_API=http://localhost:8080 node Backend/scripts/test-integration.mjs
```

`Backend/scripts/test-integration.mjs` is destructive only to fictional fixtures
in a labelled disposable instance; it creates test accounts/orders and retains
them for inspection. Never point it at Azure, a real app connected to Azure, or
a container labelled as a test while connected to shared data.

## Existing shared DB / Azure upgrade (owner-run, not executed here)

### Currency conversion follow-up

The user confirmed that every pre-existing monetary amount should be treated as
USD and converted to LKR. The CBSL indicative chart displayed 330.9617 when
retrieved on 2026-10-09:
https://www.cbsl.gov.lk/cbsl_custom/charts/usd/indexsmall.php
This is a frozen migration rate, not a guaranteed live/bank settlement rate.
USD 1,099 becomes LKR 363,726.91; USD 449 becomes LKR 148,601.80.

`Database/Integration/03_convert_currency_to_lkr.sql` converts variant prices,
historic order-unit prices, order totals, payment amounts and sales summaries.
It records original/converted values and source/rate metadata. Full payments
follow the converted order total; order totals sum rounded per-unit prices.
Rerunning the script is a no-op once `USD_TO_LKR_V1` is recorded. NEVER delete
the migration marker or independently multiply the amounts again.

Pause writes, back up the shared database, and confirm the USD assumption with
the team before its owner applies this script. Missing approval, non-strict mode,
overflow or inconsistent original order totals fail without monetary changes.
DDL helper tables can persist independently; they are not evidence of success.
The fresh installer applies conversion automatically after USD fixtures/summaries.
Existing deployments must apply the migration BEFORE exposing the new LKR UI.
For an owner-approved SQL connection, explicitly set
`SET @brightbuy_convert_all_usd=1;` in the same connection before sourcing the file.

Local conversion was applied only to the disposable preview database. Azure was
not modified. Fifteen migration assertions and all six real read-only catalogue
API tests passed against converted LKR fixtures; the 148 SQL baseline assertions
also passed. Active browser carts use a new LKR namespace; old USD carts remain
archived, and customers should re-add products to refresh prices.

### Shared upgrade order

1. Back up the DB and record the running schema/routine versions. Pause writes.
2. Review NULL/negative price/stock and duplicate/null payment/delivery order
   references; resolve invalid existing data with its owner. The upgrade refuses
   invalid data rather than repairing it. DDL can commit independently.
3. Apply `Database/Integration/01_schema_upgrade.sql`.
4. Reinstall `Catalogue/06_catalogue_procedures.sql`,
   `Inventory/Inventory_Delivery_logic.sql`,
   `Checkout/02_checkout_procedures.sql`,
   `Management reporting/02_management_reporting_procedures.sql`,
   and `Catalogue/11_catalogue_audit.sql`, using brightbuy explicitly where needed.
   Keep existing catalogue maintenance/auth routines installed.
5. Reapply `Catalogue/09_catalogue_roles.sql` and
   `Integration/02_application_role.sql`. The latter rebuilds its named
   application role; record existing grants first. Provision/rotate the actual
   application login privately and set its default role.
6. Do NOT run fresh CREATE TABLE, seed, fixture, performance or test scripts.
7. Apply the currency migration above while writes are still paused, then deploy
   matching backend/frontend together. Configure private
   `BRIGHTBUY_DB_URL` with verified MySQL TLS, username/password, CORS origins,
   Secure cookies, and SameSite policy. Cross-site cookies require HTTPS,
   SameSite=None and browser support; a same-site gateway avoids many issues.
8. Verify customer/staff/management sessions, COD, audits, delivery, reporting
   and load behavior against deployment. Resume writes only after acceptance.
   Restore backup if upgrade verification fails; do not assume DDL rolled back.

## Still requires team / external release decisions

- Rotate exposed credentials and deploy reviewed upgrades to Azure.
- Connect a real card gateway and verify authorize-before-stock-confirmation.
- Validate production cookies/CORS/TLS, backups, delivery/pickup operations and
  the real contact mailbox/stock threshold.
- Complete sustained production-like performance tuning and acceptance; the
  200-request burst limitation is explicitly recorded above.
- Review this cross-module PR with the named owners; reconcile their unmerged
  parallel changes. No teammate has been messaged automatically.
