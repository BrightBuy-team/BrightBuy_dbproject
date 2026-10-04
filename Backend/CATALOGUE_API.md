# Catalogue backend — milestone 4

The module uses the team's existing Spring Boot 4.1.1 project and Java 25
source target. No dependency or teammate source file changes are required.
It calls the three stored procedures from the catalogue SQL milestone through
JDBC CallableStatement, with bound parameters and a five-second query timeout.
The service parses procedure output into JSON objects rather than returning
JSON-encoded strings. It never updates products, variants, prices or stock.

## Prepare and run

1. Start your development MySQL server and follow the setup order in
   [the catalogue README](../Database/Catalogue/README.md), including `06`.
   An existing milestone-3 database needs no additional schema changes.
2. Use an application database account with SELECT on `brightbuy` tables/views
   and EXECUTE on `sp_catalogue_search`, `sp_catalogue_categories`, and
   `sp_catalogue_product_detail`. No INSERT/UPDATE/DELETE or schema privileges
   are needed. Keep credentials outside Git.
3. From `Backend`, configure your own connection and run:

```sh
export BRIGHTBUY_DB_URL='jdbc:mysql://localhost:3306/brightbuy'
export BRIGHTBUY_DB_USERNAME='your_catalogue_db_user'
read -s BRIGHTBUY_DB_PASSWORD
export BRIGHTBUY_DB_PASSWORD
./mvnw spring-boot:run -Dspring-boot.run.profiles=catalogue
```

At the silent `read` command, enter your database password and press Enter.
Alternatively, set those environment variables in your IDE's run configuration.
Spring Boot does not automatically read a root `.env` file.

The API normally listens on port 8080. Set `SERVER_PORT` if that port is in use.
The opt-in `application-catalogue.properties` profile configures the database,
disables Hibernate schema generation and Flyway **for this manual-SQL development
workflow**, and disables Open Session in View. Team-wide production/migration
configuration remains separate. Without a datasource configuration, a plain
application startup or the existing whole-context smoke test will fail; this
was already true of the original project.

The JDBC setting `noAccessToProcedureBodies=true` allows explicit parameter
binding without granting the application access to stored procedure definitions.
For a remote database, configure TLS in your JDBC URL according to that server;
the localhost example is not a production deployment configuration.

## Endpoints

- `GET /api/catalogue/categories`: active categories with product counts.
- `GET /api/catalogue/products`: browse, search, filter and paginate.
- `GET /api/catalogue/products/{productId}`: active product details and variants.

Examples with a running backend:

```sh
curl 'http://localhost:8080/api/catalogue/categories'
curl 'http://localhost:8080/api/catalogue/products?page=1&pageSize=12'
curl 'http://localhost:8080/api/catalogue/products?keyword=phone&categoryId=4&minPrice=100&maxPrice=1000&inStockOnly=true&sort=price_asc'
curl 'http://localhost:8080/api/catalogue/products/1'
```

Search query parameters:

- `keyword`: optional, trimmed; at most 255 Unicode characters.
- `categoryId`: optional positive 32-bit integer; unknown category returns an empty page.
- `minPrice`, `maxPrice`: optional inclusive bounds, 0 through 99999999.99;
  at most two decimal places, no exponent notation; min cannot exceed max.
- `inStockOnly`: `true` or `false`, default `false`.
- `sort`: `name_asc` (default), `name_desc`, `price_asc`, `price_desc`, `newest`.
- `page`: 1 through 1000000, default 1.
- `pageSize`: 1 through 100, default 12.

Unknown or repeated search parameters are rejected. Empty numeric parameters
are invalid; omit optional values instead. Empty keywords mean no search.
Product IDs must be positive 32-bit integers. Values are validated before JDBC
binding so MySQL does not silently round excessive decimal precision.

JSON responses preserve the SQL contract's snake_case fields. A product page
contains `page`, `page_size`, `sort`, `total_products`, `total_pages` and `items`.
Product cards include price range and stock/count summaries for the matching
variants. Detail includes categories and all valid variants, including zero-stock
choices. Missing images are JSON null. See [PROCEDURES.md](../Database/Catalogue/PROCEDURES.md)
for the complete response fields and keyword/category/filter semantics.

No-results searches return HTTP 200 with `items: []`. Application failures use
Problem Detail JSON with `status`, `detail` and an additional `code`:

- 400 / `INVALID_PARAMETER`: invalid HTTP input or SQLSTATE 45000.
- 404 / `PRODUCT_NOT_FOUND`: missing/inactive/unavailable detail (SQLSTATE 45004).
- 503 / `CATALOGUE_UNAVAILABLE`: connection failures, pool exhaustion or query timeouts.
- 500 / `CATALOGUE_ERROR`: other database failures or invalid procedure JSON.

Raw SQL errors and credentials are not sent to clients. Internal server failures
are logged on the backend for diagnosis. Standard security/routing errors can
use Spring's normal error response instead of the catalogue Problem Detail body.

## Security and frontend integration

Only catalogue GET requests are public. Other HTTP methods on catalogue routes
are denied, and CSRF remains enabled. CORS permits GET from
`http://localhost:5173` and `http://127.0.0.1:5173` by default, without credentials.
Set comma-separated `BRIGHTBUY_CORS_ORIGINS` when the frontend uses another origin.
The future frontend should fetch JSON without sending login credentials for
these public reads. Configure this allowlist explicitly for deployment.

Adding a custom security chain disables Boot's automatic default chain, so this
module includes a lowest-priority authenticated fallback for all non-catalogue
routes. This preserves protection rather than making unrelated routes public.
The authentication owner should integrate/replace that fallback when their
module is added; scope their filter chains so public catalogue routes still
reach the catalogue chain (order 10). The fallback is not the team's completed
registration/login implementation. Checkout still owns cart validation and
atomic stock updates.

## Tests

Fast unit and HTTP-layer tests without MySQL (from `Backend`):

```sh
./mvnw '-Dtest=Catalogue*Tests' test
```

Six real-database tests are deliberately skipped unless explicitly enabled.
The mock-maker test resource uses subclass mocks so final-class instrumentation
is not needed for the catalogue test doubles. Spring's test infrastructure may
still emit a Mockito agent warning on newer JDKs.

To run the **entire** backend suite, prepare an isolated MySQL instance with
the current [catalogue bridge fixtures](../Database/Catalogue/tests/INVENTORY_BRIDGE.md)
and procedures, with unmodified sample counts/values. Set the same
connection variables to that instance, then run:

```sh
BRIGHTBUY_RUN_DB_TESTS=true ./mvnw -Dspring.profiles.active=catalogue verify
```

The opt-in tests start an HTTP server on a random port and use the real JDBC
driver and procedures. They verify search totals, detail/category responses,
combined variant filters, pagination, inactive/missing products and HTTP errors.
They also check live CORS/write denial and confirm that the application account
cannot UPDATE catalogue rows. Do not run them as root: use SELECT plus EXECUTE
on the three catalogue procedures only. The permission probe uses `WHERE 1 = 0`,
so even a wrongly privileged account cannot change a row; that account fails the test.
The rest of the suite covers validation boundaries, error mapping, parameter
binding, resource cleanup, CORS, and protection of other modules' routes.

The tests are read-only against the database but require the documented sample
counts and values. They do not create users, execute SQL seed files or start
MySQL automatically. Never point fixture-dependent tests at the shared database.

Validated on 2026-09-19 with Java 26.0.2 (compiling for Java 25) and an isolated
MySQL 9.7.1 instance using `lower_case_table_names=1`. The configured full
`verify` run passed all **67 tests**, including four live HTTP-to-MySQL tests,
and packaged the application successfully. Database tests used a dedicated
account with SELECT and execution permission on only the three catalogue
procedures. This is a historical run; see the current MySQL 8 verification below.

## Live catalogue verification — 2026-10-04

Source baseline: `e081d71`, plus the two new catalogue integration tests in this
milestone. Full Maven `verify` passed **77 tests, zero failures/errors/skips** and
packaged the application using MySQL Community Server **8.0.46**, Linux ARM64,
`lower_case_table_names=0`, foreign-key checks enabled and strict SQL mode.
Java was 26.0.2, compiling for the project's configured Java 25 target.

The fresh container `brightbuy-catalogue-final8` used the pinned image
`mysql@sha256:7dcddc01f13bab2f15cde676d44d01f61fc9f99fe7785e86196dfc07d358ae2b`.
It was limited to 1 GiB/two CPUs, with MySQL X disabled and only
`127.0.0.1:13308` published. Random test credentials were not saved in Git.
The `catalogue_final` account had SELECT on `brightbuy.*` and EXECUTE on only
the three catalogue procedures; no schema or row-write grants.

Setup followed the current bridge harness: catalogue 00–03, the unchanged
city/warehouse/variant prefix of inventory DDL, inventory seed, then the real
integration/seed helpers and tests. **126 SQL assertions passed** (19 bridge,
32 foundation, 67 procedures, 8 seed safety). This is deliberately catalogue-only:
it does not install auth/orders/delivery/reporting tables or stock-write triggers.

The frontend was run with `VITE_CATALOGUE_API_URL=http://127.0.0.1:8088/api/catalogue`
on `127.0.0.1:5173`, with the real API on `127.0.0.1:8088`. Browser checks confirmed
counts, featured products, pagination, combined filters, detail/variant prices,
quantity feedback, preserved return filters, empty searches, inactive products,
out-of-stock disabling and a 360px detail layout. No mock responses were used.

The application/frontend processes and test container were stopped afterward;
the container data was retained. Existing containers/databases were not changed.
For another run use a fresh disposable setup and your own restricted credentials,
then the environment-variable/test commands above. Do not reuse these test
settings as production configuration.

Still pending: the team's confirmed deployment version/origins/account settings,
auth/cart integration, full-team checkout/stock verification and representative
performance testing. Successful catalogue tests do not establish report SQL,
checkout, delivery or authentication correctness.
