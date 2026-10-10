# BrightBuy data dictionary

Every table and column of the `brightbuy` database (MySQL 8.0), generated from an installed schema. Amounts are in USD. "Key" shows PK for the primary key, FK for a foreign key with the table it points to, and UQ for a unique column. The scripts that create each table are listed in [README.md](README.md).

## Catalogue

Module owner: Mihisara LHK

### category

A product category. Two levels at most: a root category and its children. Unique `name`; a parent must be a root category and a category cannot be its own parent (triggers).

| Column | Type | Required | Key | Default | Meaning |
|---|---|---|---|---|---|
| `category_id` | int | yes | PK | auto | Identifier |
| `parent_category_id` | int | no | FK category |  | The root category this one belongs to; empty for a root category |
| `name` | varchar(100) | yes | UQ |  | Category name, unique |
| `description` | varchar(500) | no |  |  | Optional text shown with the category |
| `is_active` | tinyint(1) | yes |  | 1 | 0 hides the category from customers |
| `created_at` | timestamp | yes |  | now | When the row was created |
| `updated_at` | timestamp | yes |  | now | When the row was last changed |

### product

A product as shown in the catalogue. Prices and stock live on its variants. Unique `sku`; full-text index on name and description; products are retired with `is_active`, never deleted.

| Column | Type | Required | Key | Default | Meaning |
|---|---|---|---|---|---|
| `product_id` | int | yes | PK | auto | Identifier |
| `sku` | varchar(50) | yes | UQ |  | Stock keeping unit, unique |
| `name` | varchar(150) | yes |  |  | Product name |
| `description` | text | no |  |  | Optional description |
| `image_url` | varchar(500) | no |  |  | Optional HTTPS address of the product image |
| `is_active` | tinyint(1) | yes |  | 1 | 0 retires the product: hidden from customers, kept for old orders |
| `created_at` | timestamp | yes |  | now | When the row was created |
| `updated_at` | timestamp | yes |  | now | When the row was last changed |

### product_category

Which categories a product belongs to (many to many, BR-2). Primary key (product_id, category_id); a product always keeps at least one category (procedures).

| Column | Type | Required | Key | Default | Meaning |
|---|---|---|---|---|---|
| `product_id` | int | yes | PK, FK product |  | The product |
| `category_id` | int | yes | PK, FK category |  | One of its categories |
| `assigned_at` | timestamp | yes |  | now | When the product was put in the category |

## Inventory and delivery

Module owner: Nirmal U.K.N

### city

A delivery destination. Main cities are delivered in 5 days, others in 7 (BR-8).

| Column | Type | Required | Key | Default | Meaning |
|---|---|---|---|---|---|
| `city_id` | int | yes | PK | auto | Identifier |
| `name` | varchar(100) | no |  |  | City name |
| `is_main_city` | tinyint(1) | no |  |  | 1 for a main city (5-day delivery), 0 otherwise (7-day delivery) |

### warehouse

The central warehouse, where all stock is kept. One row.

| Column | Type | Required | Key | Default | Meaning |
|---|---|---|---|---|---|
| `warehouse_id` | int | yes | PK | auto | Identifier |
| `name` | varchar(100) | no |  |  | Warehouse name |
| `location` | varchar(255) | no |  |  | Address or area |

### variant

One sellable version of a product (colour, memory size) with its price and stock. CHECK price >= 0 and stock_quantity >= 0 (SAF-2); every variant belongs to a product (ON DELETE RESTRICT).

| Column | Type | Required | Key | Default | Meaning |
|---|---|---|---|---|---|
| `variant_id` | int | yes | PK | auto | Identifier |
| `product_id` | int | yes | FK product |  | The product this is a version of |
| `warehouse_id` | int | no | FK warehouse |  | The central warehouse |
| `variant_name` | varchar(100) | no |  |  | Display name, for example "Galaxy S24 - Black 256GB" |
| `colour` | varchar(50) | no |  |  | Colour, when it applies |
| `memory_size` | varchar(50) | no |  |  | Memory size, when it applies |
| `price` | decimal(10,2) | yes |  |  | Current price of one unit (USD) |
| `stock_quantity` | int | yes |  |  | Units in the warehouse; never negative. An order for more than this is back-ordered |

### variant_audit

One row for every change of a variant's stock quantity (SAF-7). Written only by the triggers on `variant`.

| Column | Type | Required | Key | Default | Meaning |
|---|---|---|---|---|---|
| `audit_id` | int | yes | PK | auto | Identifier |
| `variant_id` | int | no | FK variant |  | The variant whose stock changed |
| `old_stock_quantity` | int | no |  |  | Stock before; empty for a new variant |
| `new_stock_quantity` | int | no |  |  | Stock after |
| `changed_by` | varchar(100) | no |  |  | Who changed it: 'employee:ID' for a stock update, 'customer:ID' for a sale |
| `changed_at` | timestamp | no |  | now | When it changed |

## User and authentication

Module owner: Atapattu D.M.

### customer

A registered customer and the default delivery address. Unique `email`; CHECK on the email format.

| Column | Type | Required | Key | Default | Meaning |
|---|---|---|---|---|---|
| `customer_id` | int | yes | PK | auto | Identifier |
| `first_name` | varchar(100) | yes |  |  | First name |
| `last_name` | varchar(100) | yes |  |  | Last name |
| `email` | varchar(150) | yes | UQ |  | Sign-in name, unique, stored in lower case |
| `password_hash` | varchar(255) | yes |  |  | BCrypt hash of the password (SEC-1); never the password |
| `phone` | varchar(20) | no |  |  | Optional contact number |
| `address_line` | varchar(255) | no |  |  | Default delivery address (UI-6) |
| `city_id` | int | no | FK city |  | City of the default address |
| `created_at` | datetime | yes |  | now (UTC) | Registration time (UTC) |

### employee

A staff account. The role decides what it may do (BR-14, BR-15). Unique `email`; CHECK role is WarehouseStaff, Management or Admin; accounts are disabled with `is_active`.

| Column | Type | Required | Key | Default | Meaning |
|---|---|---|---|---|---|
| `employee_id` | int | yes | PK | auto | Identifier |
| `first_name` | varchar(100) | yes |  |  | First name |
| `last_name` | varchar(100) | yes |  |  | Last name |
| `email` | varchar(150) | yes | UQ |  | Sign-in name, unique |
| `password_hash` | varchar(255) | yes |  |  | BCrypt hash of the password (SEC-1) |
| `contact_no` | varchar(20) | no |  |  | Optional contact number |
| `role` | varchar(30) | yes |  |  | WarehouseStaff, Management or Admin |
| `is_active` | tinyint(1) | yes |  | 1 | 0 disables the account immediately, including open sessions |

### login_attempts

Every sign-in attempt, used for the rate limit and as the access log (SEC-11). CHECK user_type is customer or employee.

| Column | Type | Required | Key | Default | Meaning |
|---|---|---|---|---|---|
| `attempt_id` | bigint | yes | PK | auto | Identifier |
| `email` | varchar(150) | yes |  |  | The email that was tried |
| `user_type` | varchar(10) | yes |  |  | customer or employee |
| `was_success` | tinyint(1) | yes |  |  | 1 for a successful sign-in |
| `attempted_at` | datetime | yes |  | now (UTC) | When it happened (UTC) |

### password_reset_token

A one-time password reset code, stored only as a hash (UI-7). Unique `token_hash`; CHECK exactly one of customer_id and employee_id is set.

| Column | Type | Required | Key | Default | Meaning |
|---|---|---|---|---|---|
| `token_id` | bigint | yes | PK | auto | Identifier |
| `customer_id` | int | no | FK customer |  | The customer account, when it is a customer reset |
| `employee_id` | int | no | FK employee |  | The employee account, when it is an employee reset |
| `token_hash` | char(64) | yes | UQ |  | SHA-256 hash of the emailed code |
| `created_at` | datetime | yes |  | now (UTC) | When the code was issued (UTC) |
| `expires_at` | datetime | yes |  |  | 30 minutes after it was issued (UTC) |
| `used_at` | datetime | no |  |  | When it was used or cancelled; empty while it is valid |

## Cart and checkout

Module owner: Adeesha W.G.I.

### orders

One confirmed order of one customer. CHECK total_amount >= 0.

| Column | Type | Required | Key | Default | Meaning |
|---|---|---|---|---|---|
| `order_id` | int | yes | PK | auto | Identifier |
| `customer_id` | int | yes | FK customer |  | The customer who placed it |
| `order_date` | datetime | yes |  |  | When it was confirmed |
| `order_status` | varchar(50) | yes |  |  | Confirmed when it is placed; Cancelled if it is cancelled |
| `total_amount` | decimal(10,2) | yes |  |  | Sum of the lines at purchase-time prices (USD) |
| `delivery_mode` | varchar(50) | no |  |  | 'delivery' or 'pickup' (kept here for the reports) |
| `payment_method` | varchar(50) | no |  |  | 'cod' or 'card' (kept here for the reports) |

### order_item

One line of an order: a variant, a quantity and the price paid (BR-13). Primary key (order_id, variant_id); CHECK quantity > 0, unit_price >= 0, and backordered_quantity between 0 and quantity.

| Column | Type | Required | Key | Default | Meaning |
|---|---|---|---|---|---|
| `order_id` | int | yes | PK, FK orders |  | The order |
| `variant_id` | int | yes | PK, FK variant |  | The variant bought |
| `quantity` | int | yes |  |  | Units bought |
| `unit_price` | decimal(10,2) | yes |  |  | Price of one unit when the order was placed (USD) |
| `backordered_quantity` | int | yes |  | 0 | Units of this line that were out of stock when the order was placed. They were not taken from stock and follow later |

### delivery

How and where an order is delivered, with the estimate made at purchase time. One row per order (unique `order_id`).

| Column | Type | Required | Key | Default | Meaning |
|---|---|---|---|---|---|
| `delivery_id` | int | yes | PK | auto | Identifier |
| `order_id` | int | yes | FK orders, UQ |  | The order being delivered |
| `city_id` | int | no | FK city |  | Destination city; empty for store pickup |
| `address_line` | varchar(255) | no |  |  | Delivery address as given at purchase time |
| `delivery_mode` | varchar(50) | no |  |  | 'delivery' or 'pickup' |
| `est_delivery_date` | date | no |  |  | Date estimated when the order was placed (BR-8); empty for pickup |
| `delivery_status` | varchar(50) | no |  |  | Pending when the order is placed; Cancelled if it is cancelled |

### payment

The payment of an order. Card numbers are never stored (CON-5, SEC-2). One row per order; CHECK a card payment has token, reference, type and last four digits and a cash payment has none.

| Column | Type | Required | Key | Default | Meaning |
|---|---|---|---|---|---|
| `payment_id` | int | yes | PK | auto | Identifier |
| `order_id` | int | yes | FK orders, UQ |  | The order paid for |
| `payment_method` | varchar(50) | no |  |  | 'cod' or 'card' |
| `payment_status` | varchar(50) | no |  |  | Pending (cash on delivery), Paid (card) or Cancelled |
| `amount` | decimal(10,2) | no |  |  | Amount to pay or paid (USD) |
| `payment_date` | datetime | no |  |  | When the payment was recorded |
| `gateway_token` | varchar(64) | no |  |  | Token the payment gateway gave for the card; not a card number |
| `gateway_reference` | varchar(64) | no |  |  | The gateway's reference for the authorisation |
| `card_last_four` | char(4) | no |  |  | Last four digits of the card, for display |
| `card_type` | varchar(20) | no |  |  | Visa, Mastercard or American Express |

## Management reporting

Module owner: Senadheera S.D.A.P

### sales_summary

Sales per variant and day, rebuilt every night for the last 7 days. Derived data: it can always be recomputed from orders and order_item. Unique (variant_id, summary_date). The five report procedures read the live order tables and do not read this table at present.

| Column | Type | Required | Key | Default | Meaning |
|---|---|---|---|---|---|
| `summary_id` | int | yes | PK | auto | Identifier |
| `variant_id` | int | yes | FK variant |  | The variant sold |
| `summary_date` | date | yes |  |  | The day |
| `units_sold` | int | yes |  | 0 | Units sold that day |
| `total_revenue` | decimal(12,2) | yes |  | 0.00 | Revenue that day (USD) |
| `order_count` | int | yes |  | 0 | Orders containing the variant that day |

### report_access_log

Who ran which report and when (SEC-11).

| Column | Type | Required | Key | Default | Meaning |
|---|---|---|---|---|---|
| `log_id` | int | yes | PK | auto | Identifier |
| `employee_id` | int | yes | FK employee |  | The signed-in employee who ran the report |
| `report_name` | varchar(100) | yes |  |  | Which report |
| `accessed_at` | datetime | yes |  | now | When it was run |

## Shared

Module owner: whole team

### email_outbox

Emails waiting to be sent or already sent: registration, order confirmation, password reset (SRS 3.3.3). CHECK category and status values.

| Column | Type | Required | Key | Default | Meaning |
|---|---|---|---|---|---|
| `email_id` | bigint | yes | PK | auto | Identifier |
| `recipient` | varchar(150) | yes |  |  | Email address |
| `category` | varchar(30) | yes |  |  | registration, order_confirmation or password_reset |
| `subject` | varchar(200) | yes |  |  | Subject line |
| `body` | text | yes |  |  | Message text; a used reset code is removed from it |
| `related_id` | int | no |  |  | The order, customer or employee the message is about |
| `status` | varchar(10) | yes |  | Pending | Pending, Sent or Failed |
| `created_at` | datetime | yes |  | now (UTC) | When it was queued (UTC) |
| `sent_at` | datetime | no |  |  | When the email service accepted it (UTC) |

### audit_log

Who changed which catalogue, variant or employee record, with the values before and after (SEC-11). Written only by triggers. Password hashes are never copied here.

| Column | Type | Required | Key | Default | Meaning |
|---|---|---|---|---|---|
| `audit_id` | bigint | yes | PK | auto | Identifier |
| `entity_type` | varchar(30) | yes |  |  | product, category, product_category, variant or employee |
| `entity_id` | int | yes |  |  | Identifier of the changed row |
| `action` | varchar(10) | yes |  |  | INSERT, UPDATE or DELETE |
| `actor` | varchar(100) | yes |  |  | Who made the change: 'employee:ID', 'customer:ID', 'bootstrap', or the MySQL account |
| `changed_at` | timestamp | yes |  | now | When the change was made |
| `old_values` | json | no |  |  | Values before the change (JSON); empty for an insert |
| `new_values` | json | no |  |  | Values after the change (JSON); empty for a delete |

## View

### catalogue_public_variants

The variants customers may see: every column of `variant`, limited to variants of active products with a valid price and stock quantity. The storefront procedures read this view, so a retired product can never appear in a search or be added to a cart.
