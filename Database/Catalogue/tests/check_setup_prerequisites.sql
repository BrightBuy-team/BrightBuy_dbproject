-- Read-only diagnostic before step 6 of ../README.md (the shared seed).
-- Run after steps 1-5 and the owners' checkout/auth setup, using an account
-- allowed to inspect all brightbuy tables. No default database is required.
-- Only SELECT statements: no schema/data writes, routines, or transactions.
-- BLOCK = stop; REVIEW = manual verification needed; PASS = this check only.
-- Missing metadata can also mean insufficient privileges. This is NOT an
-- installer, assertion suite, or proof that the complete seed will succeed.

SELECT VERSION() AS server_version,
       @@version_comment AS server_distribution,
       @@lower_case_table_names AS lower_case_table_names,
       @@SESSION.sql_mode AS session_sql_mode;

WITH server_version AS (
    SELECT CAST(SUBSTRING_INDEX(VERSION(), '.', 1) AS UNSIGNED) AS major,
           CAST(SUBSTRING_INDEX(SUBSTRING_INDEX(VERSION(), '.', 2), '.', -1)
                AS UNSIGNED) AS minor,
           CAST(SUBSTRING_INDEX(SUBSTRING_INDEX(VERSION(), '.', 3), '.', -1)
                AS UNSIGNED) AS patch
)
SELECT 'mysql_syntax_target' AS check_name,
       CASE
           WHEN VERSION() LIKE '%MariaDB%' OR major < 8 THEN 'BLOCK'
           WHEN major = 8 AND minor = 0 AND patch < 19 THEN 'BLOCK'
           ELSE 'REVIEW'
       END AS status,
       'Requires MySQL 8.0.19+; run both assertion suites on the exact team version. A newer server does not verify MySQL 8 compatibility.' AS detail
FROM server_version
UNION ALL
SELECT 'foreign_key_checks',
       IF(@@SESSION.foreign_key_checks = 1, 'PASS', 'BLOCK'),
       'Foreign-key checks must remain enabled for setup and testing.'
UNION ALL
SELECT 'unique_checks',
       IF(@@SESSION.unique_checks = 1, 'PASS', 'BLOCK'),
       'Unique checks must remain enabled for setup and testing.'
UNION ALL
SELECT 'strict_sql_mode',
       IF(FIND_IN_SET('STRICT_TRANS_TABLES', @@SESSION.sql_mode) > 0
          OR FIND_IN_SET('STRICT_ALL_TABLES', @@SESSION.sql_mode) > 0,
          'PASS', 'BLOCK'),
       'Use strict mode so invalid seed values are not silently adjusted.'
UNION ALL
SELECT 'inventory_table_name_case',
       IF(@@lower_case_table_names = 0, 'REVIEW', 'PASS'),
       'Current inventory DDL references WAREHOUSE but creates warehouse; ask its owner to correct names on case-sensitive servers. Do not change server case settings.';

-- Use exact lowercase metadata names on case-sensitive servers, just as the
-- shared seed does. Case-insensitive servers may store original casing.
WITH required_tables AS (
    SELECT 'product' AS table_name UNION ALL SELECT 'category'
    UNION ALL SELECT 'product_category' UNION ALL SELECT 'city'
    UNION ALL SELECT 'warehouse' UNION ALL SELECT 'variant'
    UNION ALL SELECT 'orders' UNION ALL SELECT 'delivery'
)
SELECT r.table_name AS required_table,
       CASE
           WHEN t.table_name IS NULL THEN 'BLOCK'
           WHEN t.table_type <> 'BASE TABLE' OR t.engine <> 'InnoDB' THEN 'BLOCK'
           ELSE 'PASS'
       END AS status,
       COALESCE(t.engine, 'Missing/inaccessible base table') AS engine
FROM required_tables r
LEFT JOIN information_schema.tables t
  ON BINARY t.table_schema = BINARY 'brightbuy'
 AND LOWER(t.table_name) = r.table_name
 AND (@@lower_case_table_names <> 0
      OR BINARY t.table_name = BINARY r.table_name)
ORDER BY r.table_name;

-- These are the checkout columns used by the shared delivery seed and its
-- order reference. Presence alone does not validate types, keys, or fixtures.
WITH required_columns AS (
    SELECT 'orders' AS table_name, 'order_id' AS column_name
    UNION ALL SELECT 'delivery', 'delivery_id'
    UNION ALL SELECT 'delivery', 'order_id'
    UNION ALL SELECT 'delivery', 'city_id'
    UNION ALL SELECT 'delivery', 'delivery_mode'
    UNION ALL SELECT 'delivery', 'est_delivery_date'
    UNION ALL SELECT 'delivery', 'delivery_status'
)
SELECT CONCAT(r.table_name, '.', r.column_name) AS required_column,
       IF(c.column_name IS NULL, 'BLOCK', 'PASS') AS status,
       COALESCE(c.column_type, 'Missing/inaccessible column') AS column_type
FROM required_columns r
LEFT JOIN information_schema.columns c
  ON BINARY c.table_schema = BINARY 'brightbuy'
 AND LOWER(c.table_name) = r.table_name
 AND (@@lower_case_table_names <> 0
      OR BINARY c.table_name = BINARY r.table_name)
 AND LOWER(c.column_name) = r.column_name
ORDER BY r.table_name, r.column_name;

SELECT 'REVIEW' AS status,
       'Before step 6: owners must verify checkout/auth foreign keys, orders 101-104, and no collisions with shared seed IDs. This metadata check does not inspect row data. Do not blindly rerun a partially applied seed.' AS remaining_checks;
