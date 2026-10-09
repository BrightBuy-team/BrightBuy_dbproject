# BrightBuy Catalogue Database Module

## Owner

Kavindu Mihisara

## Purpose

This module implements the product catalogue using raw SQL. It requires MySQL
8.0.19 or later.

## Tables Owned

- `product`
- `category`
- `product_category`

The inventory module currently defines the shared `variant` table. This module
reconciles its product foreign key and requires `variant.product_id` to be non-null.
Catalogue reads variants; inventory manages stock. Keep one shared definition.

## Naming Contract

The reporting module requires these exact names:

- `product.product_id`
- `product.name`
- `category.category_id`
- `category.name`
- `product_category.product_id`
- `product_category.category_id`

## Current combined installation — 2026-10-09

Run from the project root, on a fresh disposable MySQL 8 instance:

```sh
bash Database/install_all.sh --docker YOUR_DISPOSABLE_CONTAINER
```

The installer applies all five modules in dependency order and refuses an existing
populated database. It stops at the first SQL error; never use `--force`.
Inventory owns city/warehouse/variant; checkout owns the single delivery table.
The installer keeps all monetary fixtures in USD, matching Azure and the SRS.
`Integration/03_convert_currency_to_lkr.sql` is a historical opt-in script only;
do not run it during normal setup or Azure deployment.
Auth runs after city and before checkout. Catalogue audit/initial-variant routines
(`11_catalogue_audit.sql`) run before catalogue role grants (`09`).

The full setup and the non-destructive existing-database upgrade order are in
[the integration handoff](../../Docs/catalogue_integration_handoff.md).
Do not run fresh table/seed installers against Azure or any shared existing DB.
The older split-DDL dependency cycle has been resolved; prior milestone notes
below are historical evidence, not the current installation recipe.

For an existing schema, owners must review invalid NULL/negative variant values,
duplicate delivery/payment rows, and backup data before running
`Database/Integration/01_schema_upgrade.sql`. It never repairs or deletes rows.
DDL is not transactionally reversible; pause application writes and restore a
backup if needed. Routine/role reinstall instructions are in the handoff.

## Milestone 2 dataset and upgrade

The dataset contains **40 products, 10 categories, 80 category assignments and
48 variants**. Each product belongs to one child category and its root category.
All seven child categories contain products. The three original products and
five inventory variants keep their IDs and values. Products 4–40 are fictional
BrightBuy sample products; prices are demonstration values, not market quotes.

`05b_catalogue_variant_seed.sql` adds 43 variants for the 37 new products after
the inventory module has created its tables and warehouse data. It does not
create another variant table or modify inventory-owned files. Its reserved
variant IDs are **1004–1040, 1104, 1114, 1119, 1125, 1131 and 1136**; coordinate
that range with the inventory owner before merging shared sample data. It
reuses warehouses 1–3. Conflicting IDs or missing product/warehouse dependencies
raise an error and roll back all inserts. Existing matching variants retain
their price and stock on reruns; changing fixture values in the file will not
overwrite inventory updates.

For an existing milestone-1 development database, run only:

```sh
mysql -u root -p brightbuy < 03_catalogue_seed_data.sql &&
mysql -u root -p brightbuy < 05b_catalogue_variant_seed.sql &&
mysql -u root -p brightbuy < tests/test_foundation.sql
```

This assumes the milestone-1 schema and integration already succeeded. Do not
rerun catalogue or inventory table creation against that existing database.

Seven products offer multiple variant choices. Three variants have zero stock,
and product 40 is inactive, providing sample cases for the later frontend.
Product image URLs remain NULL until the frontend/image milestone. Fixtures
restore catalogue descriptions and activation flags on rerun, so use these
seed scripts for development/demo data only, with application writes paused.

## Milestone 3 procedures and queries

`06_catalogue_procedures.sql` installs three read-only procedures:

- `sp_catalogue_categories`: visible categories and distinct active product counts.
- `sp_catalogue_search`: keyword/category/price/stock filters, five sort modes,
  one product per result, and page metadata with deterministic ordering.
- `sp_catalogue_product_detail`: active product information, visible categories,
  and ordered variants including out-of-stock choices.

Each procedure returns a JSON value through an OUT parameter. This gives the
future Spring Boot catalogue API one documented response to consume and allows
SQL-only tests to inspect the actual results. Their common
`catalogue_public_variants` view excludes inactive products and invalid inventory
price/stock rows. No routine writes rows, starts/commits transactions, or handles
checkout. See [PROCEDURES.md](PROCEDURES.md) for signatures, defaults, response
fields, error states and category/price/search semantics.

To upgrade an existing milestone-2 development database, install `06` and run
the two test suites. Do not recreate tables or rerun inventory seeds:

```sh
mysql -u root -p brightbuy < 06_catalogue_procedures.sql &&
mysql -u root -p brightbuy < tests/test_procedures.sql &&
mysql -u root -p brightbuy < tests/test_foundation.sql
```

`04_catalogue_queries.sql` retains the seven illustrative SQL queries, improves
their visibility checks and sorting, and adds four runnable procedure examples.

## Milestone 5 maintenance, roles and evidence

`08_catalogue_maintenance_procedures.sql` installs seven write procedures for
warehouse staff (SRS 2.2.4, BR-14): create and update a category, create and
update a product, retire or restore a product, and assign or unassign a
category. They write only `category`, `product` and `product_category`;
variants, prices and stock stay with inventory. No routine deletes a product
(BR-18), and a product's last category cannot be removed (BR-2). Signatures and
errors are in [PROCEDURES.md](PROCEDURES.md#maintenance-procedures).

`09_catalogue_roles.sql` creates two roles (SEC-7):
`brightbuy_catalogue_reader` for the storefront API, limited to SELECT on the
four tables the read procedures use plus EXECUTE on those three procedures, and
`brightbuy_catalogue_maintainer`, which adds row writes and EXECUTE on the
seven maintenance procedures. Neither role can delete products or categories,
change variant stock or price, or read customer, order or payment tables. The
script creates no accounts and stores no passwords.

`10_catalogue_explain.sql` holds the EXPLAIN statements for the main catalogue
read paths; recorded output is in [tests/EXPLAIN_RESULTS.md](tests/EXPLAIN_RESULTS.md).
The column-level reference is [DATA_DICTIONARY.md](DATA_DICTIONARY.md).

To add these to an existing milestone-3 development database:

```sh
mysql -u root -p brightbuy < 08_catalogue_maintenance_procedures.sql &&
mysql -u root -p brightbuy < tests/test_maintenance.sql &&
mysql -u root -p < 09_catalogue_roles.sql
```

Validated on 2026-10-08 on an isolated MySQL **9.7.1** instance: 41 maintenance
assertions passed, reinstalling `08` and `09` succeeded, and the existing
procedure and foundation suites still passed afterwards. Not yet run on
MySQL 8.0. No backend endpoint or screen calls the maintenance procedures yet,
and they write no audit-log rows (SEC-11); both need agreement with the
inventory and auth owners.

## Business Rules

- SKU is unique at product level.
- Price and stock belong to variants.
- Products may belong to multiple categories.
- Categories support a two-level hierarchy.
- Products referenced by variants cannot be physically deleted.
- Inactive products are hidden using `is_active`.
- Every final product must have at least one category and variant.

## Current verification — 2026-10-09

The full fresh installer succeeded on MySQL 8.0.46, including case-sensitive table names.
32 foundation, 67 read-procedure, 41 maintenance and 8 checkout assertions passed.
Catalogue maintenance now has a staff API/UI and audit triggers; new products receive
an initial category and variant in one transaction. Staff uses authenticated employee
actors, and checkout stock audits use the authenticated customer actor.

## Historical progress checklist

- [x] Database initialization
- [x] Catalogue tables
- [x] Catalogue indexes
- [x] Forty products
- [x] Ten categories seeded
- [x] Correct mappings for the three initial products
- [x] Mappings for the full forty-product catalogue
- [x] At least one variant per product; 43 additional catalogue fixtures
- [x] Variant foreign key and non-null product reference
- [x] Catalogue read queries
- [x] Catalogue read procedures (categories, search and product detail)
- [x] Catalogue SQL tests
- [x] Catalogue-only MySQL 8.0.46 Docker validation (97 assertions and reruns)
- [x] Automated variant-seed preservation, collision and recovery checks (8 assertions)
- [x] Pre-integration rejection and recovery tests (14 assertions on separate MySQL 8.0.46 instance)
- [x] Catalogue maintenance procedures for BR-14 (41 assertions, MySQL 9.7.1)
- [x] Least-privilege reader and maintainer roles (SEC-7), checked with real accounts
- [x] Index evidence with EXPLAIN (CON-6) and catalogue data dictionary (DB-4)
- [ ] Maintenance procedures, roles and EXPLAIN rerun on MySQL 8.0
- [ ] Backend endpoints and staff screen that call the maintenance procedures
- [ ] Fresh full-project installation after resolving shared seed dependencies
- [ ] Verification on the team's exact MySQL version
- [x] Catalogue frontend → HTTP API → MySQL 8.0.46 verification (2026-10-04)
- [ ] Full-team cart/auth/checkout integration verification

The current catalogue-only live run passed 126 SQL assertions and all 77 backend
tests with no skips, followed by browser checks against the real API. See
[the live verification record](../../Backend/CATALOGUE_API.md#live-catalogue-verification--2026-10-04)
for environment, permissions and scope. This does not clear the full-project or
team deployment-version items above.

## Database validation

`tests/test_foundation.sql` runs entirely in MySQL; no Python is required.
Complete the setup sequence above on a **disposable test database** first.
The test script uses the existing `brightbuy` database and requires the complete
milestone-2 fixtures with their initial prices and stock. It does not create a database
or execute the setup files automatically. Never run it on a shared or production
database. Use a dedicated connection without pending work.

```sh
mysql --socket=/path/to/disposable/mysql.sock -u root -p < tests/test_foundation.sql
```

You can also open and execute the complete file in MySQL Workbench, connected
to that test instance. Each assertion prints `PASS`; an unexpected result
raises an error beginning with `FAIL`. The script rolls back test row changes
on success or failure and removes its helper procedures on success. If it
fails, stop and inspect the error; helpers are replaced on the next run.
Auto-increment gaps and helper-routine DDL are not rolled back.

The SQL suite checks fixture counts/mappings, foreign-key metadata and actions,
self-parenting, hierarchy depth, invalid references, duplicate SKUs/assignments,
null variant products, delete restrictions, cascading product ID updates, valid
reparenting and full-text search. Setup, rerun, mapping-repair and pre-integration
failure checks are documented separately in [tests/README.md](tests/README.md).
MySQL 8.0.19+ is the intended syntax target; execution on the team's exact
MySQL 8 version remains to be verified.

Milestone 1 originally passed 23 SQL assertions. Milestone 2 extends the suite
to **32 assertions**, adding full dataset coverage, matching child/root mappings,
activation states, inventory fixture preservation, valid price/stock values,
out-of-stock fixtures and multiple variant choices. Additional rerun and
collision checks are described in `tests/README.md`.

Validated on 2026-09-19 using isolated MySQL **9.7.1** instances with
`lower_case_table_names=1`: all 32 assertions passed for both an upgrade from
milestone 1 and a fresh installation. Seed reruns, preservation of changed
variant price/stock, and rejection of a conflicting variant ID without partial
inserts also passed. Inventory SQL files were executed unchanged.

The read procedures are implemented in milestone 3. Milestone 4 adds Spring Boot
APIs for categories, product search and product details; setup and HTTP contracts
are documented in [Backend/CATALOGUE_API.md](../../Backend/CATALOGUE_API.md).
Frontend pages remain for the next milestone. Tests use sequential hierarchy edits;
concurrent category reparenting is not covered by this milestone.

Milestone 3 validation on isolated MySQL **9.7.1**: **65 procedure assertions
and 32 foundation assertions passed** (97 total), as did reinstalling `06` and
executing all eleven examples in `04`. Procedure tests rolled back their row
changes; the foundation suite confirmed the original fixtures afterward.

Milestone 4 backend validation: **67 tests passed**, including four live
HTTP-to-MySQL tests against the isolated MySQL 9.7.1 fixtures using a restricted
database account. The Spring Boot application packaged successfully. See the
backend guide above for the required database profile and test setup.

The historical MySQL 9.7.1 results describe earlier isolated test runs, not verification of
the current combined fresh-install sequence. The path/dependency documentation
update does not execute SQL or establish MySQL 8 compatibility. Repeat the
fresh-install and rerun checks after the shared prerequisites are resolved.

On 2026-09-26, the catalogue-only setup passed all **97 assertions on MySQL
8.0.46** in an isolated Docker container, then passed them again after two
rounds of seed/integration/procedure reruns. Query examples and smoke queries
also executed successfully. This run used case-insensitive table names and
only the inventory portion of the shared seed; checkout/delivery setup remains
unverified. See [the Docker validation record](tests/MYSQL8_DOCKER.md) for the
pinned image, exact scope, connection commands and reproducible setup.

## Historical external issue notes (superseded where noted)

Current release dependencies are listed in [the integration handoff](../../Docs/catalogue_integration_handoff.md). Older issues below record previous milestones, not a claim that the current local setup is blocked.

Checked against `main` on 2026-10-08. No teammate file was edited here.

- `../Inventory/Inventory_Delivery_DDL.sql` and
  `../Checkout/01_checkout_schema.sql` both create `delivery`, and each file
  needs tables from the other, so neither runs unedited on a fresh database.
- The inventory DDL ends with two `--Run ...` lines. MySQL needs a space after
  `--` for a comment, so the file's last statement can fail to parse.
- The earlier `WAREHOUSE` casing problem in the inventory DDL is fixed.

Reporting now has its own procedure installer and README under
`../Management reporting/`. Follow its owner's dependency instructions; it is
not part of the catalogue installation. Validate shared column names during
integration rather than relying on older reporting-query notes.

The reporting access log depends on `employee`, which the auth schema now
creates; install auth before reporting.
