# Isolated MySQL 8 catalogue validation

## Recorded result — 2026-09-26

Tested repository commit `eed1131` using the official `mysql:8.0` image,
resolved to MySQL Community Server **8.0.46**, Linux ARM64:

```text
mysql@sha256:7dcddc01f13bab2f15cde676d44d01f61fc9f99fe7785e86196dfc07d358ae2b
```

- Fresh catalogue-only setup: **32 foundation + 65 procedure assertions passed**.
- Repeated `03`, `05`, `05b` and `06` twice: all **97 assertions passed again**.
- `04_catalogue_queries.sql` and `07_catalogue_tests.sql` executed without errors.
- Final counts: 40 products, 10 categories, 80 assignments, 48 variants.
- The prerequisite diagnostic executed successfully and correctly reported
  missing `orders`/`delivery` tables and columns as `BLOCK`.
- No catalogue SQL fixes or teammate-file edits were needed.

This is **not full-project installation verification**. Only the city,
warehouse and variant INSERT statements from the shared seed were used; its
delivery INSERT was deliberately excluded. No replacement checkout/auth tables
were invented. The inventory DDL was executed unchanged using
`lower_case_table_names=1`, set when this new test instance was initialized.
The inventory owner's uppercase `WAREHOUSE` reference remains unresolved for
case-sensitive servers. This run does not verify `lower_case_table_names=0`,
every MySQL 8 release, the team's still-unconfirmed exact version, or HTTP/UI
integration. Manual collision and pre-integration failure scenarios from the
test README were not rerun in this milestone.

### Follow-up: variant seed safety

The later `test_variant_seed.sql` milestone adds **eight automated assertions**
for changed price/stock preservation, repeatability, collision rejection,
no partial insert, successful retry and fixture restoration. All eight passed
on this MySQL 8.0.46 container, alongside the existing 97 assertions.
A deliberately incorrect error message in a container-only helper also verified
failure detection and cleanup; the real helper was reloaded and the suite passed
again. No source seed changes were required. See the
[automated SQL regression instructions](README.md#automated-sql-regression).
Pre-integration failure scenarios are covered by the separate-instance follow-up below.

### Follow-up: pre-integration safety

Using a new `brightbuy-catalogue-preintegration8` container on the same pinned
MySQL 8.0.46 image, all **14 pre-integration assertions passed**. The unchanged
integration installer then ran twice successfully. After loading the remaining
fixtures and procedures, all **105 existing assertions** passed, giving
**119 distinct checks** across the four suites. Final counts were 40 products,
10 categories, 48 variants and 80 mappings; test/integration/seed helpers were
removed on success. No production SQL fixes were needed. The original
`brightbuy-catalogue-mysql8` instance was not modified in this follow-up.

## Existing container

Container name: `brightbuy-catalogue-mysql8`.

It has its own newly created Docker-managed anonymous data volume, no repository
mounts, no published ports and `--network none`. The host's Homebrew MySQL and
existing databases are not used. It is limited to 1 GiB RAM and two CPUs.
The test root account has an empty password; keep this disposable container
network-isolated and never reuse these settings for shared/production data.

Open its SQL prompt:

```sh
docker exec -it brightbuy-catalogue-mysql8 mysql --protocol=socket -u root brightbuy
```

Stop it when not testing, then start it again when needed. These commands retain
the test data; the container has no automatic restart policy:

```sh
docker stop brightbuy-catalogue-mysql8
docker start brightbuy-catalogue-mysql8
```

## Reproduce on a new container only

Run from the repository root with Docker Desktop running. Do not run the
creation/setup steps against the already-populated container. Docker will
reject creation if the name already exists; do not delete an existing container
just to run this recipe.

```sh
docker run --detach --name brightbuy-catalogue-mysql8 \
  --network none --memory 1g --cpus 2 \
  --label com.brightbuy.purpose=catalogue-mysql8-test \
  --env MYSQL_ALLOW_EMPTY_PASSWORD=yes \
  mysql@sha256:7dcddc01f13bab2f15cde676d44d01f61fc9f99fe7785e86196dfc07d358ae2b \
  --lower-case-table-names=1 --mysqlx=OFF
```

Initialization takes time. Before proceeding, retry this read-only check until
it succeeds and reports the expected version and case mode:

```sh
docker exec brightbuy-catalogue-mysql8 mysql --protocol=socket -u root \
  -e 'SELECT VERSION(), @@lower_case_table_names;'
```

For this **catalogue-only harness**, load the shared inventory DDL unchanged and
stream only the seed prefix preceding `INSERT INTO delivery`. This extraction
matches the shared file at the tested commit; inspect the file if it changes.
The source file is not edited. This is not a substitute for the complete shared
seed or its checkout prerequisites in a full-project installation.

```sh
(
set -e
set -o pipefail
for script in 00_create_database.sql 01_catalogue_tables.sql \
    02_catalogue_indexes.sql 03_catalogue_seed_data.sql; do
  docker exec -i brightbuy-catalogue-mysql8 mysql --protocol=socket -u root \
    < "Database/Catalogue/$script"
done
docker exec -i brightbuy-catalogue-mysql8 mysql --protocol=socket -u root brightbuy \
  < 'Database/Inventory & Delivery/Inventory_Delivery_DDL.sql'
sed '/^INSERT INTO delivery /,$d' \
  'Database/Inventory & Delivery/Inventory_Delivery_sample_data.sql' \
  | docker exec -i brightbuy-catalogue-mysql8 mysql --protocol=socket -u root brightbuy
for script in 05_variant_integration.sql 05b_catalogue_variant_seed.sql \
    06_catalogue_procedures.sql tests/test_foundation.sql tests/test_procedures.sql; do
  docker exec -i brightbuy-catalogue-mysql8 mysql --protocol=socket -u root \
    < "Database/Catalogue/$script"
done
)
```

Expect final summaries of 32 and 65 passing assertions. Stop on any SQL error;
do not use `--force`. Tests roll back row changes, but helper-routine DDL and
auto-increment gaps are not rolled back. Use this disposable instance only.

## Repeatability check on the prepared container

The following intentionally reruns catalogue seeds against these disposable
fixtures, then reruns both suites and the examples. It does not rerun the
one-time table creation or shared inventory seeds.

```sh
(
set -e
for round in 1 2; do
  for script in 03_catalogue_seed_data.sql 05_variant_integration.sql \
      05b_catalogue_variant_seed.sql 06_catalogue_procedures.sql; do
    docker exec -i brightbuy-catalogue-mysql8 mysql --protocol=socket -u root \
      < "Database/Catalogue/$script"
  done
done
for script in tests/test_foundation.sql tests/test_procedures.sql \
    tests/check_setup_prerequisites.sql 04_catalogue_queries.sql 07_catalogue_tests.sql; do
  docker exec -i brightbuy-catalogue-mysql8 mysql --protocol=socket -u root \
    < "Database/Catalogue/$script"
done
)
```

The diagnostic's missing-checkout `BLOCK` rows are expected in this limited
harness. They still mean that full-project setup is not ready; a successful
client exit code is not an all-clear from the diagnostic.

## Separate pre-integration test instance

This suite requires a fresh schema before integration. Do not undo integration
on an existing database to run it. The recorded follow-up container is already
integrated and was stopped after validation, with its data retained. Start it
only to inspect results, not to repeat the fresh-setup recipe:

```sh
docker start brightbuy-catalogue-preintegration8
docker exec -it brightbuy-catalogue-preintegration8 mysql --protocol=socket -u root brightbuy
```

To reproduce on another new instance, choose an unused disposable container
name consistently throughout the commands below. The example name was used
for the recorded run; do not delete or overwrite an existing container just
to reuse its name. Run from the repository root. As with the main harness,
this uses unchanged inventory DDL, case-insensitive names, and only the city,
warehouse and variant prefix of the shared seed, not checkout/delivery setup.

```sh
docker run --detach --name brightbuy-catalogue-preintegration8 \
  --network none --memory 1g --cpus 2 \
  --label com.brightbuy.purpose=catalogue-preintegration-test \
  --env MYSQL_ALLOW_EMPTY_PASSWORD=yes \
  mysql@sha256:7dcddc01f13bab2f15cde676d44d01f61fc9f99fe7785e86196dfc07d358ae2b \
  --lower-case-table-names=1 --mysqlx=OFF
```

Wait for this read-only command to succeed before continuing:

```sh
docker exec brightbuy-catalogue-preintegration8 mysql --protocol=socket -u root \
  -e 'SELECT VERSION(), @@lower_case_table_names;'
```

Install the pre-integration fixtures, load the real helper without automatically
calling/dropping it, and execute the new suite. Inspect the extraction commands
if the source installer/seed structure changes. A SQL error stops this block:

```sh
(
set -e
set -o pipefail
for script in 00_create_database.sql 01_catalogue_tables.sql \
    02_catalogue_indexes.sql 03_catalogue_seed_data.sql; do
  docker exec -i brightbuy-catalogue-preintegration8 mysql --protocol=socket -u root \
    < "Database/Catalogue/$script"
done
docker exec -i brightbuy-catalogue-preintegration8 mysql --protocol=socket -u root brightbuy \
  < 'Database/Inventory & Delivery/Inventory_Delivery_DDL.sql'
sed '/^INSERT INTO delivery /,$d' 'Database/Inventory & Delivery/Inventory_Delivery_sample_data.sql' \
  | docker exec -i brightbuy-catalogue-preintegration8 mysql --protocol=socket -u root brightbuy
sed '/^CALL apply_variant_product_integration();$/d; /^DROP PROCEDURE apply_variant_product_integration;$/d' \
  Database/Catalogue/05_variant_integration.sql \
  | docker exec -i brightbuy-catalogue-preintegration8 mysql --protocol=socket -u root
docker exec -i brightbuy-catalogue-preintegration8 mysql --protocol=socket -u root \
  < Database/Catalogue/tests/test_preintegration.sql
)
```

Only after all 14 assertions pass, verify the regular installers and regressions:

```sh
(
set -e
set -o pipefail
for script in 05_variant_integration.sql 05_variant_integration.sql \
    05b_catalogue_variant_seed.sql 06_catalogue_procedures.sql tests/test_foundation.sql; do
  docker exec -i brightbuy-catalogue-preintegration8 mysql --protocol=socket -u root \
    < "Database/Catalogue/$script"
done
sed '/^CALL seed_catalogue_variants();$/d; /^DROP PROCEDURE seed_catalogue_variants;$/d' \
  Database/Catalogue/05b_catalogue_variant_seed.sql \
  | docker exec -i brightbuy-catalogue-preintegration8 mysql --protocol=socket -u root
for script in tests/test_variant_seed.sql tests/test_foundation.sql tests/test_procedures.sql; do
  docker exec -i brightbuy-catalogue-preintegration8 mysql --protocol=socket -u root \
    < "Database/Catalogue/$script"
done
)
```

The new suite changes schema deliberately and commits; a failed run is not
automatically restored. Rebuild a fresh disposable instance after investigating
unexpected errors. Stop the additional container when finished to save memory:

```sh
docker stop brightbuy-catalogue-preintegration8
```
