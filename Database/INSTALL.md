# Installing the BrightBuy database

`install_all.sh` builds the whole `brightbuy` database on a **fresh**
development or test MySQL server by running every module's SQL in dependency
order. It stops on the first error and refuses to run if `brightbuy` already
contains tables. It does not upgrade or reset an existing database.

It reads the other modules' files as they are and edits none of them.

## Requirements

- MySQL 8.0.19 or later and the `mysql` command-line client.
- `bash` (on Windows use Git Bash or WSL).
- An administrator account: the script creates a database, tables, routines,
  triggers and roles.

## Running it

From the `Database` folder. Every argument is passed to the `mysql` client.

```sh
# Recommended: store the credentials once, then install
mysql_config_editor set --login-path=brightbuy_admin --user=root --password
./install_all.sh --login-path=brightbuy_admin
```

```sh
# Alternative: password from the environment for this one command
MYSQL_PWD='your-password' ./install_all.sh -u root -h 127.0.0.1
```

Do not use a plain `-p`: the client would ask for the password once per file.
Never commit a password or put one in this folder.

When it finishes it prints object counts. A correct install shows 16 tables,
1 view, 25 procedures and functions, 4 triggers, 40 products, 48 variants,
4 cities, 3 customers and 3 employees.

## Order used

| Step | Files | Module |
|---|---|---|
| 1 | `Catalogue/00`, `01`, `02`, `03` | database, catalogue tables, indexes, seed |
| 2 | `Inventory/Inventory_Delivery_DDL.sql` (city, warehouse, variant only) | inventory |
| 3 | `Inventory/Inventory_Delivery_sample_data.sql` | cities and warehouses |
| 4 | `User and Auth/user auth schema.sql`, `procedures`, `seed` | customer, employee, login attempts |
| 5 | `Checkout/01_checkout_schema.sql`, `02_checkout_procedures.sql` | orders, order items, delivery, payment |
| 6 | `Inventory/Inventory_Delivery_DDL.sql` (variant_audit only), `Inventory_Delivery_logic.sql` | audit table, delivery-date function, audit trigger |
| 7 | `Catalogue/05`, `05b`, `06`, `08` | variant foreign key, variant seed, read and maintenance procedures |
| 8 | `Management reporting/01`, `02` | summary tables and report procedures |
| 9 | `Catalogue/09_catalogue_roles.sql` | catalogue database roles |

## What the script works around

- **`delivery` is defined twice.** Both the inventory DDL and the checkout
  schema create it, and the inventory copy needs `orders`, which checkout
  creates later. The script installs checkout's copy and skips inventory's.
  The two definitions are currently identical.
- **Invalid comment lines.** The inventory DDL ends with two `--Run ...` lines.
  MySQL needs a space after `--`, so the script leaves those lines out.
- **`Checkout/03_checkout_seed_data.sql` is not run.** It inserts an
  `Electronics` category and a product/category pair that the catalogue seed
  already holds, so it fails on this dataset.

The script checks that the inventory DDL still has the layout it expects and
stops with a message if that file has been reorganised. When the owners fix the
points above, simplify the script rather than keep the workarounds.

## Known gaps after installing

- The seeded customers and employees have placeholder password hashes and
  cannot log in. Register a customer through `POST /api/auth/register`; an
  employee needs a real BCrypt hash inserted by an administrator.
- `ProcessCheckout` creates the order and its items and reduces stock. It does
  not create `delivery` or `payment` rows, so the delivery-estimate report is
  empty and the customer summary shows no payment status.
- No orders are seeded. `sales_summary` stays empty until orders exist and
  `CALL sp_populate_sales_summary(<days>)` has run.
- `Catalogue/09` creates roles only. Application accounts are created by the
  administrator; see the end of that file.

## Checking the result

On a disposable server only, from `Database`:

```sh
mysql --login-path=brightbuy_admin < Catalogue/tests/test_foundation.sql
mysql --login-path=brightbuy_admin < Catalogue/tests/test_procedures.sql
mysql --login-path=brightbuy_admin < Catalogue/tests/test_maintenance.sql
```

Verified on 2026-10-08 on an isolated MySQL 9.7.1 instance: the install
completed, a second run was refused, the three catalogue suites passed, and a
test checkout of two units created the order, reduced stock once and wrote one
`variant_audit` row. Not yet run on MySQL 8.0.
