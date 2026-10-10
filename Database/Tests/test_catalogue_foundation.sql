-- =========================================================
-- BrightBuy | Tests | Catalogue tables, constraints and fixtures
-- Run on a disposable database after a fresh install (install_all.sh).
-- Expects the standard fixtures: 40 products, 10 categories, 48 variants.
-- Prints PASS per assertion; a failure raises SQLSTATE 45000 and stops.
-- Row changes are rolled back on success and on failure.
-- =========================================================

USE brightbuy;

DROP PROCEDURE IF EXISTS catalogue_test_assert;
DROP PROCEDURE IF EXISTS catalogue_test_reject;
DROP PROCEDURE IF EXISTS catalogue_test_foundation;

DELIMITER $$

CREATE PROCEDURE catalogue_test_assert(IN condition_ok BOOLEAN, IN test_name VARCHAR(100))
BEGIN
    DECLARE failure_message VARCHAR(128);
    IF condition_ok IS NULL OR condition_ok = FALSE THEN
        SET failure_message = CONCAT('FAIL: ', test_name);
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = failure_message;
    END IF;
    SET @catalogue_test_passed = @catalogue_test_passed + 1;
    SELECT CONCAT('PASS: ', test_name) AS result;
END$$

-- Catch only the statement being tested, then assert outside its handler.
-- Both error number and message are checked for custom hierarchy errors.
CREATE PROCEDURE catalogue_test_reject(
    IN statement_text TEXT,
    IN expected_errno INT,
    IN expected_message VARCHAR(128),
    IN test_name VARCHAR(100)
)
BEGIN
    DECLARE actual_errno INT DEFAULT 0;
    DECLARE actual_message TEXT DEFAULT '';
    SET @catalogue_test_sql = statement_text;
    PREPARE catalogue_test_statement FROM @catalogue_test_sql;
    BEGIN
        DECLARE CONTINUE HANDLER FOR SQLEXCEPTION
            GET DIAGNOSTICS CONDITION 1
                actual_errno = MYSQL_ERRNO, actual_message = MESSAGE_TEXT;
        EXECUTE catalogue_test_statement;
    END;
    DEALLOCATE PREPARE catalogue_test_statement;
    CALL catalogue_test_assert(
        actual_errno = expected_errno
        AND (expected_message IS NULL OR actual_message = expected_message), test_name
    );
END$$

CREATE PROCEDURE catalogue_test_foundation()
BEGIN
    DECLARE EXIT HANDLER FOR SQLEXCEPTION
    BEGIN
        ROLLBACK;
        RESIGNAL;
    END;

    SET @catalogue_test_passed = 0;
    START TRANSACTION;

    CALL catalogue_test_assert(
        (SELECT COUNT(*) FROM product) = 40
        AND (SELECT COUNT(*) FROM category) = 10
        AND (SELECT COUNT(*) FROM variant) = 48, 'standard fixture counts');

    CALL catalogue_test_assert(
        (SELECT GROUP_CONCAT(CONCAT(product_id, ':', category_id)
                ORDER BY product_id, category_id) FROM product_category WHERE product_id <= 3)
        = '1:1,1:4,2:1,2:4,3:1,3:5', 'correct product-category mappings');

    CALL catalogue_test_assert(
        (SELECT COUNT(*) FROM product_category) = 80
        AND NOT EXISTS (
            SELECT p.product_id FROM product p
            LEFT JOIN product_category pc ON pc.product_id = p.product_id
            LEFT JOIN category c ON c.category_id = pc.category_id
            GROUP BY p.product_id
            HAVING COUNT(pc.category_id) <> 2 OR SUM(c.parent_category_id IS NOT NULL) <> 1
        ), 'every product has one child and one root category');
    CALL catalogue_test_assert(
        NOT EXISTS (
            SELECT 1 FROM product_category pc JOIN category c ON c.category_id = pc.category_id
            WHERE c.parent_category_id IS NOT NULL AND NOT EXISTS (
                SELECT 1 FROM product_category parent_mapping
                WHERE parent_mapping.product_id = pc.product_id
                  AND parent_mapping.category_id = c.parent_category_id
            )
        ), 'child categories have matching root mappings');
    CALL catalogue_test_assert(
        (SELECT COUNT(DISTINCT c.category_id) FROM category c
         JOIN product_category pc ON pc.category_id = c.category_id
         WHERE c.parent_category_id IS NOT NULL) = 7, 'all seven child categories populated');
    CALL catalogue_test_assert(
        (SELECT COUNT(*) FROM product WHERE is_active = TRUE) = 39
        AND (SELECT is_active FROM product WHERE product_id = 40) = FALSE,
        '39 active products and one inactive fixture');
    CALL catalogue_test_assert(
        NOT EXISTS (SELECT 1 FROM variant v LEFT JOIN warehouse w ON w.warehouse_id = v.warehouse_id
                    WHERE w.warehouse_id IS NULL OR v.price IS NULL OR v.price <= 0
                       OR v.stock_quantity IS NULL OR v.stock_quantity < 0),
        'all variants have warehouses positive prices and nonnegative stock');
    CALL catalogue_test_assert(
        (SELECT COUNT(*) FROM variant WHERE variant_id BETWEEN 1004 AND 1040
          OR variant_id IN (1104,1114,1119,1125,1131,1136)) = 43,
        '43 catalogue-owned variant fixtures');
    CALL catalogue_test_assert(
        (SELECT COUNT(*) FROM variant WHERE
          (variant_id=1 AND product_id=1 AND warehouse_id=1 AND price=1099.00 AND stock_quantity=50) OR
          (variant_id=2 AND product_id=1 AND warehouse_id=2 AND price=1099.00 AND stock_quantity=15) OR
          (variant_id=3 AND product_id=1 AND warehouse_id=1 AND price=1299.00 AND stock_quantity=0) OR
          (variant_id=4 AND product_id=2 AND warehouse_id=3 AND price=1299.99 AND stock_quantity=30) OR
          (variant_id=5 AND product_id=3 AND warehouse_id=1 AND price=348.00 AND stock_quantity=120)) = 5,
        'original inventory variant fixtures preserved');
    CALL catalogue_test_assert(
        (SELECT COUNT(*) FROM variant WHERE stock_quantity=0) = 3,
        'three out-of-stock variant fixtures');
    CALL catalogue_test_assert(
        (SELECT COUNT(*) FROM (SELECT product_id FROM variant GROUP BY product_id HAVING COUNT(*) > 1)
         AS multiple_options) = 7, 'seven products offer multiple variants');

    CALL catalogue_test_assert(
        (SELECT COUNT(*) FROM information_schema.key_column_usage
         WHERE constraint_schema = DATABASE() AND table_name = 'variant'
           AND column_name = 'product_id' AND referenced_table_schema = DATABASE()
           AND referenced_table_name = 'product' AND referenced_column_name = 'product_id') = 1,
        'one variant-product foreign key');

    CALL catalogue_test_assert(
        (SELECT COUNT(*) FROM information_schema.referential_constraints
         WHERE constraint_schema = DATABASE() AND table_name = 'variant'
           AND referenced_table_name = 'product'
           AND update_rule = 'CASCADE' AND delete_rule IN ('RESTRICT', 'NO ACTION')) = 1,
        'foreign-key update/delete actions');

    CALL catalogue_test_assert(
        (SELECT COUNT(*) FROM information_schema.statistics
         WHERE table_schema = DATABASE() AND table_name = 'variant'
           AND column_name = 'product_id' AND seq_in_index = 1) = 1,
        'one supporting variant-product index');

    CALL catalogue_test_reject(
        'INSERT INTO category(category_id,parent_category_id,name) VALUES(101,101,''Self parent'')',
        1644, 'A category cannot be its own parent', 'self-parent insert');
    CALL catalogue_test_reject(
        'UPDATE category SET parent_category_id=category_id WHERE category_id=4',
        1644, 'A category cannot be its own parent', 'self-parent update');
    CALL catalogue_test_reject(
        'INSERT INTO category(parent_category_id,name) VALUES(4,''Grandchild'')',
        1644, 'Category hierarchy is limited to two levels', 'grandchild insert');
    CALL catalogue_test_reject(
        'UPDATE category SET parent_category_id=4 WHERE category_id=5',
        1644, 'Category hierarchy is limited to two levels', 'grandchild update');
    CALL catalogue_test_reject(
        'UPDATE category SET parent_category_id=2 WHERE category_id=1',
        1644, 'A category with children cannot become a child category', 'root with children cannot become child');
    CALL catalogue_test_reject(
        'INSERT INTO category(parent_category_id,name) VALUES(99999,''Missing'')',
        1452, NULL, 'missing parent');
    CALL catalogue_test_reject(
        'INSERT INTO product(sku,name) VALUES(''IPHONE-15-PRO'',''Duplicate'')',
        1062, NULL, 'duplicate SKU');
    CALL catalogue_test_reject(
        'INSERT INTO product_category(product_id,category_id) VALUES(1,4)',
        1062, NULL, 'duplicate category assignment');
    CALL catalogue_test_reject(
        'INSERT INTO variant(variant_id,product_id,price,stock_quantity) VALUES(99999,99999,1,1)',
        1452, NULL, 'orphan variant insert');
    CALL catalogue_test_reject(
        'INSERT INTO variant(variant_id,product_id,price,stock_quantity) VALUES(99999,NULL,1,1)',
        1048, NULL, 'null variant insert');
    CALL catalogue_test_reject(
        'DELETE FROM product WHERE product_id=1',
        1451, NULL, 'referenced product deletion');
    CALL catalogue_test_reject(
        'DELETE FROM category WHERE category_id=4',
        1451, NULL, 'assigned category deletion');

    SAVEPOINT before_cascade;
    UPDATE product SET product_id = 101 WHERE product_id = 1;
    CALL catalogue_test_assert(
        (SELECT COUNT(*) FROM variant WHERE product_id = 101) = 3
        AND (SELECT COUNT(*) FROM product_category WHERE product_id = 101) = 2,
        'product ID updates cascade');
    ROLLBACK TO SAVEPOINT before_cascade;

    UPDATE category SET parent_category_id = 2 WHERE category_id = 5;
    CALL catalogue_test_assert(
        (SELECT parent_category_id FROM category WHERE category_id = 5) = 2, 'valid reparenting');

    CALL catalogue_test_assert(
        (SELECT COUNT(*) FROM product WHERE product_id = 3
         AND MATCH(name, description) AGAINST('headphones')) = 1,
        'full-text index works');
    CALL catalogue_test_assert(
        (SELECT COUNT(*) FROM product p WHERE NOT EXISTS
            (SELECT 1 FROM product_category pc WHERE pc.product_id = p.product_id)
         OR NOT EXISTS (SELECT 1 FROM variant v WHERE v.product_id = p.product_id)) = 0,
        'every seeded product has a category and variant');
    CALL catalogue_test_assert(
        (SELECT COUNT(*) FROM information_schema.statistics WHERE table_schema = DATABASE()
         AND ((table_name = 'category' AND column_name = 'parent_category_id')
           OR (table_name = 'product_category' AND column_name = 'category_id'))
         AND seq_in_index = 1) = 2, 'no redundant catalogue FK indexes');

    ROLLBACK;
    SELECT CONCAT('PASS: ', @catalogue_test_passed, ' foundation assertions; test row changes rolled back.') AS summary;
END$$

DELIMITER ;

CALL catalogue_test_foundation();

DROP PROCEDURE catalogue_test_foundation;
DROP PROCEDURE catalogue_test_reject;
DROP PROCEDURE catalogue_test_assert;
SET @catalogue_test_sql = NULL;
SET @catalogue_test_passed = NULL;
