-- READ ONLY: owner-run after reviewed upgrades, with metadata visibility.
-- No seeds, writes, helper DDL, personal row data or currency conversion.
USE brightbuy;
SELECT VERSION() AS server_version, CURRENT_ROLE() AS active_roles;
WITH required AS (
 SELECT 'category' AS name UNION ALL SELECT 'product' UNION ALL SELECT 'product_category'
 UNION ALL SELECT 'variant' UNION ALL SELECT 'warehouse' UNION ALL SELECT 'city'
 UNION ALL SELECT 'customer' UNION ALL SELECT 'employee' UNION ALL SELECT 'orders'
 UNION ALL SELECT 'order_item' UNION ALL SELECT 'delivery' UNION ALL SELECT 'payment'
 UNION ALL SELECT 'catalogue_audit' UNION ALL SELECT 'variant_audit'
 UNION ALL SELECT 'sales_summary' UNION ALL SELECT 'report_access_log' UNION ALL SELECT 'login_attempts'
)
SELECT CONCAT('table:',r.name) AS check_name,
 IF(t.engine='InnoDB','PASS','BLOCK') AS status
FROM required r LEFT JOIN information_schema.tables t ON t.table_schema=DATABASE() AND t.table_name=r.name;
WITH required AS (
 SELECT 'sp_catalogue_search' AS name UNION ALL SELECT 'sp_catalogue_categories'
 UNION ALL SELECT 'sp_catalogue_product_detail' UNION ALL SELECT 'sp_catalogue_create_product_with_variant'
 UNION ALL SELECT 'sp_register_customer' UNION ALL SELECT 'sp_create_employee'
 UNION ALL SELECT 'sp_get_customer_login' UNION ALL SELECT 'sp_get_employee_login'
 UNION ALL SELECT 'sp_log_login' UNION ALL SELECT 'fn_recent_failures' UNION ALL SELECT 'fn_employee_has_role'
 UNION ALL SELECT 'ProcessCheckoutV2' UNION ALL SELECT 'calculate_delivery_date'
 UNION ALL SELECT 'sp_populate_sales_summary' UNION ALL SELECT 'get_quarterly_sales_report'
 UNION ALL SELECT 'get_top_selling_products' UNION ALL SELECT 'get_category_order_counts'
 UNION ALL SELECT 'get_upcoming_delivery_estimates' UNION ALL SELECT 'get_customer_order_summary'
)
SELECT CONCAT('routine:',r.name) AS check_name,
 IF(p.routine_name IS NULL,'BLOCK','PASS') AS status
FROM required r LEFT JOIN information_schema.routines p ON p.routine_schema=DATABASE() AND p.routine_name=r.name;
SELECT 'checkout_v2_signature' AS check_name, IF(COUNT(*)=8,'PASS','BLOCK') AS status
FROM information_schema.parameters WHERE specific_schema=DATABASE() AND specific_name='ProcessCheckoutV2' AND ordinal_position>0;
SELECT 'delivery_address_snapshot' AS check_name, IF(COUNT(*)=1,'PASS','BLOCK') AS status
FROM information_schema.columns WHERE table_schema=DATABASE() AND table_name='delivery' AND column_name='address_line';
SELECT 'variant_required_values' AS check_name, IF(COUNT(*)=3,'PASS','BLOCK') AS status
FROM information_schema.columns WHERE table_schema=DATABASE() AND table_name='variant'
AND column_name IN ('price','stock_quantity','product_id') AND is_nullable='NO';
WITH required AS (
 SELECT 'ck_variant_price_nonnegative' AS name UNION ALL SELECT 'ck_variant_stock_nonnegative'
)
SELECT CONCAT('constraint:',r.name) AS check_name, IF(c.enforced='YES','PASS','BLOCK') AS status
FROM required r LEFT JOIN information_schema.table_constraints c
 ON c.constraint_schema=DATABASE() AND c.table_name='variant' AND c.constraint_name=r.name AND c.constraint_type='CHECK';
WITH required AS (SELECT 'payment' AS name UNION ALL SELECT 'delivery'), unique_orders AS (
 SELECT table_name FROM information_schema.statistics WHERE table_schema=DATABASE() AND non_unique=0
 GROUP BY table_name,index_name HAVING COUNT(*)=1 AND MAX(column_name)='order_id'
)
SELECT CONCAT('unique_order:',r.name) AS check_name, IF(COUNT(u.table_name)>0,'PASS','BLOCK') AS status
FROM required r LEFT JOIN unique_orders u ON u.table_name=r.name GROUP BY r.name;
WITH required AS (
 SELECT 'after_variant_update' AS name UNION ALL SELECT 'audit_product_insert' UNION ALL SELECT 'audit_product_update'
 UNION ALL SELECT 'audit_product_delete' UNION ALL SELECT 'audit_category_insert' UNION ALL SELECT 'audit_category_update'
 UNION ALL SELECT 'audit_category_delete' UNION ALL SELECT 'audit_product_category_insert'
 UNION ALL SELECT 'audit_product_category_update' UNION ALL SELECT 'audit_product_category_delete'
)
SELECT CONCAT('trigger:',r.name) AS check_name, IF(t.trigger_name IS NULL,'BLOCK','PASS') AS status
FROM required r LEFT JOIN information_schema.triggers t ON t.trigger_schema=DATABASE() AND t.trigger_name=r.name;
-- This is conservative: an older LKR audit needs owner review, never relabelling.
SELECT 'usd_currency_baseline' AS check_name, IF(COUNT(*)=0,'PASS','BLOCK') AS status
FROM information_schema.tables WHERE table_schema=DATABASE() AND table_name='currency_conversion_log';
SELECT 'Metadata presence is not semantic certification. Run disposable regression and deployment acceptance; inspect grants privately.' AS remaining_review;
