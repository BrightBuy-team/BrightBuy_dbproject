# BrightBuy

An online consumer-electronics shop built for the CS3043 database module (Group 14).
Customers browse a catalogue, fill a cart and place orders for delivery or store pickup;
warehouse staff maintain products and stock; management runs sales reports.

| Layer | Technology | Folder |
|---|---|---|
| Database | MySQL 8.0, plain SQL: tables, stored procedures, functions, triggers, roles | [Database/](Database/README.md) |
| Backend | Java 17, Spring Boot, plain JDBC (no ORM, no migration tool) | `Backend/` |
| Frontend | React, TypeScript, Vite | `Frontend/` |

The business rules live in the database: checkout, stock changes, delivery estimates,
catalogue maintenance, password reset and the reports are stored procedures and functions,
and auditing is done by triggers. The backend authenticates the user, checks the role and
calls them.

## What works

- Catalogue: search, category, price and stock filters, sorting, paging, product detail with variants.
- Accounts: customer registration, sign-in for customers and employees, password reset by emailed code, sign-out.
- Cart and checkout: guest cart that joins the customer's cart at sign-in, delivery or pickup,
  cash on delivery or card, delivery estimate before ordering, order confirmation, order history.
  An item that is out of stock can still be ordered: it is back-ordered and delivery takes 3 days longer.
- Warehouse: one central warehouse; stock updates with an audit trail, low-stock list, new
  variants, price changes, product and category maintenance.
- Management: five reports with CSV export.
- Administration: creating employee accounts.

Two outside services are simulated, as the requirements allow for this phase. The **payment
gateway** accepts only its test cards (below) and never charges anything. The **email service**
queues every message in the `email_outbox` table and marks it sent; nothing is delivered.

## Run it locally

You need Docker, Java 17 or newer, Node.js 24, and npm.

**1. Database.** Start MySQL 8.0 and install the schema with sample data:

```bash
docker run -d --name brightbuy-db -p 127.0.0.1:3306:3306 -e MYSQL_ROOT_PASSWORD=choose-a-password mysql:8.0 --log-bin-trust-function-creators=1
```

```bash
bash Database/install_all.sh --docker brightbuy-db
```

Then create the account the backend signs in with. It gets the application role only:

```bash
docker exec -it brightbuy-db mysql -u root -p -e "CREATE USER 'brightbuy_app'@'%' IDENTIFIED BY 'choose-another-password'; GRANT 'brightbuy_application' TO 'brightbuy_app'@'%'; SET DEFAULT ROLE 'brightbuy_application' TO 'brightbuy_app'@'%';"
```

**2. Backend.** Copy `Backend/.env.example` to `Backend/.env.local`, fill in the password,
and set a first administrator (`BRIGHTBUY_BOOTSTRAP_ADMIN_EMAIL` and
`BRIGHTBUY_BOOTSTRAP_ADMIN_PASSWORD`, 12 or more characters). Then, inside `Backend/`:

```bash
set -a; source .env.local; set +a; ./mvnw spring-boot:run
```

**3. Frontend.** Inside `Frontend/`, copy `.env.example` to `.env.local`, then:

```bash
npm ci
```

```bash
npm run dev
```

Open <http://localhost:5173>. The pages are `/` (home and sign-in), `/catalogue.html`
(shop, cart, checkout, orders, staff catalogue, reports, admin), `/inventory.html`
(warehouse) and `/delivery.html` (delivery estimate of an order).

### Accounts and test data

- **Customers** register themselves on the sign-in page.
- **Administrator**: the one you set in step 2. Sign in with account type *Employee*, open
  *Admin*, and create warehouse and management accounts there.
- The sample customers and employees in the seed data exist so the reports have data.
  They hold placeholder password hashes and cannot sign in.
- **Test cards**: Visa `4242 4242 4242 4242`, Mastercard `5555 5555 5555 4444`,
  American Express `3782 822463 10005`, with any future expiry date and any security code.
  Any other valid card number is declined.
- **Password reset code**: read it from the simulated email:
  `SELECT body FROM email_outbox WHERE category = 'password_reset' ORDER BY email_id DESC LIMIT 1;`

## Check everything

```bash
bash scripts/verify-project.sh
```

This runs the frontend tests, build and lint; the backend unit tests; a fresh installation on
a throwaway MySQL 8.0 container; seven SQL test suites; the installer's refusal and upgrade
paths; a backup and restore; least-privilege checks; and about 120 HTTP checks through the
whole application, including concurrent orders for the last unit in stock. It removes its
container afterwards and never contacts any other database. The same script runs in GitHub
Actions on every pull request. Add `--performance` to measure the catalogue with 10,000
products, or set `BRIGHTBUY_MAVEN_OFFLINE=true` when Maven's dependencies are already downloaded.

## Documentation

| Document | Contents |
|---|---|
| [Database/README.md](Database/README.md) | Schema design, ER diagram, installation and upgrade, procedures, triggers, roles, indexes, tests, how each business rule is enforced |
| [Database/DATA_DICTIONARY.md](Database/DATA_DICTIONARY.md) | Every table and column |
| [Docs/API.md](Docs/API.md) | Every HTTP endpoint, with access rules and error answers |
| [Docs/OPERATIONS.md](Docs/OPERATIONS.md) | Settings, deployment, upgrading the shared database, backup and restore |
| [Docs/USER_GUIDE.md](Docs/USER_GUIDE.md) | How customers, warehouse staff, management and administrators use the system |
| [Docs/WORK_LOG.md](Docs/WORK_LOG.md) | Who built what |

## Repository layout

```text
Database/    SQL by module (Catalogue, Inventory, Auth, Checkout, Reporting, Shared), tests, installer
Backend/     Spring Boot application: one package per module, plus config and email
Frontend/    React pages: catalogue (shop and staff views), inventory, delivery, sign-in
Docs/        API reference, operations guide, user guide, work log
scripts/     verify-project.sh
.github/     CI (tests on pull requests) and deployment of the backend after main is verified
```

## Team

| Member | Module |
|---|---|
| Mihisara LHK | Product catalogue and search |
| Adeesha W.G.I. | Cart, checkout and orders; deployment |
| Nirmal U.K.N | Inventory and delivery |
| Atapattu D.M. | Users and authentication |
| Senadheera S.D.A.P | Management reporting |

Never commit passwords, keys or `.env` files. Only the `.env.example` templates belong in the repository.
