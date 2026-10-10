# BrightBuy

Database module project: React/TypeScript frontend, Spring Boot backend and
MySQL 8. Catalogue, accounts, checkout, inventory/delivery and management reports
share one schema. Stored/displayed monetary amounts are **USD**.

## Check the whole project without Azure

Prerequisites: Docker Desktop running, Java 17+, Node.js 24, npm and curl.
From the repository root:

```sh
npm ci --prefix Frontend
bash scripts/verify-project.sh
```

The verifier runs frontend tests/build/lint, backend tests/package, a fresh
combined SQL installation, SQL assertions, read-only HTTP/MySQL tests and
authenticated cross-module integration. It creates a unique loopback-only test
container and stops its own backend/removes its own database afterwards. It
does not touch an existing container or Azure. Logs remain in a printed temp path.

Optional: `--keep` preserves the stopped fictional database for inspection;
`--performance` adds 10,000 fictional products and two 200-request search bursts.
Set `BRIGHTBUY_PERFORMANCE_STRICT=true` to fail on local latency/error budgets,
or `BRIGHTBUY_MAVEN_OFFLINE=true` if Maven dependencies are already cached.

## Run the UI and backend

Use the [local setup guide](Docs/catalogue_integration_handoff.md#fresh-local-setup)
for a persistent development database, private backend environment and frontend
API URL. Open `/catalogue.html` for the shop, `/` for login/home,
`/inventory.html` for authorised inventory staff and `/delivery.html` for delivery.
Staff catalogue and management reports are available through catalogue navigation
after signing in with the appropriate real backend session.

## Shared deployment

Read [release readiness and teammate handoff](Docs/release_readiness.md) before
deployment. The verifier is also wired into GitHub Actions. Backend deployment
waits for successful integrated verification of a push to `main`; PRs require
review and production deployment settings belong to the owners.

Never commit `.env`/credentials, run fresh seeds against Azure, apply the archived
LKR conversion, or represent disabled card payments as successful purchases.
