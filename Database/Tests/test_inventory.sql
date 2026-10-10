-- =========================================================
-- BrightBuy | Tests | Inventory procedures, stock audit and delivery estimates
-- Run on a disposable database after a fresh install (install_all.sh).
-- Prints PASS per assertion; a failure raises SQLSTATE 45000 and stops.
-- Row changes are rolled back on success and on failure.
-- =========================================================
USE brightbuy;
DROP PROCEDURE IF EXISTS inventory_test_assert;
DROP PROCEDURE IF EXISTS inventory_test_reject;
DROP PROCEDURE IF EXISTS inventory_tests;
DELIMITER $$

CREATE PROCEDURE inventory_test_assert(IN passed BOOLEAN, IN test_name VARCHAR(100))
BEGIN
    DECLARE failure_message VARCHAR(128);
    IF passed IS NULL OR passed = FALSE THEN
        SET failure_message = CONCAT('FAIL: ', test_name);
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = failure_message;
    END IF;
    SET @inventory_test_count = @inventory_test_count + 1;
    SELECT CONCAT('PASS: ', test_name) AS result;
END$$

CREATE PROCEDURE inventory_test_reject(IN statement_text TEXT, IN expected_state CHAR(5), IN test_name VARCHAR(100))
BEGIN
    DECLARE actual_state CHAR(5) DEFAULT '00000';
    SET @inventory_test_sql = statement_text;
    PREPARE inventory_test_statement FROM @inventory_test_sql;
    BEGIN
        DECLARE CONTINUE HANDLER FOR SQLEXCEPTION
            GET DIAGNOSTICS CONDITION 1 actual_state = RETURNED_SQLSTATE;
        EXECUTE inventory_test_statement;
    END;
    DEALLOCATE PREPARE inventory_test_statement;
    CALL inventory_test_assert(actual_state = expected_state, test_name);
END$$

CREATE PROCEDURE inventory_tests()
BEGIN
    DECLARE new_variant INT;
    DECLARE stock_audits INT;
    DECLARE detail_audits INT;
    DECLARE EXIT HANDLER FOR SQLEXCEPTION
    BEGIN
        ROLLBACK;
        SET @brightbuy_actor = NULL;
        RESIGNAL;
    END;
    SET @inventory_test_count = 0;
    SET @brightbuy_actor = 'test:inventory';
    START TRANSACTION;

    -- Delivery rule (BR-8). Seed cities: 1 Houston (main), 3 Lubbock (other).
    CALL inventory_test_assert(fn_delivery_days(1, FALSE) = 5 AND fn_delivery_days(3, FALSE) = 7,
        '5 days for a main city, 7 for another city');
    CALL inventory_test_assert(fn_delivery_days(1, TRUE) = 8 AND fn_delivery_days(3, TRUE) = 10,
        'out of stock adds 3 days in either case');
    CALL inventory_test_assert(fn_delivery_days(2147483647, FALSE) = 7, 'a city outside the main-city list counts as another city');

    -- Estimate before ordering. Seed variants: 1 has 50 in stock, 3 has none.
    CALL inventory_test_assert(fn_delivery_preview_date(1, JSON_ARRAY(JSON_OBJECT('variantId', 1, 'quantity', 1))) = CURDATE() + INTERVAL 5 DAY,
        'preview for in-stock items in a main city');
    CALL inventory_test_assert(fn_delivery_preview_date(1, JSON_ARRAY(JSON_OBJECT('variantId', 1, 'quantity', 1),
        JSON_OBJECT('variantId', 3, 'quantity', 1))) = CURDATE() + INTERVAL 8 DAY,
        'preview adds the delay when one item is out of stock');
    CALL inventory_test_assert(fn_delivery_preview_date(1, JSON_ARRAY(JSON_OBJECT('variantId', 1, 'quantity', 50))) = CURDATE() + INTERVAL 5 DAY
        AND fn_delivery_preview_date(1, JSON_ARRAY(JSON_OBJECT('variantId', 1, 'quantity', 51))) = CURDATE() + INTERVAL 8 DAY,
        'preview adds the delay only when a line asks for more than is in stock');
    CALL inventory_test_assert(fn_delivery_preview_date(3, JSON_ARRAY(JSON_OBJECT('variantId', 3, 'quantity', 1))) = CURDATE() + INTERVAL 10 DAY,
        'preview for an out-of-stock item in another city');
    CALL inventory_test_assert(fn_delivery_preview_date(3, NULL) = CURDATE() + INTERVAL 7 DAY,
        'preview without items uses the city only');
    CALL inventory_test_assert(fn_delivery_preview_date(2147483647, JSON_ARRAY(JSON_OBJECT('variantId', 1, 'quantity', 1))) IS NULL, 'preview is empty for an unknown city');

    -- Estimate for an existing order (seed order 101 contains variant 1).
    CALL inventory_test_assert(calculate_delivery_date(1, 101) = CURDATE() + INTERVAL 5 DAY, 'order estimate when every line was in stock');
    UPDATE order_item SET backordered_quantity = 1 WHERE order_id = 101 AND variant_id = 1;
    CALL inventory_test_assert(calculate_delivery_date(1, 101) = CURDATE() + INTERVAL 8 DAY, 'order estimate adds the delay when a line was back-ordered');

    -- New variant for an existing product
    CALL sp_inventory_create_variant(1, 1, '  Test Variant - Green 128GB ', ' Green ', '128GB', 499.99, 6, new_variant);
    CALL inventory_test_assert(new_variant IS NOT NULL AND EXISTS (
        SELECT 1 FROM variant WHERE variant_id = new_variant AND product_id = 1 AND warehouse_id = 1
          AND variant_name = 'Test Variant - Green 128GB' AND colour = 'Green' AND memory_size = '128GB'
          AND price = 499.99 AND stock_quantity = 6), 'create variant with trimmed values');
    CALL inventory_test_assert((SELECT COUNT(*) FROM variant_audit WHERE variant_id = new_variant
        AND old_stock_quantity IS NULL AND new_stock_quantity = 6 AND changed_by = 'test:inventory') = 1,
        'opening stock is written to the stock audit');
    CALL inventory_test_assert((SELECT COUNT(*) FROM audit_log WHERE entity_type = 'variant' AND entity_id = new_variant
        AND action = 'INSERT' AND actor = 'test:inventory' AND JSON_EXTRACT(new_values, '$.price') = 499.99) = 1,
        'variant creation is written to the audit log');
    CALL sp_inventory_create_variant(1, NULL, 'Test Variant - No Warehouse', NULL, NULL, 10.00, 0, @inventory_central);
    CALL inventory_test_assert((SELECT warehouse_id FROM variant WHERE variant_id = @inventory_central)
        = (SELECT MIN(warehouse_id) FROM warehouse), 'a variant without a warehouse goes to the central warehouse');
    CALL inventory_test_reject('CALL sp_inventory_create_variant(1, 1, ''  '', NULL, NULL, 10, 1, @inventory_ignored)', '45000', 'blank variant name rejected');
    CALL inventory_test_reject('CALL sp_inventory_create_variant(1, 1, ''Free'', NULL, NULL, 0, 1, @inventory_ignored)', '45000', 'zero price rejected');
    CALL inventory_test_reject('CALL sp_inventory_create_variant(1, 1, ''Negative'', NULL, NULL, 10, -1, @inventory_ignored)', '45000', 'negative opening stock rejected');
    CALL inventory_test_reject('CALL sp_inventory_create_variant(2147483647, 1, ''Orphan'', NULL, NULL, 10, 1, @inventory_ignored)', '45004', 'variant for a missing product rejected');
    CALL inventory_test_reject('CALL sp_inventory_create_variant(1, 2147483647, ''Nowhere'', NULL, NULL, 10, 1, @inventory_ignored)', '45004', 'variant in a missing warehouse rejected');

    -- Variant details and price
    SELECT COUNT(*) INTO stock_audits FROM variant_audit WHERE variant_id = new_variant;
    CALL sp_inventory_update_variant(new_variant, 'Test Variant - Green 256GB', 'Green', '256GB', 549.00);
    CALL inventory_test_assert(EXISTS (SELECT 1 FROM variant WHERE variant_id = new_variant
        AND variant_name = 'Test Variant - Green 256GB' AND memory_size = '256GB' AND price = 549.00
        AND stock_quantity = 6), 'update variant details and price without touching stock');
    CALL inventory_test_assert((SELECT COUNT(*) FROM audit_log WHERE entity_type = 'variant' AND entity_id = new_variant
        AND action = 'UPDATE' AND JSON_EXTRACT(old_values, '$.price') = 499.99
        AND JSON_EXTRACT(new_values, '$.price') = 549.00) = 1, 'price change is audited with old and new value');
    CALL inventory_test_assert((SELECT COUNT(*) FROM variant_audit WHERE variant_id = new_variant) = stock_audits,
        'a price change adds nothing to the stock audit');
    CALL inventory_test_reject(CONCAT('CALL sp_inventory_update_variant(', new_variant, ', ''Free'', NULL, NULL, 0)'), '45000', 'update to zero price rejected');
    CALL inventory_test_reject('CALL sp_inventory_update_variant(2147483647, ''Missing'', NULL, NULL, 10)', '45004', 'update of a missing variant rejected');

    -- Stock (SAF-2, SAF-7)
    SELECT COUNT(*) INTO detail_audits FROM audit_log WHERE entity_type = 'variant' AND entity_id = new_variant;
    CALL sp_inventory_set_stock(new_variant, 40);
    CALL inventory_test_assert((SELECT stock_quantity FROM variant WHERE variant_id = new_variant) = 40
        AND (SELECT COUNT(*) FROM variant_audit WHERE variant_id = new_variant AND old_stock_quantity = 6
             AND new_stock_quantity = 40 AND changed_by = 'test:inventory') = 1,
        'stock change is audited with user, old and new value');
    CALL inventory_test_assert((SELECT COUNT(*) FROM audit_log WHERE entity_type = 'variant'
        AND entity_id = new_variant) = detail_audits, 'a stock change adds nothing to the audit log');
    CALL sp_inventory_set_stock(new_variant, 40);
    CALL inventory_test_assert((SELECT COUNT(*) FROM variant_audit WHERE variant_id = new_variant) = stock_audits + 1,
        'setting the same quantity is not recorded as a change');
    CALL inventory_test_reject(CONCAT('CALL sp_inventory_set_stock(', new_variant, ', -1)'), '45000', 'negative stock rejected by the procedure');
    CALL inventory_test_reject('CALL sp_inventory_set_stock(2147483647, 5)', '45004', 'stock for a missing variant rejected');
    CALL inventory_test_reject(CONCAT('UPDATE variant SET stock_quantity = -1 WHERE variant_id = ', new_variant), 'HY000',
        'negative stock rejected by the CHECK constraint');
    CALL inventory_test_reject(CONCAT('UPDATE variant SET price = -1 WHERE variant_id = ', new_variant), 'HY000',
        'negative price rejected by the CHECK constraint');

    ROLLBACK;
    SET @brightbuy_actor = NULL;
    SELECT CONCAT('PASS: all ', @inventory_test_count, ' inventory assertions; row changes rolled back') AS result;
END$$

DELIMITER ;

CALL inventory_tests();
DROP PROCEDURE inventory_tests;
DROP PROCEDURE inventory_test_reject;
DROP PROCEDURE inventory_test_assert;
SET @inventory_test_sql = NULL;
SET @inventory_test_count = NULL;
SET @inventory_central = NULL;
