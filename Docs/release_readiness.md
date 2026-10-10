# Release readiness and shared-owner handoff — 2026-10-10

This update completes the remaining locally actionable verification, search-load
and deployment-safety work. It does not deploy Azure or implement a pretend card
gateway. USD prices and all existing currency data remain unchanged.

## Changes for the team

- Catalogue: overlapping identical searches share one in-flight database call.
  Completed responses/errors are removed immediately; later requests read fresh
  prices/stock. Filter/page keys remain distinct, and each caller parses its own JSON.
- Database pool: configurable `BRIGHTBUY_DB_POOL_SIZE`, default 4 rather than
  Hikari's implicit 10. Reducing contention on the tested two-CPU instance removed
  distinct-search connection timeouts. Re-measure Azure rather than increasing
  the pool blindly; multiply the connection budget by the number of app replicas.
- Atapattu: `AuthSecurityConfiguration` aligns XSRF cookies with Secure/SameSite
  session policy, including deletion. Local HTTP remains Lax/non-Secure; production
  can select cross-site None with Secure. CSRF/session protections are retained.
- Adeesha/Induru: production profile validates verified MySQL TLS, exact HTTPS
  CORS origins, private non-root credentials and no automatic schema modifications
  before datasource initialization. Conflicting Hikari TLS overrides are rejected.
- CI/CD: new `project-verification.yml` installs and tests ALL module SQL in an
  isolated pinned MySQL container, plus frontend/backend/HTTP integration. Backend
  unit CI explicitly uses the test profile. CD now follows successful integrated
  push verification on main, skips PR/fork and superseded results, uses a commit-SHA
  image tag and the production environment. No direct feature-branch deployment.
- Frontend: added `npm test`; removed unused dependencies literally named `20`
  and `22`. Clean installation uncovered six previously undeclared shared UI
  imports; declared/locked Radix Slot, CVA, clsx, Framer Motion, Lucide and Tailwind
  Merge explicitly. Added regression checks for direct imports/numeric dependency
  mistakes. Only two retained versions were updated for reported build-tool DoS
  advisories: brace-expansion 5.0.9→5.0.12 and source-map-js 1.2.1→1.2.2.
  No other retained versions changed. Online npm audit then reported zero known
  vulnerabilities; this is not a guarantee that all dependencies are flaw-free.
- Database: `Integration/04_release_checks.sql` is read-only metadata inspection
  of required tables/routines, checkout signature, address snapshot, constraints,
  order uniqueness, triggers and an unchanged USD baseline. Missing metadata is
  BLOCK, not proof a module's code is absent. Presence is not semantic verification.

These shared changes need review by the named owners before your manual PR merge.
No teammate message, commit, push or Azure/database credential change was made.

## Reproduce verification

```sh
npm ci --prefix Frontend
bash scripts/verify-project.sh
bash scripts/verify-project.sh --performance --keep
# Enforce local smoke budgets explicitly:
BRIGHTBUY_PERFORMANCE_STRICT=true bash scripts/verify-project.sh --performance
```

Requires Docker, Java 17+, Node 24, npm and curl. The script creates only
new, labelled, loopback-only instances with random disposable credentials. It
checks SQL before HTTP fixture writes and proves the app reads the same test DB.
Only its own backend/container is stopped/removed. Logs are preserved; `--keep`
retains a stopped test container. Neither option accepts a shared/remote DB URL.

Latest full functional run: frontend 190 passed/build/lint; backend 115 passed
plus six opt-in HTTP/MySQL tests passed separately; SQL 148 assertions; authenticated
integration 73 checks. Twenty concurrent pickup sessions produced exactly twenty
orders/stock deductions. GitHub workflows have been syntax-checked, but their
hosted runs can only be verified after pushing your PR.

Local performance on pinned MySQL 8.0.46, two CPUs, 768 MB, pool 4, 10,041 active
products: sequential p95 browse 48 ms, search 22 ms, detail 6 ms, combined filters
68 ms. Identical 200-request burst p95 55 ms; **200 distinct searches p95 1,930 ms**.
Both bursts returned 200/200 successes and the strict smoke-budget gate passed.
These supersede the old identical-burst
limitation, but are not sustained 200-browser/Azure capacity certification.

## Deployment owner checklist (not executed here)

1. Rotate the previously exposed credential privately; use the scoped application
   role, not a shared admin login. Back up the database and test restoration.
2. Apply only reviewed schema/routine upgrades in the existing
   [upgrade order](catalogue_integration_handoff.md#shared-upgrade-order).
   Do not run the fresh installer, seeds, tests, load fixture or LKR migration.
3. Run `04_release_checks.sql` read-only as an owner with metadata visibility;
   resolve BLOCK results. Review actual grants and invalid existing data privately.
4. Set `SPRING_PROFILES_ACTIVE=catalogue,inventory,production`, in that order.
   Configure private `BRIGHTBUY_DB_URL=jdbc:mysql://YOUR_HOST/brightbuy?sslMode=VERIFY_IDENTITY`,
   application username/password, exact HTTPS `BRIGHTBUY_CORS_ORIGINS` (no trailing
   slash/path), and `BRIGHTBUY_COOKIE_SAME_SITE=lax` for same-site or `none` for
   cross-site HTTPS. Production forces Secure cookies. Never disable certificate
   verification to work around TLS failures. Review pool size for Azure capacity.
5. Configure the GitHub production environment's reviewer/branch restrictions and
   existing Azure publish secret. Integrated verification should be a required
   PR check; branch/environment settings cannot be changed from source files alone.
6. Build/deploy the matching frontend with its HTTPS public API URL. All four HTML
   entry pages must be served; Vite API variables are build-time, never DB secrets.
7. On deployment, verify customer/staff/management login/logout, allowed/disallowed
   CORS, session/XSRF Secure/SameSite, own history/privacy, COD/delivery/audit/reports,
   and sustained mixed-user performance. Use approved test accounts and stock.

## Real external dependencies still open

- Card provider selection and credentials, gateway authorization/capture/webhooks,
  refund/failure/retry policy and end-to-end sandbox verification. Card remains
  unavailable before any order/stock write; COD is the completed usable flow.
- Azure deployment/credential rotation/backup ownership and production acceptance.
- Real contact mailbox, warehouse/pickup instructions and agreed stock threshold.
- Final owner review, PR checks/merge and project demonstration/sign-off.

Persistent checkout idempotency across HTTP timeouts remains a separate enhancement:
the UI prevents simultaneous double clicks, but a client must check order history
after an uncertain response before placing the purchase again. Do not claim that
ordinary retries are exactly-once purchases.
