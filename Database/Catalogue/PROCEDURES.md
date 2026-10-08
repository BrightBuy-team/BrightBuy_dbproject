# Catalogue procedure contract

Install `06_catalogue_procedures.sql` after the catalogue and inventory schema
and indexes. All three routines use `SQL SECURITY INVOKER` and return one JSON
value via an OUT parameter. They do not emit result sets themselves; examples
below SELECT the OUT variable for display. The backend should use parameterized
JDBC calls, read the OUT value and parse the JSON. Do not interpolate user input
into SQL. Calling accounts need EXECUTE and the SELECT privileges used by the
routines and their invoker-security view.

The routines read data without committing or starting a transaction. Installing
or reinstalling their definitions is DDL and commits independently. JSON number
prices use the stored currency units; this schema does not define a currency.
Checkout must revalidate stock and price in its own transaction.

## Search and browse

```sql
CALL sp_catalogue_search(
    NULL,       -- keyword: NULL/blank = no search; max 255 trimmed characters
    NULL,       -- category_id: NULL = all; otherwise positive ID
    NULL, NULL, -- minimum/maximum price: inclusive, optional and nonnegative
    0,          -- in_stock_only: 0 or 1 (required)
    'name_asc', -- sort: name_asc/name_desc/price_asc/price_desc/newest
    1, 12,      -- page: 1..1000000; page_size: 1..100 (required)
    @products
);
SELECT JSON_PRETTY(@products);
```

Response fields: `page`, `page_size`, `sort`, `total_products`, `total_pages`,
and `items`. Every item has `product_id`, `sku`, `name`, `image_url`,
`min_price`, `max_price`, `matching_variant_count`, `matching_stock_quantity`.
An empty result uses `items: []` and `total_pages: 0`. An out-of-range page
returns an empty array but preserves the total matching count.

Results contain one row per active product with at least one valid matching
variant. Prices, counts and stock sums describe only variants that satisfy
**both** the price and stock filters. Price sorting uses the lowest matching
price in either direction. Name and newest sorting use product name and
creation time respectively. Every sort uses product ID ascending to break ties.
The JSON array order matches the requested sort. NULL/blank sort defaults to
`name_asc`; surrounding spaces and case in sort values are normalized.

Keyword search combines natural-language full-text matches on name/description
with literal substring matches on name, description and SKU. This includes
partial and short terms that full-text indexing may omit. Matching follows the
database's case-insensitive collation. `%` and `_` are ordinary characters,
not wildcard operators. Multiword full-text search can match any indexed term;
it is not an exact phrase or exact SKU lookup. For example, `IPHONE-15-PRO` can
also match a laptop containing the word `Pro`. Literal substring fallback may
scan rows; this is acceptable for the demonstration dataset but should be
profiled before scaling up.

A child category selects its active assignments. A root category selects
direct assignments plus assignments to active children, without duplicate
products. Inactive categories or children of inactive roots cannot be browsed;
unknown category IDs return an empty page. A product's own `is_active` controls
its visibility in unfiltered search and detail, independently of category
activation. Thus disabling a category does not disable its products globally.

Page items and totals come from the same SQL statement. Separate requests use
live data: concurrent inserts/renames or stock changes may shift later offset
pages. Pagination is deterministic for unchanged data, not a saved snapshot
across requests.

## Categories

```sql
CALL sp_catalogue_categories(@categories);
SELECT JSON_PRETTY(@categories);
```

Returns `items` containing `category_id`, `parent_category_id`, `name`,
`description` and `product_count`. Roots come first, then child categories;
each group is ordered by name and ID. Counts follow the same category and
product eligibility rules as unfiltered category browsing and count a product
once even if it has several variants or both root and child assignments.
Active empty categories remain present with a count of zero.

## Product detail

```sql
CALL sp_catalogue_product_detail(1, @product);
SELECT JSON_PRETTY(@product);
```

Returns `product_id`, `sku`, `name`, `description`, `image_url`, `categories`
and `variants`. Categories include only active direct assignments whose parent
is active; roots sort first, then name and ID. Each category contains its ID,
parent ID and name. Each variant contains `variant_id`, `warehouse_id`,
`variant_name`, `colour`, `memory_size`, `price` and `stock_quantity`, sorted by
price then variant ID. Zero-stock variants remain visible for disabled option
controls. Product image URLs may be JSON null; the UI should show a fallback.

The shared view excludes null/negative prices and null/negative stock. Product
detail is unavailable if the product is missing, inactive or has no valid
variant. Zero stock alone does not make a valid product unavailable.

## Maintenance procedures

Installed by `08_catalogue_maintenance_procedures.sql` for warehouse staff
(BR-14). All use `SQL SECURITY INVOKER`. Text inputs are trimmed; a blank
optional value is stored as NULL. Update procedures replace every editable
field, so send the current value for anything that should not change.

| Procedure | Parameters | Effect |
|---|---|---|
| `sp_catalogue_create_category` | name, description, parent_category_id, OUT category_id | Adds a root (NULL parent) or child category. |
| `sp_catalogue_update_category` | category_id, name, description, parent_category_id, is_active | Replaces the category's fields. |
| `sp_catalogue_create_product` | sku, name, description, image_url, category_id, OUT product_id | Adds a product and its first category together. |
| `sp_catalogue_update_product` | product_id, sku, name, description, image_url | Replaces the product's fields. |
| `sp_catalogue_set_product_active` | product_id, is_active | Retires (0) or restores (1) a product. |
| `sp_catalogue_assign_category` | product_id, category_id | Adds an assignment; repeating it changes nothing. |
| `sp_catalogue_unassign_category` | product_id, category_id | Removes an assignment, unless it is the last one. |

Rules: category name 1–100 characters and unique; description up to 500;
SKU 1–50 letters, digits, dots, hyphens or underscores and unique; product name
1–150 characters; image URL up to 500. The category triggers still enforce the
two-level hierarchy. A new product has no variant, so the storefront hides it
until inventory adds one.

`sp_catalogue_create_product` and `sp_catalogue_unassign_category` start and
commit their own transaction and roll back on any error. Do not call them
inside an open transaction: `START TRANSACTION` would commit the caller's
pending work. The other five are single statements and neither start nor
commit a transaction.

```sql
CALL sp_catalogue_create_category('Drones', 'Camera drones', 1, @category_id);
CALL sp_catalogue_create_product('BB-DRONE-MINI', 'BrightBuy Mini Drone',
     'Foldable camera drone', NULL, @category_id, @product_id);
CALL sp_catalogue_assign_category(@product_id, 1);
CALL sp_catalogue_set_product_active(@product_id, 0);
```

Errors: `45000` invalid input or broken rule (third hierarchy level, removing
the last category), `45004` product/category/assignment not found, `23000`
duplicate SKU or category name.

## Error handling

- SQLSTATE `45000`: invalid parameters (map to HTTP 400 in the future API).
- SQLSTATE `45004`: product missing or unavailable (map to HTTP 404).
- Other database errors: treat as server errors and avoid exposing SQL details.

Only consume the OUT response after a successful call. Backend validation must
also reject wrong JSON types, oversized strings, out-of-range numeric values
and unsupported decimal precision before binding typed SQL parameters; MySQL
can reject or coerce values while binding them, before procedure validation.
