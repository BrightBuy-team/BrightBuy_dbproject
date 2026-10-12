#!/usr/bin/env bash
# Verifies the whole project on this computer: frontend, backend, every SQL test
# suite, least-privilege access, backup and restore, and the HTTP integration tests.
# The database is one fresh, labelled MySQL 8.0 container that listens on loopback
# only and is removed afterwards; no other database is ever contacted.
#
#   bash scripts/verify-project.sh [--performance] [--keep]
#
# --performance also loads 10,000 products and measures the catalogue.
# --keep        stops the container instead of removing it.
set -euo pipefail
task_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
task_performance=false
task_keep=false
for task_argument in "$@"; do
  case "$task_argument" in
    --performance) task_performance=true ;;
    --keep) task_keep=true ;;
    *) echo 'Usage: bash scripts/verify-project.sh [--performance] [--keep]' >&2; exit 2 ;;
  esac
done
for task_command in docker node npm java curl; do
  command -v "$task_command" >/dev/null || { echo "Missing prerequisite: $task_command" >&2; exit 2; }
done
docker info >/dev/null
[[ -d "$task_root/Frontend/node_modules" ]] || { echo 'Run npm ci inside Frontend first.' >&2; exit 2; }

task_random() { node -e "process.stdout.write(require('node:crypto').randomBytes($1).toString('hex'))"; }
task_logs="$(mktemp -d "${TMPDIR:-/tmp}/brightbuy-verify.XXXXXX")"
task_name="brightbuy-verify-$(task_random 6)"
task_secret="$(task_random 24)"
task_created=false
task_backend_pid=''
task_cleanup() {
  task_exit=$?
  if [[ -n "$task_backend_pid" ]]; then
    kill "$task_backend_pid" 2>/dev/null || true
    wait "$task_backend_pid" 2>/dev/null || true
  fi
  if [[ "$task_created" == true ]]; then
    if [[ "$task_keep" == true ]]; then
      docker stop "$task_name" >/dev/null || true
      echo "Kept the stopped test database: $task_name"
    else
      # Only the container this run created, by its unique name.
      docker rm --force --volumes "$task_name" >/dev/null || true
      echo "Removed this run's test database: $task_name"
    fi
  fi
  echo "Verification logs: $task_logs"
  exit "$task_exit"
}
trap task_cleanup EXIT
trap 'exit 130' INT
trap 'exit 143' TERM

# Nothing inherited from the shell may point the backend at another database.
for task_setting in ${!SPRING_@} ${!BRIGHTBUY_DB_@} ${!BRIGHTBUY_BOOTSTRAP_@}; do unset "$task_setting"; done
unset JAVA_TOOL_OPTIONS JDK_JAVA_OPTIONS MAVEN_OPTS MAVEN_ARGS BRIGHTBUY_RUN_DB_TESTS BRIGHTBUY_PAYMENT_GATEWAY
task_maven=(./mvnw)
if [[ "${BRIGHTBUY_MAVEN_OFFLINE:-false}" == true ]]; then task_maven+=(-o); fi

echo '== Frontend: tests, build, lint =='
(
  cd "$task_root/Frontend"
  export VITE_CATALOGUE_API_URL='http://localhost:8080/api/catalogue'
  node --test tests/*.test.mjs
  npm run build
  npm run lint
) 2>&1 | tee "$task_logs/frontend.log"

echo '== Backend: unit tests and package =='
(
  cd "$task_root/Backend"
  "${task_maven[@]}" -Dspring.profiles.active=test clean package
) 2>&1 | tee "$task_logs/backend.log"

echo '== Database: fresh MySQL 8.0, install, SQL test suites =='
docker run --detach --name "$task_name" \
  --label com.brightbuy.purpose=disposable-integration \
  --publish 127.0.0.1::3306 --memory=768m --cpus=2 \
  --env MYSQL_ROOT_PASSWORD="$task_secret" \
  mysql@sha256:7dcddc01f13bab2f15cde676d44d01f61fc9f99fe7785e86196dfc07d358ae2b \
  --mysqlx=OFF --log-bin-trust-function-creators=1 >/dev/null
task_created=true
task_mysql() {
  docker exec -i "$task_name" sh -c 'MYSQL_PWD="$MYSQL_ROOT_PASSWORD" exec mysql -u root "$@"' sh "$@"
}
task_ready=false
for ((task_attempt=0; task_attempt<90; task_attempt++)); do
  if task_mysql --protocol=TCP --batch --skip-column-names -e 'SELECT 1' >/dev/null 2>&1; then task_ready=true; break; fi
  sleep 1
done
[[ "$task_ready" == true ]] || { docker logs "$task_name" > "$task_logs/mysql.log" 2>&1; echo 'MySQL did not become ready.' >&2; exit 1; }

bash "$task_root/Database/install_all.sh" --docker "$task_name" 2>&1 | tee "$task_logs/install.log"
for task_sql in test_catalogue_foundation test_catalogue_procedures test_catalogue_maintenance \
  test_auth test_inventory test_checkout test_shared; do
  echo "Running Database/Tests/$task_sql.sql"
  task_mysql --batch --skip-column-names brightbuy < "$task_root/Database/Tests/$task_sql.sql" >> "$task_logs/sql.log" 2>&1 \
    || { tail -5 "$task_logs/sql.log" >&2; echo "SQL suite failed: $task_sql" >&2; exit 1; }
  tail -1 "$task_logs/sql.log"
done

echo '== Installer: refuses a populated database; an upgrade changes nothing =='
if bash "$task_root/Database/install_all.sh" --docker "$task_name" > "$task_logs/refusal.log" 2>&1; then
  echo 'The installer accepted a populated database.' >&2; exit 1
else
  task_refusal=$?
  [[ "$task_refusal" == 3 ]] || { cat "$task_logs/refusal.log" >&2; echo 'Unexpected installer failure.' >&2; exit 1; }
fi
task_rows() {
  task_mysql --batch --skip-column-names brightbuy -e "SELECT CONCAT_WS(',',
    (SELECT COUNT(*) FROM product), (SELECT COUNT(*) FROM variant), (SELECT COUNT(*) FROM customer),
    (SELECT COUNT(*) FROM orders), (SELECT COUNT(*) FROM order_item), (SELECT COUNT(*) FROM payment),
    (SELECT COUNT(*) FROM audit_log), (SELECT COUNT(*) FROM variant_audit), (SELECT COUNT(*) FROM warehouse),
    (SELECT COUNT(*) FROM information_schema.tables WHERE table_schema = DATABASE()),
    (SELECT COUNT(*) FROM information_schema.routines WHERE routine_schema = DATABASE()),
    (SELECT COUNT(*) FROM information_schema.triggers WHERE trigger_schema = DATABASE()))"
}
task_before="$(task_rows)"
bash "$task_root/Database/install_all.sh" --upgrade --docker "$task_name" > "$task_logs/upgrade.log" 2>&1 \
  || { cat "$task_logs/upgrade.log" >&2; echo 'The upgrade failed on a current database.' >&2; exit 1; }
[[ "$(task_rows)" == "$task_before" ]] || { echo 'The upgrade changed a current database.' >&2; exit 1; }
echo "PASS: fresh install refused on a populated database; upgrade left $task_before unchanged"

echo '== Backup and restore (SAF-4, SAF-5) =='
docker exec "$task_name" sh -c 'MYSQL_PWD="$MYSQL_ROOT_PASSWORD" exec mysqldump -u root \
  --single-transaction --routines --triggers --events --no-tablespaces brightbuy' > "$task_logs/backup.sql" 2> "$task_logs/backup.log"
task_mysql -e 'CREATE DATABASE brightbuy_restore_check CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci'
task_mysql brightbuy_restore_check < "$task_logs/backup.sql"
task_compare="SELECT CONCAT_WS(',',
  (SELECT COUNT(*) FROM information_schema.tables WHERE table_schema = DATABASE()),
  (SELECT COUNT(*) FROM information_schema.routines WHERE routine_schema = DATABASE()),
  (SELECT COUNT(*) FROM information_schema.triggers WHERE trigger_schema = DATABASE()),
  (SELECT COUNT(*) FROM product), (SELECT COUNT(*) FROM variant), (SELECT COALESCE(SUM(stock_quantity), 0) FROM variant),
  (SELECT COUNT(*) FROM customer), (SELECT COUNT(*) FROM orders), (SELECT COALESCE(SUM(total_amount), 0) FROM orders),
  (SELECT COUNT(*) FROM order_item), (SELECT COUNT(*) FROM payment), (SELECT COUNT(*) FROM audit_log))"
task_original="$(task_mysql --batch --skip-column-names brightbuy -e "$task_compare")"
task_restored="$(task_mysql --batch --skip-column-names brightbuy_restore_check -e "$task_compare")"
[[ "$task_original" == "$task_restored" ]] \
  || { echo "The restored copy differs: $task_original / $task_restored" >&2; exit 1; }
# The restored copy must also work, not just hold the same rows.
task_mysql --batch --skip-column-names brightbuy_restore_check \
  -e "CALL sp_checkout_quote(JSON_ARRAY(JSON_OBJECT('variantId', 1, 'quantity', 1)), @status, @total); SELECT @status;" | grep -qx OK \
  || { echo 'A stored procedure does not run in the restored copy.' >&2; exit 1; }
task_mysql -e 'DROP DATABASE brightbuy_restore_check'
rm -f "$task_logs/backup.sql"
echo "PASS: mysqldump backup restored into a second database with identical contents ($task_restored)"

echo '== Least privilege (SEC-7) =='
task_mysql brightbuy -e "CREATE USER 'verification_reader'@'%' IDENTIFIED BY '$task_secret';
GRANT 'brightbuy_catalogue_reader' TO 'verification_reader'@'%';
SET DEFAULT ROLE 'brightbuy_catalogue_reader' TO 'verification_reader'@'%';
CREATE USER 'verification_app'@'%' IDENTIFIED BY '$task_secret';
GRANT 'brightbuy_application' TO 'verification_app'@'%';
SET DEFAULT ROLE 'brightbuy_application' TO 'verification_app'@'%';"
task_as() {
  docker exec -i --env MYSQL_PWD="$task_secret" "$task_name" \
    mysql --protocol=TCP --host=127.0.0.1 --user="$1" --batch --skip-column-names brightbuy -e "$2"
}
task_allowed() { task_as "$1" "$2" >/dev/null 2>&1 || { echo "Unexpectedly denied for $1: $3" >&2; exit 1; }; echo "PASS: $1 can $3"; }
task_denied() {
  if task_as "$1" "$2" >/dev/null 2>&1; then echo "Unexpectedly allowed for $1: $3" >&2; exit 1; fi
  echo "PASS: $1 cannot $3"
}
task_allowed verification_app 'CALL sp_catalogue_product_detail(1, @result)' 'call the stored procedures'
task_allowed verification_app 'SELECT customer_id, email FROM customer LIMIT 1' 'read customer contact details'
task_denied verification_app 'SELECT password_hash FROM customer LIMIT 1' 'read customer password hashes directly'
task_denied verification_app 'SELECT password_hash FROM employee LIMIT 1' 'read the employee table directly'
task_denied verification_app 'DELETE FROM orders' 'delete orders'
task_denied verification_app 'UPDATE variant SET stock_quantity = 999 WHERE variant_id = 1' 'change stock without the audited procedure'
task_denied verification_app 'DELETE FROM audit_log' 'delete audit records'
task_denied verification_app 'DROP TABLE product' 'drop tables'
task_denied verification_app 'CREATE TABLE verification_probe (id INT)' 'create tables'
task_allowed verification_reader 'CALL sp_catalogue_categories(@result)' 'browse the catalogue'
task_denied verification_reader 'SELECT email FROM customer LIMIT 1' 'read customers'
task_denied verification_reader "CALL sp_inventory_set_stock(1, 5)" 'change stock'

echo '== Catalogue API on MySQL with the read-only account =='
task_db_port="$(docker port "$task_name" 3306/tcp)"
task_db_port="${task_db_port##*:}"
[[ "$task_db_port" =~ ^[0-9]+$ ]] || { echo 'Unexpected Docker port mapping.' >&2; exit 1; }
export BRIGHTBUY_DB_URL="jdbc:mysql://127.0.0.1:$task_db_port/brightbuy"
export BRIGHTBUY_DB_PASSWORD="$task_secret"
export BRIGHTBUY_CORS_ORIGINS='http://localhost:5173'
(
  cd "$task_root/Backend"
  BRIGHTBUY_DB_USERNAME=verification_reader BRIGHTBUY_RUN_DB_TESTS=true \
    "${task_maven[@]}" -Dbrightbuy.email.dispatch-enabled=false -Dtest=CatalogueMySqlTests -Dsurefire.failIfNoSpecifiedTests=true test
) 2>&1 | tee "$task_logs/mysql-api.log"

echo '== Whole application over HTTP with the application account =='
task_api_port="$(node --input-type=module -e "import net from 'node:net'; const s=net.createServer(); s.listen(0,'127.0.0.1',()=>{console.log(s.address().port);s.close()})")"
export BRIGHTBUY_TEST_ADMIN_EMAIL="bootstrap-$(task_random 4)@example.invalid"
export BRIGHTBUY_TEST_ADMIN_PASSWORD="$(task_random 12)"
BRIGHTBUY_DB_USERNAME=verification_app \
  BRIGHTBUY_BOOTSTRAP_ADMIN_EMAIL="$BRIGHTBUY_TEST_ADMIN_EMAIL" BRIGHTBUY_BOOTSTRAP_ADMIN_PASSWORD="$BRIGHTBUY_TEST_ADMIN_PASSWORD" \
  java -jar "$task_root/Backend/target/backend-0.0.1-SNAPSHOT.jar" \
  --server.address=127.0.0.1 --server.port="$task_api_port" \
  --brightbuy.email.dispatch-interval-ms=1000 > "$task_logs/api.log" 2>&1 &
task_backend_pid=$!
export BRIGHTBUY_TEST_API="http://127.0.0.1:$task_api_port"
export BRIGHTBUY_TEST_CONTAINER="$task_name"
task_ready=false
for ((task_attempt=0; task_attempt<90; task_attempt++)); do
  kill -0 "$task_backend_pid" 2>/dev/null || { echo "The backend exited; see $task_logs/api.log" >&2; exit 1; }
  if curl --silent --fail "$BRIGHTBUY_TEST_API/api/catalogue/products" >/dev/null; then task_ready=true; break; fi
  sleep 1
done
[[ "$task_ready" == true ]] || { echo 'The backend did not become ready.' >&2; exit 1; }
node "$task_root/Backend/scripts/test-integration.mjs" 2>&1 | tee "$task_logs/integration.log"
# Card numbers and passwords must never reach the application log (SEC-2).
if grep -qE '4242424242424242|4000000000000002|DisposableFixtureOnly2026|'"$BRIGHTBUY_TEST_ADMIN_PASSWORD" "$task_logs/api.log"; then
  echo 'The application log contains a card number or a password.' >&2; exit 1
fi
echo 'PASS: the application log holds no card number and no password'

if [[ "$task_performance" == true ]]; then
  echo '== Catalogue performance with 10,000 products =='
  task_mysql --init-command='SET @brightbuy_disposable_tests=1' brightbuy \
    < "$task_root/Database/Tests/seed_performance.sql" > "$task_logs/load-fixtures.log"
  node "$task_root/Backend/scripts/test-performance.mjs" | tee "$task_logs/performance.json"
  echo 'Measurements only, unless BRIGHTBUY_PERFORMANCE_STRICT=true: read within_budget above.'
fi
echo 'PASS: whole-project verification on a local, disposable database.'
