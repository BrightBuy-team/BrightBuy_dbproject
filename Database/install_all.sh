#!/usr/bin/env bash
# BrightBuy database installer. Runs every module's SQL in dependency order
# and stops on the first error. See Database/README.md.
#
#   Fresh install (local development and test databases only):
#     bash Database/install_all.sh --docker CONTAINER
#     MYSQL_PWD=... bash Database/install_all.sh --local
#
#   Upgrade a database that already holds data (no seeds, no deletes):
#     bash Database/install_all.sh --upgrade --docker CONTAINER
#     MYSQL_PWD=... bash Database/install_all.sh --upgrade --local
#     MYSQL_PWD=... BRIGHTBUY_BACKUP_TAKEN=yes \
#       MYSQL_HOST=... MYSQL_USER=... bash Database/install_all.sh --upgrade --remote
#
# --local and --remote read MYSQL_HOST, MYSQL_PORT and MYSQL_USER; the password
# comes from MYSQL_PWD (or a client login path), never from a file in this
# repository. A fresh install is refused on anything but this computer.
set -euo pipefail
task_root="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

task_usage() {
  echo 'Usage: bash Database/install_all.sh [--upgrade] --docker CONTAINER | --local | --remote' >&2
  exit 2
}

task_mode=install
if [[ "${1:-}" == --upgrade ]]; then task_mode=upgrade; shift; fi

case "${1:-}" in
  --docker)
    [[ -n "${2:-}" && $# == 2 ]] || task_usage
    # The container's own MYSQL_ROOT_PASSWORD stays inside the container.
    task_client=(docker exec -i "$2" sh -c 'MYSQL_PWD="$MYSQL_ROOT_PASSWORD" exec mysql -u root "$@"' sh)
    ;;
  --local)
    [[ $# == 1 ]] || task_usage
    task_host="${MYSQL_HOST:-127.0.0.1}"
    [[ "$task_host" == 127.0.0.1 || "$task_host" == localhost ]] \
      || { echo '--local only accepts a database on this computer.' >&2; exit 2; }
    task_client=(mysql --protocol=TCP --host="$task_host" --port="${MYSQL_PORT:-3306}" --user="${MYSQL_USER:-root}")
    ;;
  --remote)
    [[ $# == 1 && "$task_mode" == upgrade ]] \
      || { echo '--remote is only available with --upgrade; fresh installs are local only.' >&2; exit 2; }
    [[ -n "${MYSQL_HOST:-}" && -n "${MYSQL_USER:-}" ]] \
      || { echo 'Set MYSQL_HOST and MYSQL_USER (and MYSQL_PWD) for --remote.' >&2; exit 2; }
    [[ "${BRIGHTBUY_BACKUP_TAKEN:-}" == yes ]] \
      || { echo 'Take and test a backup first, then set BRIGHTBUY_BACKUP_TAKEN=yes.' >&2; exit 2; }
    task_client=(mysql --protocol=TCP --host="$MYSQL_HOST" --port="${MYSQL_PORT:-3306}" --user="$MYSQL_USER"
      --ssl-mode="${MYSQL_SSL_MODE:-REQUIRED}")
    ;;
  *) task_usage ;;
esac

# Tables. Every script here is safe to rerun: it only adds what is missing.
task_tables=(
  Catalogue/01_catalogue_tables.sql
  Inventory/01_inventory_schema.sql
  Shared/01_email_outbox.sql
  Auth/01_auth_schema.sql
  Checkout/01_checkout_schema.sql
  Reporting/01_reporting_tables.sql
)
# Development and demonstration data. Never run by an upgrade.
task_seeds=(
  Catalogue/02_catalogue_seed.sql
  Inventory/03_inventory_seed.sql
  Auth/03_auth_seed.sql
  Catalogue/03_catalogue_variant_seed.sql
  Checkout/03_checkout_seed.sql
)
# Views, procedures, functions and triggers. Each replaces its own objects.
task_routines=(
  Auth/02_auth_procedures.sql
  Catalogue/04_catalogue_procedures.sql
  Catalogue/05_catalogue_maintenance_procedures.sql
  Inventory/02_inventory_logic.sql
  Checkout/02_checkout_procedures.sql
  Reporting/02_reporting_procedures.sql
  Shared/02_audit_log.sql
  Shared/03_database_roles.sql
)

task_run() {
  echo "Installing $1"
  "${task_client[@]}" brightbuy < "$task_root/$1"
}

task_tables_present="$("${task_client[@]}" --batch --skip-column-names \
  -e "SELECT COUNT(*) FROM information_schema.tables WHERE table_schema='brightbuy'")"

if [[ "$task_mode" == install ]]; then
  [[ "$task_tables_present" == 0 ]] \
    || { echo 'Refusing a populated brightbuy database. Use a fresh instance, or --upgrade.' >&2; exit 3; }
  echo 'Installing 00_create_database.sql'
  "${task_client[@]}" < "$task_root/00_create_database.sql"
  for task_script in "${task_tables[@]}" "${task_seeds[@]}" "${task_routines[@]}"; do task_run "$task_script"; done
  "${task_client[@]}" brightbuy -e 'CALL sp_populate_sales_summary(7);'
else
  [[ "$task_tables_present" != 0 ]] \
    || { echo 'No brightbuy tables found: nothing to upgrade. Run a fresh install instead.' >&2; exit 3; }
  task_run Shared/04_upgrade_existing_database.sql
  for task_script in "${task_tables[@]}" "${task_routines[@]}"; do task_run "$task_script"; done
fi

echo 'Running Shared/05_release_checks.sql'
task_checks="$("${task_client[@]}" --batch brightbuy < "$task_root/Shared/05_release_checks.sql")"
if printf '%s\n' "$task_checks" | grep -q "$(printf '\t')BLOCK"; then
  printf '%s\n' "$task_checks" | grep "$(printf '\t')BLOCK" >&2
  echo 'Release checks reported BLOCK. Resolve the items above.' >&2
  exit 4
fi

if [[ "$task_mode" == install ]]; then
  echo 'Fresh installation complete: all release checks passed.'
else
  echo 'Upgrade complete: no rows were deleted, no seed was run, all release checks passed.'
fi
