# Operating BrightBuy

Settings, deployment, upgrading the shared database, and backup and restore.
For a first local run see the [README](../README.md).

## Backend settings

All settings are environment variables; nothing private is in the repository.
`Backend/.env.example` is the template.

| Variable | Purpose | Default |
|---|---|---|
| `BRIGHTBUY_DB_URL` | JDBC address of the database | `jdbc:mysql://localhost:3306/brightbuy` |
| `BRIGHTBUY_DB_USERNAME`, `BRIGHTBUY_DB_PASSWORD` | The backend's database account | none: required |
| `BRIGHTBUY_DB_POOL_SIZE` | Database connections kept open | 4 |
| `BRIGHTBUY_CORS_ORIGINS` | Browser addresses allowed to call the API, comma separated | the local Vite addresses |
| `BRIGHTBUY_SECURE_COOKIES` | Send the session cookie over HTTPS only | false |
| `BRIGHTBUY_COOKIE_SAME_SITE` | `lax`, `strict`, or `none` when the frontend is on another site | lax |
| `BRIGHTBUY_PAYMENT_GATEWAY` | `simulated`, or `disabled` to switch card checkout off | simulated |
| `BRIGHTBUY_BOOTSTRAP_ADMIN_EMAIL`, `BRIGHTBUY_BOOTSTRAP_ADMIN_PASSWORD` | Creates the first administrator at start-up | empty |
| `SPRING_PROFILES_ACTIVE` | Set to `production` on a public server | none |

The frontend needs one build-time setting, `VITE_CATALOGUE_API_URL` (see `Frontend/.env.example`).

### The production profile

With `SPRING_PROFILES_ACTIVE=production` the backend refuses to start unless:

- the database URL names a remote host, the `brightbuy` database, and ends with `?sslMode=VERIFY_IDENTITY`;
- the database account is not `root` and has a password;
- session cookies are HTTPS-only;
- every allowed origin is an explicit `https://` address.

### The first administrator

Employees cannot register themselves, and the sample employees cannot sign in. On a new
system set the two bootstrap variables (password of 12 to 72 characters), start the
backend once, sign in as that administrator, then remove both variables. The account is
created only if no employee has that email, so a restart never changes an existing one.
The administrator creates all other employees on the *Admin* page.

## Database account

The backend must not connect as `root` or as the server administrator (SEC-7). Create
one account and grant it only the application role:

```sql
CREATE USER 'brightbuy_app'@'%' IDENTIFIED BY '<private password>';
GRANT 'brightbuy_application' TO 'brightbuy_app'@'%';
SET DEFAULT ROLE 'brightbuy_application' TO 'brightbuy_app'@'%';
```

Keep the database server off the public internet: allow connections from the backend
host only (SEC-10).

## Deployment

1. A pull request to `main` needs one approving review and a passing
   *Integrated project verification* run (`scripts/verify-project.sh`).
2. When `main` passes that verification after the merge, the *Deploy Backend to Azure*
   workflow builds the image from `Backend/Dockerfile` and deploys that exact commit.

Because the backend deploys automatically, **upgrade the shared database just before merging
a change that needs new tables, columns or procedures.** The upgrade keeps every row, but it
replaces stored procedures, so between the upgrade and the arrival of the new backend
(a few minutes) actions whose procedure changed can fail on the old backend. Do both
steps together at a quiet time. The backend's settings do not change between releases.

## Upgrading the shared database

Do this from a computer that is allowed to reach the server, with an administrator account.

1. Take a backup and check that it restores (next section).
2. Run the upgrade. Type the password when asked; it is not stored anywhere:

   ```bash
   read -rs MYSQL_PWD && export MYSQL_PWD
   ```

   ```bash
   MYSQL_HOST=your-server.mysql.database.azure.com MYSQL_USER=your_admin BRIGHTBUY_BACKUP_TAKEN=yes bash Database/install_all.sh --upgrade --remote
   ```

3. The script ends with `Upgrade complete ... all release checks passed`. If it prints a
   `BLOCK` line instead, nothing destructive has happened: fix what the line names and run
   it again. Running it twice is safe.
4. Close the terminal, or run `unset MYSQL_PWD`.

The upgrade adds missing columns, indexes and constraints, renames the old
`catalogue_audit` table to `audit_log`, replaces every routine and trigger, and refreshes
the roles. It also moves all stock to one central warehouse: every variant is assigned to
the first warehouse, which is renamed *Central Warehouse*, and the other warehouse rows,
now holding nothing, are removed. It loads no sample data, changes no price or quantity, and
deletes no customer, order, product or stock row. It was tested by installing the previous
release, placing an order, upgrading, and running every test suite on the result.

## Backup and restore (SAF-4, SAF-5)

**Backup** with `mysqldump`, including routines and triggers:

```bash
mysqldump --host=HOST --user=ADMIN -p --single-transaction --routines --triggers --events --no-tablespaces brightbuy > brightbuy-$(date +%F).sql
```

`--single-transaction` gives a consistent copy without blocking orders. The file contains
customer data and password hashes: keep it private and never put it in the repository.

**Restore** into an empty database:

```bash
mysql --host=HOST --user=ADMIN -p -e "CREATE DATABASE brightbuy_restore CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci"
```

```bash
mysql --host=HOST --user=ADMIN -p brightbuy_restore < brightbuy-2026-10-10.sql
```

Then run the release checks against the restored copy and compare a few totals
(orders, order lines, stock) with the original:

```bash
mysql --host=HOST --user=ADMIN -p brightbuy_restore < Database/Shared/05_release_checks.sql
```

`scripts/verify-project.sh` performs this round trip on every run: it dumps the test
database, restores it under another name, compares table, routine and trigger counts and
the order and stock totals, and calls a stored procedure in the restored copy.

**Schedule.** The requirement is a full backup every day and log backups every hour.
On Azure Database for MySQL, automated backups with point-in-time restore cover both;
set the retention period in the server's *Backup* settings. On a self-managed server,
run the `mysqldump` command daily from a scheduler and keep the binary logs.

## Secrets

- Passwords and keys live in environment variables or the hosting platform's settings,
  never in a file that git tracks. `.gitignore` excludes every `.env` file except the templates.
- **If a secret is ever committed, change it at once.** Deleting the file or the line is
  not enough, because the old value stays in the git history. An earlier commit of this
  repository contained the shared database's administrator password; that password must be
  replaced on the server, and the backend's own account switched to `brightbuy_app` as above.
- Card numbers, security codes and passwords are never written to a table or a log.
  Password reset codes are stored as SHA-256 hashes and removed from the queued email
  once used.

## Simulated services

| Service | Now | To make it real |
|---|---|---|
| Card payments | `SimulatedPaymentGateway` approves three test card numbers and declines the rest | Write another `PaymentGateway` implementation for the chosen provider and select it with `BRIGHTBUY_PAYMENT_GATEWAY` |
| Email | `SimulatedEmailSender` marks queued messages as sent; they stay readable in `email_outbox` | Replace it with an `EmailSender` that hands the message to an SMTP relay |

Neither change touches the database or the checkout procedure.
