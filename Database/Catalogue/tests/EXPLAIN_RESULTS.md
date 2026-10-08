# Catalogue index evidence

Output of [`10_catalogue_explain.sql`](../10_catalogue_explain.sql), recorded on
2026-10-08 against an isolated MySQL **9.7.1** instance holding the standard
fixtures (40 products, 10 categories, 80 assignments, 48 variants) after
`ANALYZE TABLE`. It has not been rerun on the team's MySQL 8.0 server; rerun
the script there before quoting these plans for the deployed system.

To reproduce, from `Database/Catalogue`:

```sh
mysql -u <user> -p --table brightbuy < 10_catalogue_explain.sql
```

## Results

| Query | Table | type | key used | ref | rows | Extra |
|---|---|---|---|---|---|---|
| Q1 SKU lookup | product | const | uq_product_sku | const | 1 | |
| Q2 Active name prefix | product | range | idx_product_active_name | | 7 | Using where; Using index |
| Q3 Keyword search | product | fulltext | idx_product_search | const | 1 | Using where; Ft_hints: sorted |
| Q4 Products in a category | pc | ref | idx_product_category_category | const | 7 | Using index |
| | p | eq_ref | PRIMARY | pc.product_id | 1 | Using where |
| Q5 Categories of a product | pc | ref | PRIMARY | const | 2 | Using index |
| | c | eq_ref | PRIMARY | pc.category_id | 1 | |
| Q6 Child categories | category | ref | idx_category_parent | const | 3 | |
| Q7 Variants of a product | variant | ref | fk_variant_product | const | 3 | |
| Q8 Product detail path | p | const | PRIMARY | const | 1 | |
| | v | ref | fk_variant_product | const | 3 | Using where |

No query reads a table with `type = ALL`. Every foreign-key column used by the
catalogue (`category.parent_category_id`, `product_category.product_id`,
`product_category.category_id`, `variant.product_id`) is the leading column of
an index, as CON-6 requires.

## Known limit: keyword search inside `sp_catalogue_search`

Q3 shows the FULLTEXT index working for a plain `MATCH ... AGAINST`. The search
procedure also accepts substring and SKU matches, so its predicate is
`MATCH(...) OR LOCATE(...) OR LOCATE(...)`. MySQL cannot serve that `OR` from
the FULLTEXT index alone; the same check on these fixtures reported
`type = ALL, rows = 40` on `product`.

That is a deliberate trade for partial-word and SKU matching and is cheap at
40 products. It has not been measured at the SRS scalability target of 10,000
products. If keyword search misses PER-3 at that size, drop the `LOCATE`
branches or move them behind a second, explicit "contains" search.

## Indexes present

| Table | Index | Columns | Kind |
|---|---|---|---|
| category | PRIMARY | category_id | unique B-tree |
| category | uq_category_name | name | unique B-tree |
| category | idx_category_parent | parent_category_id | B-tree |
| product | PRIMARY | product_id | unique B-tree |
| product | uq_product_sku | sku | unique B-tree |
| product | idx_product_name | name | B-tree |
| product | idx_product_active_name | is_active, name | B-tree |
| product | idx_product_search | name, description | FULLTEXT |
| product_category | PRIMARY | product_id, category_id | unique B-tree |
| product_category | idx_product_category_category | category_id, product_id | B-tree |
| variant (inventory-owned) | fk_variant_product | product_id | B-tree |
