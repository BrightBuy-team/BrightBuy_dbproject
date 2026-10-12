-- =========================================================
-- BrightBuy | Tests | Index evidence (CON-6, PER-1 to PER-3)
-- Read-only: every statement is an EXPLAIN of a query the application runs.
-- FORMAT=TRADITIONAL keeps the output tabular on every MySQL version.
--   mysql --table brightbuy < Database/Tests/explain_indexes.sql
-- The recorded output is explained in Database/README.md.
-- =========================================================
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

-- Q9 Sign-in lookup by email (unique index on customer.email).
EXPLAIN FORMAT=TRADITIONAL SELECT customer_id, password_hash FROM customer WHERE email = 'abrahaml@example.com';

-- Q10 A customer's order history, newest first (idx_orders_customer_date, no sort step).
EXPLAIN FORMAT=TRADITIONAL SELECT order_id, order_date, total_amount FROM orders
WHERE customer_id = 1 ORDER BY order_date DESC;

-- Q11 Lines of one order (order_item primary key starts with order_id).
EXPLAIN FORMAT=TRADITIONAL SELECT variant_id, quantity, unit_price FROM order_item WHERE order_id = 101;

-- Q12 Sales in a date range, as the quarterly report reads them (idx_orders_date).
EXPLAIN FORMAT=TRADITIONAL SELECT order_id, total_amount FROM orders
WHERE order_date >= '2026-10-01' AND order_date < '2026-10-02';

-- Q13 Deliveries still on their way, by date (idx_delivery_status_date).
EXPLAIN FORMAT=TRADITIONAL SELECT order_id, est_delivery_date FROM delivery
WHERE delivery_status = 'Shipped' ORDER BY est_delivery_date;

-- Q14 The email dispatcher's next batch (idx_email_status_created, no sort step).
EXPLAIN FORMAT=TRADITIONAL SELECT email_id FROM email_outbox
WHERE status = 'Pending' ORDER BY created_at LIMIT 20;

-- Q15 A password reset code looked up by its hash (unique index on token_hash).
EXPLAIN FORMAT=TRADITIONAL SELECT token_id FROM password_reset_token
WHERE token_hash = SHA2('example', 256);
