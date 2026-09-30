# User & Auth Module (Database Part)

This file explains my part of the BrightBuy project in simple English.

---

## 1. What is my part?

My part handles **people** in the system:

- **Customers**: people who register and buy things.
- **Employees**: staff who work inside the system (warehouse staff, management, admin).

My database part does these jobs:

1. Stores customer and employee accounts.
2. Makes sure no two accounts use the same email (unique constraint).
3. Makes sure employees only have allowed roles.
4. Stores passwords safely (only hashed, never plain text).
5. Helps the app log people in.
6. Records failed login attempts so we can block people who keep guessing passwords.

---

## 2. Files in my folder

| File | What it does |
|------|--------------|
| `01_user_auth_schema.sql` | Creates the tables, constraints and indexes |
| `02_user_auth_procedures.sql` | Creates the stored procedures and functions |
| `03_user_auth_seed.sql` | Adds sample customers and employees |
| `04_user_auth_tests.sql` | Tests that everything works and that rules are enforced |

---

## 3. The tables

### `customer`
Stores people who can buy products.

| Column | Meaning |
|--------|---------|
| `customer_id` | Unique number for each customer (auto increases) |
| `first_name`, `last_name` | Name |
| `email` | Login email. **Must be unique** and must look like a real email |
| `password_hash` | The scrambled (hashed) password. The real password is never saved |
| `phone` | Contact number |
| `address_line` | Street address |
| `city_id` | The customer's city. Links to the `city` table |
| `created_at` | When the account was made (UTC time) |

### `employee`
Stores staff accounts.

| Column | Meaning |
|--------|---------|
| `employee_id` | Unique number for each employee |
| `first_name`, `last_name` | Name |
| `email` | Login email. **Must be unique** |
| `password_hash` | Hashed password |
| `contact_no` | Contact number |
| `role` | Must be one of: `WarehouseStaff`, `Management`, `Admin` |
| `is_active` | If FALSE, the employee can no longer log in |

### `login_attempts`
A small log of every login try.

| Column | Meaning |
|--------|---------|
| `attempt_id` | Unique number |
| `email` | The email that was used |
| `user_type` | `customer` or `employee` |
| `was_success` | TRUE if the login worked, FALSE if it failed |
| `attempted_at` | When it happened |

---

## 4. Rules the database enforces (constraints)

| Rule | How it is done | Why |
|------|----------------|-----|
| No two customers with the same email | `UNIQUE` on `customer.email` | Stops duplicate accounts |
| No two employees with the same email | `UNIQUE` on `employee.email` | Same reason |
| Email must look valid | `CHECK` on the email format | Stops junk like "abc" |
| Employee role must be valid | `CHECK (role IN (...))` | Stops roles like "Cashier" that do not exist |
| Customer city must exist | Foreign key to `city` | No customer with a fake city |
| Cities cannot be deleted while customers use them | `ON DELETE RESTRICT` | Protects data |
| Fast searching | Indexes on `city_id`, `role`, and `(email, attempted_at)` | Faster queries |

---

## 5. Stored procedures and functions

### Procedures (actions)

| Name | What it does |
|------|--------------|
| `sp_register_customer` | Creates a new customer. If the email is already used, it stops with the message "Email already registered" |
| `sp_create_employee` | Creates a new employee (used by Admin). Also blocks duplicate emails and bad roles |
| `sp_get_customer_login` | Gives the app the customer's id and password hash so the app can check the password |
| `sp_get_employee_login` | Same for employees, plus their role. Inactive employees are not returned |
| `sp_log_login` | Saves a login try (success or fail) |

### Functions (answers)

| Name | What it returns |
|------|-----------------|
| `fn_recent_failures(email)` | How many failed logins this email had in the last 15 minutes |
| `fn_employee_has_role(employee_id, role)` | 1 if the employee has that role and is active, otherwise 0 |

---

## 6. How login works (step by step)

1. The user types email and password on the website.
2. The app calls `fn_recent_failures(email)`. If the number is 5 or more, the app refuses the login for now.
3. The app calls `sp_get_customer_login` (or `sp_get_employee_login`) to get the saved hash.
4. **The app compares** the typed password with the hash using bcrypt. (The database does not do this part.)
5. The app calls `sp_log_login` to record success or failure.
6. If it worked, the app starts a session. If not, it shows a **generic** message like "Invalid email or password". It must never say which one was wrong.

---

## 7. How registration works

1. The user fills the register form.
2. The app hashes the password with bcrypt.
3. The app calls `sp_register_customer` with the hash (never the plain password).
4. The database saves the customer, or says "Email already registered".

---

## 8. How other team members use my part

| Teammate | What they use |
|----------|---------------|
| Checkout (`orders`) | `orders.customer_id` links to `customer.customer_id` |
| Management reports | `report_access_log.employee_id` links to `employee.employee_id`. They can also call `fn_employee_has_role(id, 'Management')` to make sure only managers can run reports |
| Inventory | Can call `fn_employee_has_role(id, 'WarehouseStaff')` to make sure only warehouse staff change stock |

---

## 9. Run order (important!)

Run the scripts in this order to avoid foreign key errors:

1. `city` table (from Inventory)
2. My files `01`, `02`, `03`
3. Checkout scripts
4. Inventory scripts
5. Management report scripts
6. My `04_user_auth_tests.sql` last

**Why?** `orders` needs `customer` to exist, and `report_access_log` needs `employee` to exist.

---

## 10. Testing

Run `04_user_auth_tests.sql`. It checks:

- A new customer can register.
- A duplicate email is rejected.
- A bad email format is rejected.
- A fake city is rejected.
- A wrong employee role is rejected.
- Login lookups return the right data.
- Five failed logins are counted correctly.
- The role-check function gives correct answers.

Lines marked **MUST FAIL** are supposed to give an error. That means the rule is working.

---

## 11. Project requirements this covers

| Requirement | Covered by |
|-------------|------------|
| SEC-1: passwords stored as salted hashes only | `password_hash` column, app uses bcrypt |
| SEC-4 / CON-9: no SQL injection | Access through stored procedures |
| SEC-5: role-based access control | `employee.role` and `fn_employee_has_role` |
| SEC-7: least-privilege DB accounts | App account only gets `EXECUTE` permission |
| SEC-8: generic login errors and rate limiting | `login_attempts` and `fn_recent_failures` |
| BR-1: only registered customers can order | `orders.customer_id` must exist in `customer` |
| BR-14 / BR-15: role restrictions | `fn_employee_has_role` |
| CON-2: integrity through keys | Primary keys, foreign keys, unique constraints |
| CON-6: indexes | Indexes on foreign keys and lookup columns |

---

## 12. Things to remember

- The password hashes in the seed file are **fake placeholders**. Real logins need real bcrypt hashes made by the app.
- The 30-minute session timeout (SEC-9) is handled by the app, not the database.
- Guests do not need a database account. Their cart stays in the browser session.