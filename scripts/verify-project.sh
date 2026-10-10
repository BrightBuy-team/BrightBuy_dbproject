#!/usr/bin/env bash
# One fresh, labelled, loopback-only MySQL instance. Never accepts a remote DB.
# Run from any directory: bash scripts/verify-project.sh [--performance] [--keep]
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
task_logs="$(mktemp -d "${TMPDIR:-/tmp}/brightbuy-verify.XXXXXX")"
task_name="brightbuy-verify-$(node -e "process.stdout.write(require('node:crypto').randomBytes(6).toString('hex'))")"
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
      echo "Preserved stopped disposable database: $task_name"
    else
      # This exact unique container was created by this run; no user DB targeted.
      docker rm --force --volumes "$task_name" >/dev/null || true
      echo "Removed this run's disposable database: $task_name (fixtures are rebuildable)."
    fi
  fi
  echo "Verification logs: $task_logs"
  exit "$task_exit"
}
trap task_cleanup EXIT
trap 'exit 130' INT
trap 'exit 143' TERM
task_secret="$(node -e "process.stdout.write(require('node:crypto').randomBytes(24).toString('hex'))")"
task_maven=()
if [[ "${BRIGHTBUY_MAVEN_OFFLINE:-false}" == true ]]; then task_maven=(-o); fi

# Ignore ALL inherited Spring overrides, not just BRIGHTBUY_DB_URL: direct
# SPRING_DATASOURCE_* / config imports could otherwise bypass the local URL.
for task_setting in ${!SPRING_@}; do unset "$task_setting"; done
unset JAVA_TOOL_OPTIONS JDK_JAVA_OPTIONS MAVEN_OPTS MAVEN_ARGS
unset BRIGHTBUY_RUN_DB_TESTS
export SPRING_PROFILES_ACTIVE=test
export BRIGHTBUY_DB_USERNAME=verification_app BRIGHTBUY_DB_PASSWORD="$task_secret"
export BRIGHTBUY_DB_URL='jdbc:mysql://127.0.0.1:1/brightbuy'
export BRIGHTBUY_CORS_ORIGINS='http://localhost:5173'
export BRIGHTBUY_SECURE_COOKIES=false BRIGHTBUY_COOKIE_SAME_SITE=lax
export VITE_CATALOGUE_API_URL='http://localhost:8080/api/catalogue'
export VITE_AUTH_API_URL='http://localhost:8080/api/auth'
export VITE_CHECKOUT_API_URL='http://localhost:8080/api/checkout'
export VITE_REPORTS_API_URL='http://localhost:8080/api/reports'
export VITE_INVENTORY_API_URL='http://localhost:8080/api/inventory'
export VITE_DELIVERY_API_URL='http://localhost:8080/api/delivery'
(
  cd "$task_root/Frontend"
  node --test tests/*.test.mjs
  npm run build
  npm run lint
) 2>&1 | tee "$task_logs/frontend.log"
(
  cd "$task_root/Backend"
  ./mvnw "${task_maven[@]}" -Dspring.profiles.active=test package
) 2>&1 | tee "$task_logs/backend.log"

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
  if task_mysql --batch --skip-column-names -e 'SELECT 1' >/dev/null 2>&1; then task_ready=true; break; fi
  sleep 1
done
[[ "$task_ready" == true ]] || { docker logs "$task_name" > "$task_logs/mysql.log"; echo 'MySQL did not become ready.' >&2; exit 1; }
bash "$task_root/Database/install_all.sh" --docker "$task_name" 2>&1 | tee "$task_logs/install.log"
for task_sql in Catalogue/tests/test_foundation.sql Catalogue/tests/test_procedures.sql \
  Catalogue/tests/test_maintenance.sql Checkout/04_checkout_test.sql; do
  task_mysql brightbuy < "$task_root/Database/$task_sql" 2>&1 | tee -a "$task_logs/sql.log"
done
task_mysql --batch brightbuy < "$task_root/Database/Integration/04_release_checks.sql" | tee "$task_logs/release-checks.log"
if node -e "process.exit(require('node:fs').readFileSync(process.argv[1],'utf8').includes('\tBLOCK') ? 0 : 1)" "$task_logs/release-checks.log"; then
  echo 'Database release checks failed.' >&2; exit 1
fi
# Test the populated-install refusal, not just the successful happy path.
if bash "$task_root/Database/install_all.sh" --docker "$task_name" > "$task_logs/refusal.log" 2>&1; then
  echo 'Installer incorrectly accepted a populated database.' >&2; exit 1
else
  task_refusal=$?
  [[ "$task_refusal" == 3 ]] || { echo 'Unexpected installer failure.' >&2; exit 1; }
fi
task_mysql brightbuy -e "CREATE USER 'verification_reader'@'%' IDENTIFIED BY '$task_secret';
GRANT 'brightbuy_catalogue_reader' TO 'verification_reader'@'%';
SET DEFAULT ROLE 'brightbuy_catalogue_reader' TO 'verification_reader'@'%';
CREATE USER 'verification_app'@'%' IDENTIFIED BY '$task_secret';
GRANT 'brightbuy_application' TO 'verification_app'@'%';
SET DEFAULT ROLE 'brightbuy_application' TO 'verification_app'@'%';"
task_db_port="$(docker port "$task_name" 3306/tcp)"
task_db_port="${task_db_port##*:}"
[[ "$task_db_port" =~ ^[0-9]+$ ]] || { echo 'Unexpected Docker port mapping.' >&2; exit 1; }
export BRIGHTBUY_DB_URL="jdbc:mysql://127.0.0.1:$task_db_port/brightbuy"
(
  cd "$task_root/Backend"
  BRIGHTBUY_DB_USERNAME=verification_reader BRIGHTBUY_RUN_DB_TESTS=true \
    ./mvnw "${task_maven[@]}" -Dspring.profiles.active=catalogue -Dtest=CatalogueMySqlTests test
) 2>&1 | tee "$task_logs/mysql-api.log"
task_api_port="$(node --input-type=module -e "import net from 'node:net'; const s=net.createServer(); s.listen(0,'127.0.0.1',()=>{console.log(s.address().port);s.close()})")"
export SPRING_PROFILES_ACTIVE=catalogue,inventory
java -jar "$task_root/Backend/target/backend-0.0.1-SNAPSHOT.jar" \
  --server.address=127.0.0.1 --server.port="$task_api_port" > "$task_logs/api.log" 2>&1 &
task_backend_pid=$!
export BRIGHTBUY_TEST_API="http://127.0.0.1:$task_api_port"
export BRIGHTBUY_TEST_CONTAINER="$task_name"
task_ready=false
for ((task_attempt=0; task_attempt<90; task_attempt++)); do
  kill -0 "$task_backend_pid" 2>/dev/null || { echo "Backend exited; see $task_logs/api.log" >&2; exit 1; }
  if curl --silent --fail "$BRIGHTBUY_TEST_API/api/catalogue/products" >/dev/null; then task_ready=true; break; fi
  sleep 1
done
[[ "$task_ready" == true ]] || { echo 'Backend did not become ready.' >&2; exit 1; }
# The HTTP harness proves the backend reads this labelled DB before any writes.
node "$task_root/Backend/scripts/test-integration.mjs" 2>&1 | tee "$task_logs/integration.log"
if [[ "$task_performance" == true ]]; then
  task_mysql --init-command='SET @brightbuy_disposable_tests=1' brightbuy \
    < "$task_root/Database/Catalogue/tests/seed_performance.sql" > "$task_logs/load-fixtures.log"
  node "$task_root/Backend/scripts/test-performance.mjs" | tee "$task_logs/performance.json"
  echo 'Performance is measurement-only unless BRIGHTBUY_PERFORMANCE_STRICT=true; inspect within_budget and HTTP statuses.'
fi
echo 'PASS: combined local project verification. Azure was not used.'
