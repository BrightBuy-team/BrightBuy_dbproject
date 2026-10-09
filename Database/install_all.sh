#!/usr/bin/env bash
# Fresh LOCAL development databases only. Never deletes an existing database.
set -euo pipefail
task_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
if [[ "${1:-}" == --docker && -n "${2:-}" && $# == 2 ]]; then
  # The container's own MYSQL_ROOT_PASSWORD stays inside the container.
  task_client=(docker exec -i "$2" sh -c 'MYSQL_PWD="$MYSQL_ROOT_PASSWORD" exec mysql -u root "$@"' sh)
elif [[ "${1:-}" == --local && $# == 1 ]]; then
  task_host="${MYSQL_HOST:-127.0.0.1}"
  [[ "$task_host" == 127.0.0.1 || "$task_host" == localhost ]] || { echo 'Only a local database is supported.' >&2; exit 2; }
  task_client=(mysql --protocol=TCP --host="$task_host" --port="${MYSQL_PORT:-3306}" --user="${MYSQL_USER:-root}")
else
  echo 'Usage: bash Database/install_all.sh --docker CONTAINER | --local' >&2
  exit 2
fi
task_count="$("${task_client[@]}" --batch --skip-column-names -e "SELECT COUNT(*) FROM information_schema.tables WHERE table_schema='brightbuy'")"
[[ "$task_count" == 0 ]] || { echo 'Refusing a populated brightbuy database. Use a fresh disposable instance.' >&2; exit 3; }
task_scripts=(
  Catalogue/00_create_database.sql Catalogue/01_catalogue_tables.sql
  Catalogue/02_catalogue_indexes.sql Catalogue/03_catalogue_seed_data.sql
  Inventory/Inventory_Delivery_DDL.sql Inventory/Inventory_Delivery_sample_data.sql
  'User and Auth/user auth schema.sql' 'User and Auth/user auth procedures.sql'
  'User and Auth/user auth seed.sql'
  Catalogue/05_variant_integration.sql Catalogue/05b_catalogue_variant_seed.sql
  Catalogue/06_catalogue_procedures.sql Catalogue/08_catalogue_maintenance_procedures.sql
  Checkout/01_checkout_schema.sql Inventory/Inventory_Delivery_logic.sql
  Checkout/02_checkout_procedures.sql Checkout/03_checkout_seed_data.sql
  'Management reporting/01_management_reporting_tables.sql'
  'Management reporting/02_management_reporting_procedures.sql'
  Integration/01_schema_upgrade.sql Catalogue/11_catalogue_audit.sql
  Catalogue/09_catalogue_roles.sql Integration/02_application_role.sql
)
for task_script in "${task_scripts[@]}"; do
  echo "Installing $task_script"
  if [[ "$task_script" == Catalogue/00_create_database.sql ]]; then
    "${task_client[@]}" < "$task_root/Database/$task_script"
  else
    "${task_client[@]}" brightbuy < "$task_root/Database/$task_script"
  fi
done
"${task_client[@]}" brightbuy -e 'CALL sp_populate_sales_summary(7);'
# Keep stored prices/totals in USD, matching the current shared Azure database.
# The historical opt-in LKR migration is intentionally NOT part of setup.
echo 'Fresh installation complete. No source SQL was skipped and no existing database was deleted.'
