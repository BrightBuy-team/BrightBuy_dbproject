#!/usr/bin/env bash
# BrightBuy combined database install for a FRESH development/test server.
# Runs every module's SQL in dependency order and stops on the first error.
# Reads teammates' files without changing them. Details: INSTALL.md.
#
# Usage (all arguments are passed to the mysql client):
#   ./install_all.sh --login-path=brightbuy_admin
#   MYSQL_PWD='...' ./install_all.sh -u root -h 127.0.0.1
#
# Do not use a plain "-p": the client would ask for the password once per file.
set -euo pipefail
cd "$(dirname "$0")"

MYSQL_BIN="${MYSQL_BIN:-mysql}"
MYSQL_ARGS=("$@")
DB=brightbuy
INVENTORY_DDL="Inventory/Inventory_Delivery_DDL.sql"

fail() { echo "install_all: $*" >&2; exit 1; }
sql() { "$MYSQL_BIN" ${MYSQL_ARGS[@]+"${MYSQL_ARGS[@]}"} "$@"; }
run_file() { echo "==> $1"; sql "$DB" < "$1"; }

# --- Preflight -------------------------------------------------------------
command -v "$MYSQL_BIN" >/dev/null || fail "mysql client not found (set MYSQL_BIN)"

FILES=(
  "Catalogue/00_create_database.sql" "Catalogue/01_catalogue_tables.sql"
  "Catalogue/02_catalogue_indexes.sql" "Catalogue/03_catalogue_seed_data.sql"
  "$INVENTORY_DDL" "Inventory/Inventory_Delivery_sample_data.sql"
  "Inventory/Inventory_Delivery_logic.sql"
  "User and Auth/user auth schema.sql" "User and Auth/user auth procedures.sql"
  "User and Auth/user auth seed.sql"
  "Checkout/01_checkout_schema.sql" "Checkout/02_checkout_procedures.sql"
  "Catalogue/05_variant_integration.sql" "Catalogue/05b_catalogue_variant_seed.sql"
  "Catalogue/06_catalogue_procedures.sql" "Catalogue/08_catalogue_maintenance_procedures.sql"
  "Management reporting/01_management_reporting_tables.sql"
  "Management reporting/02_management_reporting_procedures.sql"
  "Catalogue/09_catalogue_roles.sql"
)
for file in "${FILES[@]}"; do [ -f "$file" ] || fail "missing file: $file"; done

# The inventory DDL is split around its delivery table (see INSTALL.md). If its
# owner reorganises the file, stop here instead of installing the wrong part.
[ "$(grep -c '^-- Delivery Table' "$INVENTORY_DDL")" = 1 ] \
  || fail "$INVENTORY_DDL: expected one '-- Delivery Table' marker; update this script"
[ "$(grep -c '^-- Variant Audit Table' "$INVENTORY_DDL")" = 1 ] \
  || fail "$INVENTORY_DDL: expected one '-- Variant Audit Table' marker; update this script"
[ "$(grep -c '^CREATE TABLE' "$INVENTORY_DDL")" = 5 ] \
  || fail "$INVENTORY_DDL: expected five CREATE TABLE statements; update this script"

sql -e "SELECT 1" >/dev/null || fail "cannot connect with the given mysql options"
existing="$(sql -N -e "SELECT COUNT(*) FROM information_schema.tables WHERE table_schema = '$DB'")"
[ "$existing" = 0 ] || fail "database '$DB' already has $existing tables; this script is for a fresh install only"

# --- Install ---------------------------------------------------------------
echo "==> Catalogue/00_create_database.sql"
sql < "Catalogue/00_create_database.sql"
run_file "Catalogue/01_catalogue_tables.sql"
run_file "Catalogue/02_catalogue_indexes.sql"
run_file "Catalogue/03_catalogue_seed_data.sql"

echo "==> $INVENTORY_DDL (city, warehouse, variant)"
awk '/^-- Delivery Table/ { exit } { print }' "$INVENTORY_DDL" | sql "$DB"
run_file "Inventory/Inventory_Delivery_sample_data.sql"

run_file "User and Auth/user auth schema.sql"
run_file "User and Auth/user auth procedures.sql"
run_file "User and Auth/user auth seed.sql"

run_file "Checkout/01_checkout_schema.sql"
run_file "Checkout/02_checkout_procedures.sql"

echo "==> $INVENTORY_DDL (variant_audit)"
awk '/^-- Variant Audit Table/ { keep = 1 } keep && !/^--[^ ]/ { print }' "$INVENTORY_DDL" | sql "$DB"
run_file "Inventory/Inventory_Delivery_logic.sql"

run_file "Catalogue/05_variant_integration.sql"
run_file "Catalogue/05b_catalogue_variant_seed.sql"
run_file "Catalogue/06_catalogue_procedures.sql"
run_file "Catalogue/08_catalogue_maintenance_procedures.sql"

run_file "Management reporting/01_management_reporting_tables.sql"
run_file "Management reporting/02_management_reporting_procedures.sql"

run_file "Catalogue/09_catalogue_roles.sql"

# --- Summary ---------------------------------------------------------------
echo "==> Installed. Object counts in '$DB':"
sql --table "$DB" -e "
SELECT 'tables' AS object, COUNT(*) AS total FROM information_schema.tables
  WHERE table_schema = '$DB' AND table_type = 'BASE TABLE'
UNION ALL SELECT 'views', COUNT(*) FROM information_schema.views WHERE table_schema = '$DB'
UNION ALL SELECT 'procedures and functions', COUNT(*) FROM information_schema.routines WHERE routine_schema = '$DB'
UNION ALL SELECT 'triggers', COUNT(*) FROM information_schema.triggers WHERE trigger_schema = '$DB'
UNION ALL SELECT 'products', COUNT(*) FROM product
UNION ALL SELECT 'variants', COUNT(*) FROM variant
UNION ALL SELECT 'cities', COUNT(*) FROM city
UNION ALL SELECT 'customers', COUNT(*) FROM customer
UNION ALL SELECT 'employees', COUNT(*) FROM employee;"
