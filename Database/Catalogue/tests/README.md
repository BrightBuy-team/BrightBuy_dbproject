# Catalogue SQL tests

Use a disposable MySQL instance only. These tests are for the milestone-2
fixtures: forty products, ten categories, forty-eight variants and eighty mappings. No Python
or application backend is required. Do not change the team's shared database.

Before preparing a fresh instance, read the [fresh-install blockers](../README.md#fresh-install-blockers-to-resolve-with-the-owners).
The inventory files are now under `Database/Inventory & Delivery/`, and the
shared seed also inserts deliveries that need checkout tables and orders
101–104. The tests do not supply those dependencies. Do not continue after a
failed setup script or treat the historical MySQL 9.7.1 results as a successful
run of the current combined installer.

Checkout's corrected schema is now `Database/Checkout/01_checkout_schema.sql`.
The customer schema and required order fixtures are still missing from this
checkout; `03_checkout_seed_data.sql` does not supply a compatible combined
dataset. Follow the parent README's prerequisite stop before step 6.
The unmerged inventory update has different fixtures, foreign-key behavior,
stock constraints and triggers: see the
[pending inventory integration checklist](../README.md#pending-inventory-branch-integration)
before applying it. The existing test results do not validate that branch.

For a catalogue-only environment without those checkout dependencies, see
[isolated MySQL 8 Docker validation](MYSQL8_DOCKER.md). On 2026-09-26, both
suites passed on MySQL **8.0.46** (97 assertions), including after installer
reruns. The record explains the deliberately limited shared-seed subset and
why this does not verify the full-project installer or case-sensitive setup.

## Read-only setup diagnostic

`check_setup_prerequisites.sql` is separate from the assertion suites below.
Run it before the shared seed (step 6), after steps 1–5 and the owners' schema
setup. It is also safe to run earlier to see missing prerequisites. From
`Database/Catalogue`, select your test instance explicitly:

```sh
mysql --socket=/path/to/disposable/mysql.sock -u root -p < tests/check_setup_prerequisites.sql
```

The script uses only SELECT statements and does not require a selected database.
It can report missing `brightbuy` tables without trying to query those tables.
Use an account allowed to inspect all required tables; hidden metadata can look
like a missing object. It checks server/version information, session foreign-key,
unique and strict-mode settings, inventory casing risk, eight base tables and
the seven checkout columns needed by the delivery seed/order reference.

- `BLOCK`: do not continue setup until the issue is resolved.
- `REVIEW`: manual verification remains necessary, including exact-version tests.
- `PASS`: only that individual metadata/session check passed.

This is a diagnostic report, not an automated gate: BLOCK rows do not cause a
nonzero client exit code. No result certifies a successful full installation.
It does not inspect existing rows, validate all column types/foreign keys or
detect duplicate seed IDs. Ask the owners to verify the checkout/auth contract
and orders 101–104 before step 6; do not use this report to justify rerunning a
failed shared seed. MySQL 9 results do not establish MySQL 8 compatibility.

Diagnostic validation (2026-09-26, existing disposable MySQL 9.7.1 instance):
the script completed and reported the missing `orders` table/column. A separate
connection with foreign-key checks, unique checks and strict mode disabled
reported all three as `BLOCK`. An in-memory copy targeting a nonexistent schema
reported all eight tables and seven columns as `BLOCK` without SQL errors.
No stored data or schema was changed. Case-sensitive-server and MySQL 8 execution
remain unverified; the full assertion suites were not rerun for this milestone.

## Automated foundation assertions

Follow the parent README's setup order, then execute `test_foundation.sql` in
MySQL Workbench, or from `Database/Catalogue` using the MySQL CLI:

```sh
mysql --socket=/path/to/disposable/mysql.sock -u root -p < tests/test_foundation.sql
```

Expect a `PASS` result for each check and a final count. `FAIL` or another SQL
error means the suite did not pass. It rolls back row changes even on failure.
The file creates and removes test-only stored procedures; those are unrelated
to the catalogue read procedures in `06_catalogue_procedures.sql`.

## Procedure assertions (milestone 3)

Install `06_catalogue_procedures.sql` on the disposable milestone-2 dataset,
then run:

```sh
mysql --socket=/path/to/disposable/mysql.sock -u root -p < tests/test_procedures.sql
```

This calls the real public procedures and inspects their JSON output. Checks
cover all sort modes, tied-price ordering, page boundaries and unique products,
keyword/SKU/short-term search, root/child/inactive categories, combined price
and stock filters on the same variant, metadata counts, product details,
zero-stock options, invalid inventory rows, empty results and invalid input.
Test row changes roll back on success or failure. Test helper procedures are
removed on success and replaced on rerun; their DDL commits independently.

Reinstall `06` and rerun the procedure suite to verify repeatable installation.
Then rerun `test_foundation.sql` to verify fixture integrity. The test routines
use different names, so the two suites do not depend on each other's helpers.

Validated on isolated MySQL 9.7.1: **65 procedure assertions + 32 foundation
assertions passed**. Procedure reinstallation and all eleven query examples
also passed. The team's exact MySQL 8 version still needs verification.

## Seed and integration reruns

After a successful fresh setup, execute `03_catalogue_seed_data.sql` twice and
`05_variant_integration.sql` twice and `05b_catalogue_variant_seed.sql` twice,
then run `tests/test_foundation.sql` again.
It must still pass, with forty products, ten categories, forty-eight variants and eighty
assignments, one variant-product foreign key and one supporting index.

To check repair of the previous placeholder mappings, first run:

```sql
USE brightbuy;
INSERT INTO product_category (product_id, category_id)
VALUES (2,2), (2,7), (3,3), (3,9), (1,6);
```

Execute `03_catalogue_seed_data.sql`, then check:

```sql
SELECT product_id, category_id
FROM product_category WHERE product_id <= 3 ORDER BY product_id, category_id;
-- Expect: (1,1), (1,4), (1,6), (2,1), (2,4), (3,1), (3,5).
-- The unrelated (1,6) mapping must survive; the four old mappings must disappear.

DELETE FROM product_category WHERE product_id=1 AND category_id=6;
```

The DELETE removes only the extra fixture added above. Run the automated suite
again after removing it.

## Pre-integration failure checks

### Automated SQL regression

`test_preintegration.sql` adds **14 assertions** for null/orphan rejection,
unchanged product-column nullability/indexes/foreign keys on rejection,
incompatible foreign-key rejection, recovery, supporting-index reuse and a
second successful integration. It loads the real integration helper definition;
no production SQL is duplicated or modified. See the
[separate Docker setup](MYSQL8_DOCKER.md#separate-pre-integration-test-instance)
for executable commands that omit only the installer's final CALL/DROP from
the input stream before the test runs.

Use a **new disposable instance** before running `05` or `05b`, with only the
five original inventory variants. Do not run this against the already-integrated
`brightbuy-catalogue-mysql8` container or any shared database. Tests add and
remove invalid fixture 99999, create/remove one incompatible test FK, and leave
the instance successfully integrated using `idx_preintegration_product`.
DDL commits independently: on unexpected failure, stop, inspect the instance,
and rebuild it before retrying. Do not assume ROLLBACK resets the schema.
Successful completion removes test/integration helper procedures; failed runs
can leave helpers or intermediate test state. This suite is intentionally not
rerunnable on its successfully integrated output.

Validated on a separate MySQL **8.0.46** container: all 14 assertions passed.
The unchanged `05` installer then ran twice, the remaining catalogue fixtures
and procedures were installed, and all 32 foundation, eight seed-safety and
65 procedure assertions passed (**119 distinct checks** across the four suites).
No teammate source files were edited. Checkout/delivery and case-sensitive
server setup remain outside this catalogue-only validation.

### Manual alternative

On a separate fresh disposable instance, run setup through the inventory seed
(steps 1–6 in the parent README, including the owners' prerequisites before
step 6). Do NOT run `05_variant_integration.sql` yet.
Run each case below separately and inspect the expected error before proceeding.

1. Insert a null product reference:

   ```sql
   USE brightbuy;
   INSERT INTO variant (variant_id, product_id) VALUES (99999, NULL);
   ```

   Execute `05_variant_integration.sql`. Expect an error containing
   `orphaned or NULL product_id values exist`. Then inspect:

   ```sql
   SELECT COUNT(*) AS product_index_entries
   FROM information_schema.statistics
   WHERE table_schema='brightbuy' AND table_name='variant' AND column_name='product_id';
   -- Expect 0: integration must stop before creating the index.
   DELETE FROM variant WHERE variant_id=99999;
   ```

2. Repeat case 1 with `(99999, 99999)` instead of `(99999, NULL)`.
   Expect the same error and zero index entries; remove variant 99999 afterward.

3. Create an incompatible foreign key:

   ```sql
   ALTER TABLE variant ADD CONSTRAINT test_wrong_fk
       FOREIGN KEY (product_id) REFERENCES product(product_id) ON DELETE CASCADE;
   ```

   Execute `05_variant_integration.sql`. Expect an error containing
   `conflicting product foreign key`. Then inspect and remove the test constraint:

   ```sql
   SELECT is_nullable FROM information_schema.columns
   WHERE table_schema='brightbuy' AND table_name='variant' AND column_name='product_id';
   -- Expect YES: integration must not modify the column after detecting conflict.
   ALTER TABLE variant DROP FOREIGN KEY test_wrong_fk, DROP INDEX test_wrong_fk;
   ```

Finally, execute `05_variant_integration.sql` successfully twice, then run
`05b_catalogue_variant_seed.sql` and `tests/test_foundation.sql`.
No inventory source files need to be modified.

## Variant seed preservation and collision checks

### Automated SQL regression

`test_variant_seed.sql` checks price/stock preservation, repeatability, the exact
collision error, no partial insert, retry after correcting a conflict, and
restoration of the two touched fixtures (eight assertions). Use only the
prepared disposable Docker catalogue database, with application writes paused.

The production seed commits internally and drops its helper after execution.
For this test, load that **same procedure definition**, omitting only the final
CALL and DROP lines from the input stream. No source file or production seed
behavior is changed. Run from the repository root:

```sh
(
set -e
set -o pipefail
docker exec -i brightbuy-catalogue-mysql8 mysql --protocol=socket -u root \
  < Database/Catalogue/tests/test_foundation.sql
sed '/^CALL seed_catalogue_variants();$/d; /^DROP PROCEDURE seed_catalogue_variants;$/d' \
  Database/Catalogue/05b_catalogue_variant_seed.sql \
  | docker exec -i brightbuy-catalogue-mysql8 mysql --protocol=socket -u root
docker exec -i brightbuy-catalogue-mysql8 mysql --protocol=socket -u root \
  < Database/Catalogue/tests/test_variant_seed.sql
docker exec -i brightbuy-catalogue-mysql8 mysql --protocol=socket -u root \
  < Database/Catalogue/tests/test_foundation.sql
docker exec -i brightbuy-catalogue-mysql8 mysql --protocol=socket -u root \
  < Database/Catalogue/tests/test_procedures.sql
)
```

Expect eight PASS results and a summary from the new suite, then 32 foundation
and 65 procedure assertions. An unexpected error stops the block; never use
`--force`. The suite explicitly restores variants 1004 and 1040 from a temporary
snapshot on success or SQL error, rather than claiming that one ROLLBACK undoes
the seed's commits. If the server/connection dies or restoration itself fails,
rebuild the disposable test database before proceeding. Helper DDL is not
rolled back; a failed run can leave test routines installed. Rerun the full
block after resolving the failure to replace them and remove them on success.
Inspect the extraction command if the seed installer structure changes.

Validated on the isolated MySQL **8.0.46** container: all eight assertions passed,
then all 32 foundation and 65 procedure assertions passed (**105 distinct checks**).
A container-only helper with an intentionally wrong collision error message
made the suite fail as expected; variants 1004 and 1040 were restored and all
32 foundation assertions still passed. Reloading the unmodified seed definition
made all eight checks pass again and removed the seed/test helper routines.
The production source file was not changed for this fault-injection check.

### Manual alternative

After a successful full setup on the disposable instance, change a catalogue
variant's stock and price:

```sql
UPDATE variant SET stock_quantity=7, price=388.00 WHERE variant_id=1004;
```

Run `05b_catalogue_variant_seed.sql` again. It must leave those values at 7 and
388.00. Restore the fixture before running the full assertion suite:

```sql
SELECT stock_quantity, price FROM variant WHERE variant_id=1004;
UPDATE variant SET stock_quantity=15, price=399.00 WHERE variant_id=1004;
```

To test an ID conflict and ensure no partial inserts occur:

```sql
UPDATE variant SET product_id=5 WHERE variant_id=1004;
DELETE FROM variant WHERE variant_id=1040; -- Remove only this test fixture.
```

Run `05b_catalogue_variant_seed.sql`. Expect `Catalogue variant ID collision`.
The count must stay at 47, and variant 1040 must remain absent. Restore the
identity and rerun the seed to restore variant 1040:

```sql
SELECT COUNT(*) FROM variant; -- Expect 47.
SELECT COUNT(*) FROM variant WHERE variant_id=1040; -- Expect 0.
UPDATE variant SET product_id=4 WHERE variant_id=1004;
```

Run `05b_catalogue_variant_seed.sql`, then `tests/test_foundation.sql`.
