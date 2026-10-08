-- BrightBuy catalogue index evidence (SRS CON-6, 2.5.4), MySQL 8.0.19+.
-- Read-only: every statement is an EXPLAIN. FORMAT=TRADITIONAL keeps the output
-- tabular on MySQL 9, whose default is TREE. Run after the full catalogue setup:
--   mysql -u <user> -p --table brightbuy < 10_catalogue_explain.sql
-- Recorded output and how to read it: tests/EXPLAIN_RESULTS.md.
USE brightbuy;

-- Q1 Product lookup by SKU (unique index uq_product_sku).
EXPLAIN FORMAT=TRADITIONAL SELECT product_id, sku, name FROM product WHERE sku = 'IPHONE-15-PRO';

-- Q2 Active products by name prefix (composite index idx_product_active_name).
EXPLAIN FORMAT=TRADITIONAL SELECT product_id, name FROM product
WHERE is_active = TRUE AND name LIKE 'BrightBuy S%' ORDER BY name;

-- Q3 Keyword search (FULLTEXT index idx_product_search).
EXPLAIN FORMAT=TRADITIONAL SELECT product_id, name FROM product
WHERE MATCH(name, description) AGAINST('laptop' IN NATURAL LANGUAGE MODE);

-- Q4 Products in one category (idx_product_category_category, then product PK).
EXPLAIN FORMAT=TRADITIONAL SELECT p.product_id, p.name
FROM product_category pc
JOIN product p ON p.product_id = pc.product_id
WHERE pc.category_id = 4 AND p.is_active = TRUE;

-- Q5 Categories of one product (product_category PK, then category PK).
EXPLAIN FORMAT=TRADITIONAL SELECT c.category_id, c.name
FROM product_category pc
JOIN category c ON c.category_id = pc.category_id
WHERE pc.product_id = 3;

-- Q6 Child categories of a parent (idx_category_parent).
EXPLAIN FORMAT=TRADITIONAL SELECT category_id, name FROM category WHERE parent_category_id = 1;

-- Q7 Variants of one product (index on variant.product_id backing fk_variant_product).
EXPLAIN FORMAT=TRADITIONAL SELECT variant_id, price, stock_quantity FROM variant WHERE product_id = 1;

-- Q8 Product detail read path used by sp_catalogue_product_detail.
EXPLAIN FORMAT=TRADITIONAL SELECT p.product_id, v.variant_id, v.price, v.stock_quantity
FROM product p
JOIN catalogue_public_variants v ON v.product_id = p.product_id
WHERE p.product_id = 1 AND p.is_active = TRUE;
