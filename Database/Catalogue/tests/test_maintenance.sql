-- Maintenance procedure tests; run after 08 on disposable milestone-2 data.
-- Calls the real routines. No Python needed.
-- Create-product and unassign-category commit their own transactions, so this
-- suite cannot roll back: it deletes its own TEST-MAINT rows on success or error.
-- Run as an account that may DELETE from product and category (cleanup only).
-- Auto-increment gaps and helper-routine DDL are not undone.
USE brightbuy;
DROP PROCEDURE IF EXISTS catalogue_maintenance_assert;
DROP PROCEDURE IF EXISTS catalogue_maintenance_reject;
DROP PROCEDURE IF EXISTS catalogue_maintenance_cleanup;
DROP PROCEDURE IF EXISTS catalogue_maintenance_tests;
DELIMITER $$

CREATE PROCEDURE catalogue_maintenance_assert(IN passed BOOLEAN, IN test_name VARCHAR(100))
BEGIN
    DECLARE failure_message VARCHAR(128);
    IF passed IS NULL OR passed = FALSE THEN
        SET failure_message = CONCAT('FAIL: ',test_name);
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = failure_message;
    END IF;
    SET @maintenance_test_count = @maintenance_test_count + 1;
    SELECT CONCAT('PASS: ',test_name) AS result;
END$$

CREATE PROCEDURE catalogue_maintenance_reject(
    IN statement_text TEXT, IN expected_state CHAR(5), IN test_name VARCHAR(100)
)
BEGIN
    DECLARE actual_state CHAR(5) DEFAULT '00000';
    SET @maintenance_test_sql = statement_text;
    PREPARE catalogue_maintenance_statement FROM @maintenance_test_sql;
    BEGIN
        DECLARE CONTINUE HANDLER FOR SQLEXCEPTION
            GET DIAGNOSTICS CONDITION 1 actual_state = RETURNED_SQLSTATE;
        EXECUTE catalogue_maintenance_statement;
    END;
    DEALLOCATE PREPARE catalogue_maintenance_statement;
    CALL catalogue_maintenance_assert(actual_state = expected_state, test_name);
END$$

-- Products first: product_category rows cascade, then the categories are free.
CREATE PROCEDURE catalogue_maintenance_cleanup()
BEGIN
    DELETE FROM product WHERE sku LIKE 'TEST-MAINT-%';
    DELETE FROM category WHERE name LIKE 'TEST-MAINT %' AND parent_category_id IS NOT NULL;
    DELETE FROM category WHERE name LIKE 'TEST-MAINT %';
END$$

CREATE PROCEDURE catalogue_maintenance_tests()
BEGIN
    DECLARE root_id INT;
    DECLARE child_id INT;
    DECLARE other_id INT;
    DECLARE product_one INT;
    DECLARE ignored_id INT;
    DECLARE products_before INT;
    DECLARE categories_before INT;
    DECLARE mappings_before INT;
    DECLARE result JSON;
    DECLARE EXIT HANDLER FOR SQLEXCEPTION
    BEGIN
        ROLLBACK;
        CALL catalogue_maintenance_cleanup();
        RESIGNAL;
    END;
    SET @maintenance_test_count = 0;
    CALL catalogue_maintenance_cleanup();
    SELECT COUNT(*) INTO products_before FROM product;
    SELECT COUNT(*) INTO categories_before FROM category;
    SELECT COUNT(*) INTO mappings_before FROM product_category;

    -- Categories
    CALL sp_catalogue_create_category('  TEST-MAINT Root  ', '  Root for tests ', NULL, root_id);
    CALL catalogue_maintenance_assert(root_id IS NOT NULL AND EXISTS (
        SELECT 1 FROM category WHERE category_id = root_id AND name = 'TEST-MAINT Root'
          AND description = 'Root for tests' AND parent_category_id IS NULL AND is_active = TRUE
    ), 'create root category with trimmed values');
    CALL sp_catalogue_create_category('TEST-MAINT Child', NULL, root_id, child_id);
    CALL catalogue_maintenance_assert((SELECT parent_category_id FROM category WHERE category_id = child_id) = root_id, 'create child category');
    CALL sp_catalogue_create_category('TEST-MAINT Other', '', NULL, other_id);
    CALL catalogue_maintenance_assert((SELECT description FROM category WHERE category_id = other_id) IS NULL, 'blank description stored as NULL');

    CALL catalogue_maintenance_reject('CALL sp_catalogue_create_category(''   '', NULL, NULL, @maintenance_ignored)', '45000', 'blank category name rejected');
    CALL catalogue_maintenance_reject(CONCAT('CALL sp_catalogue_create_category(''', REPEAT('x', 101), ''', NULL, NULL, @maintenance_ignored)'), '45000', 'over-long category name rejected');
    CALL catalogue_maintenance_reject('CALL sp_catalogue_create_category(''TEST-MAINT Root'', NULL, NULL, @maintenance_ignored)', '23000', 'duplicate category name rejected');
    CALL catalogue_maintenance_reject('CALL sp_catalogue_create_category(''TEST-MAINT Orphan'', NULL, 2147483647, @maintenance_ignored)', '45004', 'missing parent category rejected');
    CALL catalogue_maintenance_reject(CONCAT('CALL sp_catalogue_create_category(''TEST-MAINT Deep'', NULL, ', child_id, ', @maintenance_ignored)'), '45000', 'third hierarchy level rejected');

    CALL sp_catalogue_update_category(other_id, 'TEST-MAINT Renamed', 'Now described', NULL, 0);
    CALL catalogue_maintenance_assert(EXISTS (
        SELECT 1 FROM category WHERE category_id = other_id AND name = 'TEST-MAINT Renamed'
          AND description = 'Now described' AND is_active = FALSE
    ), 'update category fields and deactivate');
    CALL sp_catalogue_update_category(other_id, 'TEST-MAINT Renamed', NULL, root_id, 1);
    CALL catalogue_maintenance_assert((SELECT parent_category_id FROM category WHERE category_id = other_id) = root_id, 'reparent category under a root');
    CALL catalogue_maintenance_reject(CONCAT('CALL sp_catalogue_update_category(', root_id, ', ''TEST-MAINT Root'', NULL, ', root_id, ', 1)'), '45000', 'category cannot become its own parent');
    CALL catalogue_maintenance_reject('CALL sp_catalogue_update_category(2147483647, ''TEST-MAINT Missing'', NULL, NULL, 1)', '45004', 'update of missing category rejected');
    CALL catalogue_maintenance_reject(CONCAT('CALL sp_catalogue_update_category(', other_id, ', ''TEST-MAINT Renamed'', NULL, NULL, 2)'), '45000', 'invalid category is_active rejected');
    CALL catalogue_maintenance_reject(CONCAT('CALL sp_catalogue_update_category(', other_id, ', ''TEST-MAINT Child'', NULL, NULL, 1)'), '23000', 'rename to existing category name rejected');

    -- Products
    CALL sp_catalogue_create_product(' TEST-MAINT-001 ', '  Maintenance Test Product ', ' First description ', '', child_id, product_one);
    CALL catalogue_maintenance_assert(EXISTS (
        SELECT 1 FROM product WHERE product_id = product_one AND sku = 'TEST-MAINT-001'
          AND name = 'Maintenance Test Product' AND description = 'First description'
          AND image_url IS NULL AND is_active = TRUE
    ), 'create product with trimmed values');
    CALL catalogue_maintenance_assert((SELECT COUNT(*) FROM product_category WHERE product_id = product_one AND category_id = child_id) = 1
        AND (SELECT COUNT(*) FROM product_category WHERE product_id = product_one) = 1, 'new product has exactly its first category');
    CALL catalogue_maintenance_reject(CONCAT('CALL sp_catalogue_product_detail(', product_one, ', @maintenance_detail)'), '45004', 'product without variants stays hidden from storefront');

    CALL catalogue_maintenance_reject(CONCAT('CALL sp_catalogue_create_product(''TEST-MAINT-001'', ''Duplicate'', NULL, NULL, ', child_id, ', @maintenance_ignored)'), '23000', 'duplicate SKU rejected');
    CALL catalogue_maintenance_reject(CONCAT('CALL sp_catalogue_create_product(''TEST MAINT 002'', ''Bad SKU'', NULL, NULL, ', child_id, ', @maintenance_ignored)'), '45000', 'SKU with spaces rejected');
    CALL catalogue_maintenance_reject(CONCAT('CALL sp_catalogue_create_product(''TEST-MAINT-002'', '' '', NULL, NULL, ', child_id, ', @maintenance_ignored)'), '45000', 'blank product name rejected');
    CALL catalogue_maintenance_reject('CALL sp_catalogue_create_product(''TEST-MAINT-002'', ''No Category'', NULL, NULL, 2147483647, @maintenance_ignored)', '45004', 'product with missing category rejected');
    CALL catalogue_maintenance_reject('CALL sp_catalogue_create_product(''TEST-MAINT-002'', ''No Category'', NULL, NULL, NULL, @maintenance_ignored)', '45004', 'product with NULL category rejected');
    CALL catalogue_maintenance_assert(NOT EXISTS (SELECT 1 FROM product WHERE sku = 'TEST-MAINT-002'), 'failed creations leave no partial product');

    CALL sp_catalogue_update_product(product_one, 'TEST-MAINT-001B', 'Renamed Test Product', NULL, 'https://example.invalid/test.png');
    CALL catalogue_maintenance_assert(EXISTS (
        SELECT 1 FROM product WHERE product_id = product_one AND sku = 'TEST-MAINT-001B'
          AND name = 'Renamed Test Product' AND description IS NULL
          AND image_url = 'https://example.invalid/test.png'
    ), 'update product fields');
    CALL catalogue_maintenance_reject(CONCAT('CALL sp_catalogue_update_product(', product_one, ', ''IPHONE-15-PRO'', ''Clash'', NULL, NULL)'), '23000', 'update to existing SKU rejected');
    CALL catalogue_maintenance_reject('CALL sp_catalogue_update_product(2147483647, ''TEST-MAINT-404'', ''Missing'', NULL, NULL)', '45004', 'update of missing product rejected');
    CALL catalogue_maintenance_reject(CONCAT('CALL sp_catalogue_update_product(', product_one, ', ''TEST-MAINT-001B'', ''', REPEAT('n', 151), ''', NULL, NULL)'), '45000', 'over-long product name rejected');

    CALL sp_catalogue_set_product_active(product_one, 0);
    CALL catalogue_maintenance_assert((SELECT is_active FROM product WHERE product_id = product_one) = FALSE, 'retire product');
    CALL sp_catalogue_set_product_active(product_one, 1);
    CALL catalogue_maintenance_assert((SELECT is_active FROM product WHERE product_id = product_one) = TRUE, 'restore product');
    CALL catalogue_maintenance_reject(CONCAT('CALL sp_catalogue_set_product_active(', product_one, ', NULL)'), '45000', 'NULL product is_active rejected');
    CALL catalogue_maintenance_reject('CALL sp_catalogue_set_product_active(2147483647, 0)', '45004', 'retire of missing product rejected');

    -- Assignments
    CALL sp_catalogue_assign_category(product_one, root_id);
    CALL sp_catalogue_assign_category(product_one, root_id);
    CALL catalogue_maintenance_assert((SELECT COUNT(*) FROM product_category WHERE product_id = product_one) = 2, 'assign second category once despite repeat');
    CALL catalogue_maintenance_reject(CONCAT('CALL sp_catalogue_assign_category(', product_one, ', 2147483647)'), '45004', 'assign to missing category rejected');
    CALL catalogue_maintenance_reject(CONCAT('CALL sp_catalogue_assign_category(2147483647, ', root_id, ')'), '45004', 'assign for missing product rejected');

    CALL catalogue_maintenance_reject(CONCAT('CALL sp_catalogue_unassign_category(', product_one, ', ', other_id, ')'), '45004', 'unassign of non-assigned category rejected');
    CALL sp_catalogue_unassign_category(product_one, child_id);
    CALL catalogue_maintenance_assert((SELECT COUNT(*) FROM product_category WHERE product_id = product_one AND category_id = root_id) = 1
        AND (SELECT COUNT(*) FROM product_category WHERE product_id = product_one) = 1, 'unassign one of two categories');
    CALL catalogue_maintenance_reject(CONCAT('CALL sp_catalogue_unassign_category(', product_one, ', ', root_id, ')'), '45000', 'removing the last category rejected');
    CALL catalogue_maintenance_assert((SELECT COUNT(*) FROM product_category WHERE product_id = product_one) = 1, 'last category still assigned after rejection');
    CALL catalogue_maintenance_reject(CONCAT('CALL sp_catalogue_unassign_category(2147483647, ', root_id, ')'), '45004', 'unassign for missing product rejected');

    -- Existing storefront data is untouched by maintenance of the test rows.
    CALL sp_catalogue_search(NULL, NULL, NULL, NULL, 0, 'name_asc', 1, 100, result);
    CALL catalogue_maintenance_assert(JSON_EXTRACT(result, '$.total_products') = 39, 'storefront still lists the 39 seeded active products');

    CALL catalogue_maintenance_cleanup();
    CALL catalogue_maintenance_assert((SELECT COUNT(*) FROM product) = products_before
        AND (SELECT COUNT(*) FROM category) = categories_before
        AND (SELECT COUNT(*) FROM product_category) = mappings_before, 'cleanup restored original row counts');

    SELECT CONCAT('PASS: all ', @maintenance_test_count, ' catalogue maintenance assertions') AS result;
END$$

DELIMITER ;

CALL catalogue_maintenance_tests();
DROP PROCEDURE catalogue_maintenance_tests;
DROP PROCEDURE catalogue_maintenance_cleanup;
DROP PROCEDURE catalogue_maintenance_reject;
DROP PROCEDURE catalogue_maintenance_assert;
