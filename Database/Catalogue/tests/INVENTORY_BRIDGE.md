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
  mysql:8.0 --mysqlx=OFF
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
The older procedure suite's negative-stock fixture conflicts with the new CHECK;
its historical results are not a current full-suite pass. This focused bridge
suite does not test inventory audit or checkout stock-decrement triggers.

No runtime pass is recorded until these commands actually succeed. Stop the
disposable container afterward without deleting it if you want to inspect it:

```sh
docker stop brightbuy-catalogue-bridge-test
```
