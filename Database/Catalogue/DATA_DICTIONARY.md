# Catalogue data dictionary

Covers the three catalogue-owned tables (SRS DB-4). Generated from
`information_schema` on 2026-10-08 after installing `01`, `02` and `05` on an
isolated MySQL 9.7.1 instance. All three tables use InnoDB and
`utf8mb4_unicode_ci` (DB-7). `TIMESTAMP` columns are stored in UTC and shown in
the session time zone (DB-6). The catalogue holds no monetary columns: price
lives on the inventory-owned `variant` table as `DECIMAL(10,2)` (DB-5).

## category

A browsing category. Two levels only: a root, or a child of a root (AS-1).

| Column | Type | Null | Default | Description |
|---|---|---|---|---|
| category_id | INT, auto-increment | No | | Primary key. |
| parent_category_id | INT | Yes | NULL | Parent root category; NULL for a root. |
| name | VARCHAR(100) | No | | Display name, unique across all categories. |
| description | VARCHAR(500) | Yes | NULL | Optional description. |
| is_active | BOOLEAN | No | TRUE | FALSE hides the category, and its children, from the storefront. |
| created_at | TIMESTAMP | No | CURRENT_TIMESTAMP | Row creation time. |
| updated_at | TIMESTAMP | No | CURRENT_TIMESTAMP, refreshed on update | Last change time. |

| Constraint | Definition |
|---|---|
| pk_category | PRIMARY KEY (category_id) |
| uq_category_name | UNIQUE (name) |
| fk_category_parent | parent_category_id → category(category_id), ON UPDATE RESTRICT, ON DELETE RESTRICT |
| trg_category_two_levels_insert | Rejects a parent that itself has a parent. |
| trg_category_not_own_parent_insert | Rejects a category that is its own parent. |
| trg_category_two_levels_update | Same two rules on update; also rejects moving a category that has children under another. |

Indexes: PRIMARY (category_id), uq_category_name (name), idx_category_parent (parent_category_id).

## product

Information shared by all variants of one product. Price and stock are on
`variant` (BR-4). SKU is assigned here, at product level (AS-4, BR-5).

| Column | Type | Null | Default | Description |
|---|---|---|---|---|
| product_id | INT, auto-increment | No | | Primary key. |
| sku | VARCHAR(50) | No | | Stock Keeping Unit, unique across the warehouse. |
| name | VARCHAR(150) | No | | Display name. |
| description | TEXT | Yes | NULL | Optional long description. |
| image_url | VARCHAR(500) | Yes | NULL | Optional image location; NULL shows the placeholder. |
| is_active | BOOLEAN | No | TRUE | FALSE retires the product from the storefront without deleting it. |
| created_at | TIMESTAMP | No | CURRENT_TIMESTAMP | Row creation time; drives the "newest" sort. |
| updated_at | TIMESTAMP | No | CURRENT_TIMESTAMP, refreshed on update | Last change time. |

| Constraint | Definition |
|---|---|
| pk_product | PRIMARY KEY (product_id) |
| uq_product_sku | UNIQUE (sku) |

Indexes: PRIMARY (product_id), uq_product_sku (sku), idx_product_name (name),
idx_product_active_name (is_active, name), idx_product_search FULLTEXT (name, description).

## product_category

Junction table for the many-to-many link between products and categories
(AS-2, BR-2). The composite key stops the same pair being stored twice.

| Column | Type | Null | Default | Description |
|---|---|---|---|---|
| product_id | INT | No | | Product being filed. |
| category_id | INT | No | | Category it is filed under. |
| assigned_at | TIMESTAMP | No | CURRENT_TIMESTAMP | When the assignment was made. |

| Constraint | Definition |
|---|---|
| pk_product_category | PRIMARY KEY (product_id, category_id) |
| fk_product_category_product | product_id → product(product_id), ON UPDATE CASCADE, ON DELETE CASCADE |
| fk_product_category_category | category_id → category(category_id), ON UPDATE CASCADE, ON DELETE RESTRICT |

Indexes: PRIMARY (product_id, category_id), idx_product_category_category (category_id, product_id).

## Link to the inventory-owned variant table

`05_variant_integration.sql` makes `variant.product_id` NOT NULL and adds:

| Constraint | Definition |
|---|---|
| fk_variant_product | variant.product_id → product(product_id), ON UPDATE CASCADE, ON DELETE RESTRICT |

### Documented deviation from SRS 2.5.2

Section 2.5.2 lists `Variants` among the structural mappings that should use
`ON DELETE CASCADE`. This foreign key uses `ON DELETE RESTRICT` instead.
`order_item` references `variant` with `ON DELETE RESTRICT`, so a cascading
product delete would either fail part-way or, if that rule were ever relaxed,
remove variants that historical orders point to. `RESTRICT` makes the outcome
the same in both cases and satisfies SAF-6 and BR-18: a product that has
variants cannot be deleted, only retired with `is_active = FALSE`.

## Normalisation (DB-1)

Each table is in 3NF: every non-key column depends on the whole primary key
and on nothing else. Category names are not repeated on products, and product
facts are not repeated on variants. The catalogue stores no derived or
denormalised columns; product counts and price ranges are computed by the read
procedures.

## Differences from the SRS Appendix B diagram

| SRS diagram | Implemented | Reason |
|---|---|---|
| `Products`, `Categories`, `Product_Categories` | `product`, `category`, `product_category` | Team naming convention: lowercase singular, safe on case-sensitive servers. |
| `Category_Name` | `name` | Matches the column the reporting procedures join on. |
| No category hierarchy shown | `parent_category_id` | Required by AS-1. |
| No activation flag | `is_active` on product and category | Retire without deleting (BR-18). |
| `Variants.Is_Default` | Not present | A single-variant product is simply a product with one variant row (AS-3). |
