# Current inventory bridge regression

This tests the two catalogue integration changes against the merged inventory
city, warehouse and variant definitions. It is **not a full-team installation**:
auth/checkout/delivery dependencies and the double stock-decrement mechanism
still need their owners' integration agreement. No teammate files are edited.

Run from the repository root with Docker Desktop's engine running. Use a **new**
disposable container; do not reuse your catalogue or team-test containers.
The empty root password is only for this network-isolated, unexposed instance.

```sh
docker run --name brightbuy-catalogue-bridge-test --network none \
  --memory 1g --cpus 2 -e MYSQL_ALLOW_EMPTY_PASSWORD=yes -d \
  mysql@sha256:7dcddc01f13bab2f15cde676d44d01f61fc9f99fe7785e86196dfc07d358ae2b \
  --mysqlx=OFF
docker logs brightbuy-catalogue-bridge-test
docker exec brightbuy-catalogue-bridge-test mysqladmin --protocol=socket -u root ping
```

Wait until the final MySQL server is ready (not just the temporary initialization
server). Keep the default Linux case-sensitive table names. Then run this block;
any error stops setup. The `sed` boundary deliberately selects only inventory's
city/warehouse/variant DDL, avoiding fabricated customer/orders tables and the
unresolved delivery dependency. Check that boundary if the owner reorganizes DDL.

```sh
(
set -e
set -o pipefail
for script in Database/Catalogue/00_create_database.sql \
  Database/Catalogue/01_catalogue_tables.sql \
  Database/Catalogue/02_catalogue_indexes.sql \
  Database/Catalogue/03_catalogue_seed_data.sql
do
  docker exec -i brightbuy-catalogue-bridge-test mysql -u root < "$script"
done
sed '/^-- Delivery Table/,$d' Database/Inventory/Inventory_Delivery_DDL.sql |
  docker exec -i brightbuy-catalogue-bridge-test mysql -u root brightbuy
docker exec -i brightbuy-catalogue-bridge-test mysql -u root brightbuy \
  < Database/Inventory/Inventory_Delivery_sample_data.sql
sed '/^CALL apply_variant_product_integration();/,$d' \
  Database/Catalogue/05_variant_integration.sql |
  docker exec -i brightbuy-catalogue-bridge-test mysql -u root
sed '/^CALL seed_catalogue_variants();/,$d' \
  Database/Catalogue/05b_catalogue_variant_seed.sql |
  docker exec -i brightbuy-catalogue-bridge-test mysql -u root
docker exec -i brightbuy-catalogue-bridge-test mysql -u root \
  < Database/Catalogue/tests/test_inventory_bridge.sql
docker exec -i brightbuy-catalogue-bridge-test mysql -u root \
  < Database/Catalogue/06_catalogue_procedures.sql
docker exec -i brightbuy-catalogue-bridge-test mysql -u root \
  < Database/Catalogue/tests/test_foundation.sql
docker exec -i brightbuy-catalogue-bridge-test mysql -u root \
  < Database/Catalogue/tests/test_procedures.sql
docker exec -i brightbuy-catalogue-bridge-test mysql -u root \
  < Database/Catalogue/05_variant_integration.sql
docker exec -i brightbuy-catalogue-bridge-test mysql -u root \
  < Database/Catalogue/05b_catalogue_variant_seed.sql
sed '/^CALL seed_catalogue_variants();/,$d' \
  Database/Catalogue/05b_catalogue_variant_seed.sql |
  docker exec -i brightbuy-catalogue-bridge-test mysql -u root
docker exec -i brightbuy-catalogue-bridge-test mysql -u root \
  < Database/Catalogue/tests/test_variant_seed.sql
)
```

The bridge suite has 19 assertions: NULL-reference rejection before DDL,
default-FK upgrade, rerun idempotency, duplicate-FK rejection, missing dependency
rollback, warehouse/variant collision safety, five restored original variants,
48 total variants, and preservation of existing prices/stock. It commits fixtures
and DDL; after failure inspect the error and restart in another fresh instance.
Do not blindly rerun it against partially completed data.

The legacy `test_preintegration.sql` starts from an inventory schema with no
product FK and five seeded variants; it is not the entry point for this setup.
The current procedure suite verifies negative stock is rejected with MySQL
error 3819 and leaves existing quantities unchanged. NULL stock remains allowed
by inventory's CHECK, so it separately verifies catalogue filtering of NULLs.
No constraints are disabled. This focused setup does not test inventory audit
or checkout stock-decrement triggers.

## Validation record — 2026-09-30

Passed on isolated MySQL **8.0.46**, using the pinned image above,
`lower_case_table_names=0`, `foreign_key_checks=1` and strict SQL mode:

- 19 current-inventory bridge assertions.
- 32 foundation assertions.
- 67 procedure assertions.
- 8 seed-safety assertions.

**126 assertions passed.** Full `05` and `05b` script reruns also succeeded.
Final fixture counts: 40 products, 48 variants and 3 warehouses.
Test container: `brightbuy-catalogue-bridge-verified`.

The first run in `brightbuy-catalogue-bridge-test` exposed MySQL error 1826:
DROP/ADD of the same FK name in one ALTER is rejected. The migration now selects
an unused schema-wide FK name while retaining a single ALTER and enabled FK
checks. The successful run started from a separate fresh instance, not a
partially applied migration. Both containers were retained, stopped, for inspection.

This is a catalogue validation result, **not full-team database sign-off**.
Auth/checkout/delivery dependency resolution remains outside this test setup.

Stop your disposable container afterward without deleting it if you want to inspect it:

```sh
docker stop brightbuy-catalogue-bridge-test
```
