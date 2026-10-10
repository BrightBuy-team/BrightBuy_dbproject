-- =========================================================
-- BrightBuy | Shared | 05 Release checks
-- READ ONLY. Run after an install or an upgrade, as an account that can see
-- the schema's metadata. Each row is PASS or BLOCK; resolve every BLOCK.
-- It reads no customer rows and writes nothing. It checks that the expected
-- objects exist with the expected shape, not that their logic is correct:
-- the test scripts in Database/Tests do that on a disposable database.
-- =========================================================
USE brightbuy;

SELECT VERSION() AS server_version, CURRENT_ROLE() AS active_roles;

WITH required AS (
    SELECT 'category' AS name UNION ALL SELECT 'product' UNION ALL SELECT 'product_category'
    UNION ALL SELECT 'city' UNION ALL SELECT 'warehouse' UNION ALL SELECT 'variant'
    UNION ALL SELECT 'variant_audit' UNION ALL SELECT 'customer' UNION ALL SELECT 'employee'
    UNION ALL SELECT 'login_attempts' UNION ALL SELECT 'password_reset_token'
    UNION ALL SELECT 'orders' UNION ALL SELECT 'order_item' UNION ALL SELECT 'delivery'
    UNION ALL SELECT 'payment' UNION ALL SELECT 'sales_summary' UNION ALL SELECT 'report_access_log'
    UNION ALL SELECT 'email_outbox' UNION ALL SELECT 'audit_log'
)
SELECT CONCAT('table:', r.name) AS check_name,
       IF(t.engine = 'InnoDB', 'PASS', 'BLOCK') AS status
FROM required r
LEFT JOIN information_schema.tables t ON t.table_schema = DATABASE() AND t.table_name = r.name;

-- Every table has a primary key (SRS 2.5.2).
SELECT CONCAT('primary_key:', t.table_name) AS check_name,
       IF(k.constraint_name IS NULL, 'BLOCK', 'PASS') AS status
FROM information_schema.tables t
LEFT JOIN information_schema.table_constraints k
       ON k.constraint_schema = t.table_schema AND k.table_name = t.table_name
      AND k.constraint_type = 'PRIMARY KEY'
WHERE t.table_schema = DATABASE() AND t.table_type = 'BASE TABLE';

WITH required AS (
    SELECT 'sp_catalogue_search' AS name UNION ALL SELECT 'sp_catalogue_categories'
    UNION ALL SELECT 'sp_catalogue_product_detail' UNION ALL SELECT 'sp_catalogue_create_category'
    UNION ALL SELECT 'sp_catalogue_update_category' UNION ALL SELECT 'sp_catalogue_create_product'
    UNION ALL SELECT 'sp_catalogue_update_product' UNION ALL SELECT 'sp_catalogue_set_product_active'
    UNION ALL SELECT 'sp_catalogue_assign_category' UNION ALL SELECT 'sp_catalogue_unassign_category'
    UNION ALL SELECT 'fn_delivery_days' UNION ALL SELECT 'fn_delivery_preview_date'
    UNION ALL SELECT 'calculate_delivery_date' UNION ALL SELECT 'sp_inventory_set_stock'
    UNION ALL SELECT 'sp_inventory_create_variant' UNION ALL SELECT 'sp_inventory_update_variant'
    UNION ALL SELECT 'sp_register_customer' UNION ALL SELECT 'sp_create_employee'
    UNION ALL SELECT 'sp_get_customer_login' UNION ALL SELECT 'sp_get_employee_login'
    UNION ALL SELECT 'sp_log_login' UNION ALL SELECT 'sp_password_reset_request'
    UNION ALL SELECT 'sp_password_reset_confirm' UNION ALL SELECT 'fn_recent_failures'
    UNION ALL SELECT 'fn_employee_has_role' UNION ALL SELECT 'sp_checkout_validate_cart'
    UNION ALL SELECT 'sp_checkout_quote' UNION ALL SELECT 'ProcessCheckout'
    UNION ALL SELECT 'sp_populate_sales_summary' UNION ALL SELECT 'get_quarterly_sales_report'
    UNION ALL SELECT 'get_top_selling_products' UNION ALL SELECT 'get_category_order_counts'
    UNION ALL SELECT 'get_upcoming_delivery_estimates' UNION ALL SELECT 'get_customer_order_summary'
    UNION ALL SELECT 'sp_email_enqueue' UNION ALL SELECT 'sp_email_pending' UNION ALL SELECT 'sp_email_mark'
)
SELECT CONCAT('routine:', r.name) AS check_name,
       IF(p.routine_name IS NULL, 'BLOCK', 'PASS') AS status
FROM required r
LEFT JOIN information_schema.routines p ON p.routine_schema = DATABASE() AND p.routine_name = r.name;

-- Routines replaced by this release must be gone, so nothing calls them.
WITH retired AS (
    SELECT 'ProcessCheckoutV2' AS name UNION ALL SELECT 'sp_catalogue_create_product_with_variant'
    UNION ALL SELECT 'apply_variant_product_integration'
)
SELECT CONCAT('retired_routine:', r.name) AS check_name,
       IF(p.routine_name IS NULL, 'PASS', 'BLOCK') AS status
FROM retired r
LEFT JOIN information_schema.routines p ON p.routine_schema = DATABASE() AND p.routine_name = r.name;

SELECT 'checkout_signature' AS check_name, IF(COUNT(*) = 13, 'PASS', 'BLOCK') AS status
FROM information_schema.parameters
WHERE specific_schema = DATABASE() AND specific_name = 'ProcessCheckout' AND ordinal_position > 0;

SELECT 'create_product_signature' AS check_name, IF(COUNT(*) = 9, 'PASS', 'BLOCK') AS status
FROM information_schema.parameters
WHERE specific_schema = DATABASE() AND specific_name = 'sp_catalogue_create_product' AND ordinal_position > 0;

SELECT 'delivery_address_snapshot' AS check_name, IF(COUNT(*) = 1, 'PASS', 'BLOCK') AS status
FROM information_schema.columns
WHERE table_schema = DATABASE() AND table_name = 'delivery' AND column_name = 'address_line';

SELECT 'payment_card_columns' AS check_name, IF(COUNT(*) = 4, 'PASS', 'BLOCK') AS status
FROM information_schema.columns
WHERE table_schema = DATABASE() AND table_name = 'payment'
  AND column_name IN ('gateway_token', 'gateway_reference', 'card_last_four', 'card_type');

-- CON-5 / SEC-2: no column that could hold a card number or security code.
SELECT 'no_card_number_column' AS check_name, IF(COUNT(*) = 0, 'PASS', 'BLOCK') AS status
FROM information_schema.columns
WHERE table_schema = DATABASE()
  AND (column_name LIKE '%card_number%' OR column_name LIKE '%cvv%' OR column_name LIKE '%cvc%'
       OR column_name = 'pan');

SELECT 'variant_required_values' AS check_name, IF(COUNT(*) = 3, 'PASS', 'BLOCK') AS status
FROM information_schema.columns
WHERE table_schema = DATABASE() AND table_name = 'variant'
  AND column_name IN ('price', 'stock_quantity', 'product_id') AND is_nullable = 'NO';

SELECT 'variant_product_foreign_key' AS check_name, IF(COUNT(*) = 1, 'PASS', 'BLOCK') AS status
FROM information_schema.referential_constraints
WHERE constraint_schema = DATABASE() AND table_name = 'variant' AND referenced_table_name = 'product'
  AND delete_rule IN ('RESTRICT', 'NO ACTION');

WITH required AS (
    SELECT 'variant' AS table_name, 'ck_variant_price_nonnegative' AS name
    UNION ALL SELECT 'variant', 'ck_variant_stock_nonnegative'
    UNION ALL SELECT 'payment', 'chk_payment_card_last_four'
    UNION ALL SELECT 'payment', 'chk_payment_card_details'
)
SELECT CONCAT('constraint:', r.name) AS check_name, IF(c.enforced = 'YES', 'PASS', 'BLOCK') AS status
FROM required r
LEFT JOIN information_schema.table_constraints c
       ON c.constraint_schema = DATABASE() AND c.table_name = r.table_name
      AND c.constraint_name = r.name AND c.constraint_type = 'CHECK';

WITH required AS (SELECT 'payment' AS name UNION ALL SELECT 'delivery'),
unique_orders AS (
    SELECT table_name FROM information_schema.statistics
    WHERE table_schema = DATABASE() AND non_unique = 0
    GROUP BY table_name, index_name HAVING COUNT(*) = 1 AND MAX(column_name) = 'order_id'
)
SELECT CONCAT('unique_order:', r.name) AS check_name, IF(COUNT(u.table_name) > 0, 'PASS', 'BLOCK') AS status
FROM required r LEFT JOIN unique_orders u ON u.table_name = r.name
GROUP BY r.name;

-- CON-6: every foreign-key column is the leading column of an index.
SELECT CONCAT('fk_index:', k.table_name, '.', k.column_name) AS check_name,
       IF(COUNT(s.index_name) > 0, 'PASS', 'BLOCK') AS status
FROM information_schema.key_column_usage k
LEFT JOIN information_schema.statistics s
       ON s.table_schema = k.table_schema AND s.table_name = k.table_name
      AND s.column_name = k.column_name AND s.seq_in_index = 1
WHERE k.constraint_schema = DATABASE() AND k.referenced_table_name IS NOT NULL
GROUP BY k.table_name, k.column_name;

WITH required AS (
    SELECT 'trg_category_two_levels_insert' AS name UNION ALL SELECT 'trg_category_not_own_parent_insert'
    UNION ALL SELECT 'trg_category_two_levels_update'
    UNION ALL SELECT 'after_variant_insert' UNION ALL SELECT 'after_variant_update'
    UNION ALL SELECT 'audit_product_insert' UNION ALL SELECT 'audit_product_update'
    UNION ALL SELECT 'audit_product_delete' UNION ALL SELECT 'audit_category_insert'
    UNION ALL SELECT 'audit_category_update' UNION ALL SELECT 'audit_category_delete'
    UNION ALL SELECT 'audit_product_category_insert' UNION ALL SELECT 'audit_product_category_update'
    UNION ALL SELECT 'audit_product_category_delete' UNION ALL SELECT 'audit_variant_insert'
    UNION ALL SELECT 'audit_variant_update' UNION ALL SELECT 'audit_employee_insert'
    UNION ALL SELECT 'audit_employee_update'
)
SELECT CONCAT('trigger:', r.name) AS check_name, IF(t.trigger_name IS NULL, 'BLOCK', 'PASS') AS status
FROM required r
LEFT JOIN information_schema.triggers t ON t.trigger_schema = DATABASE() AND t.trigger_name = r.name;

-- No audit trigger may still point at the former catalogue_audit table.
SELECT 'audit_triggers_use_audit_log' AS check_name, IF(COUNT(*) = 0, 'PASS', 'BLOCK') AS status
FROM information_schema.triggers
WHERE trigger_schema = DATABASE() AND action_statement LIKE '%catalogue_audit%';

-- Stored amounts are US dollars. A leftover currency-conversion table means an
-- owner must review the data before release; it is never relabelled here.
SELECT 'usd_currency_baseline' AS check_name, IF(COUNT(*) = 0, 'PASS', 'BLOCK') AS status
FROM information_schema.tables
WHERE table_schema = DATABASE() AND table_name = 'currency_conversion_log';
