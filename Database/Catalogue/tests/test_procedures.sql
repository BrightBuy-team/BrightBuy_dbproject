-- Milestone 3 procedure tests; run after 06 on disposable milestone-2 data.
-- Calls the real routines and inspects their JSON responses. No Python needed.
-- Row changes roll back on success or error; helper DDL commits independently.
-- Requires current inventory's enforced CHECK (stock_quantity >= 0).
USE brightbuy;
DROP PROCEDURE IF EXISTS catalogue_procedure_assert;
DROP PROCEDURE IF EXISTS catalogue_procedure_reject;
DROP PROCEDURE IF EXISTS catalogue_procedure_tests;
DELIMITER $$

CREATE PROCEDURE catalogue_procedure_assert(IN passed BOOLEAN, IN test_name VARCHAR(100))
BEGIN
    DECLARE failure_message VARCHAR(128);
    IF passed IS NULL OR passed = FALSE THEN
        SET failure_message = CONCAT('FAIL: ',test_name);
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = failure_message;
    END IF;
    SET @procedure_test_count = @procedure_test_count + 1;
    SELECT CONCAT('PASS: ',test_name) AS result;
END$$

CREATE PROCEDURE catalogue_procedure_reject(
    IN statement_text TEXT, IN expected_state CHAR(5), IN test_name VARCHAR(100)
)
BEGIN
    DECLARE actual_state CHAR(5) DEFAULT '00000';
    SET @procedure_test_sql = statement_text;
    PREPARE catalogue_procedure_statement FROM @procedure_test_sql;
    BEGIN
        DECLARE CONTINUE HANDLER FOR SQLEXCEPTION
            GET DIAGNOSTICS CONDITION 1 actual_state = RETURNED_SQLSTATE;
        EXECUTE catalogue_procedure_statement;
    END;
    DEALLOCATE PREPARE catalogue_procedure_statement;
    CALL catalogue_procedure_assert(actual_state = expected_state, test_name);
END$$

CREATE PROCEDURE catalogue_procedure_tests()
BEGIN
    DECLARE result JSON;
    DECLARE all_pages JSON;
    DECLARE page_number INT;
    DECLARE EXIT HANDLER FOR SQLEXCEPTION
    BEGIN
        ROLLBACK;
        RESIGNAL;
    END;
    SET @catalogue_fixture_rate=1;
    IF EXISTS(SELECT 1 FROM information_schema.tables WHERE table_schema='brightbuy' AND table_name='currency_conversion_log') THEN
        SELECT COALESCE(MAX(lkr_per_usd),1) INTO @catalogue_fixture_rate
        FROM currency_conversion_log WHERE migration_key='USD_TO_LKR_V1';
    END IF;
    SET @procedure_test_count = 0;
    START TRANSACTION;
    SAVEPOINT initial_state;

    CALL sp_catalogue_search(NULL, NULL, NULL, NULL, 0, 'name_asc', 1, 100, result);
    CALL catalogue_procedure_assert(JSON_EXTRACT(result, '$.total_products') = 39 AND JSON_LENGTH(JSON_EXTRACT(result, '$.items')) = 39, 'all active products once');
    CALL catalogue_procedure_assert(NOT JSON_CONTAINS(JSON_EXTRACT(result, '$.items'), JSON_OBJECT('product_id', 40)), 'inactive product hidden');
    CALL catalogue_procedure_assert(JSON_EXTRACT(result, '$.items[0].product_id') = 1, 'name ascending');

    CALL sp_catalogue_search(NULL, NULL, NULL, NULL, 0, 'name_desc', 1, 100, result);
    CALL catalogue_procedure_assert(JSON_EXTRACT(result, '$.items[0].product_id') = 3, 'name descending');

    CALL sp_catalogue_search(NULL, NULL, NULL, NULL, 0, 'price_asc', 1, 100, result);
    CALL catalogue_procedure_assert(NOT EXISTS (
    SELECT 1 FROM (
     SELECT product_id, price,
     LAG(price) OVER (ORDER BY position) AS previous_price,
     LAG(product_id) OVER (ORDER BY position) AS previous_id
     FROM JSON_TABLE(result, '$.items[*]' COLUMNS (
     position FOR ORDINALITY, product_id INT PATH '$.product_id', price DECIMAL(10,2) PATH '$.min_price'
     )) AS items
    ) AS sorted WHERE price < previous_price OR (price = previous_price AND product_id < previous_id)), 'price ascending and ID tie-break');

    CALL sp_catalogue_search(NULL, NULL, NULL, NULL, 0, 'price_desc', 1, 100, result);
    CALL catalogue_procedure_assert(NOT EXISTS (
    SELECT 1 FROM (
     SELECT product_id, price, LAG(price) OVER (ORDER BY position) AS previous_price,
     LAG(product_id) OVER (ORDER BY position) AS previous_id
     FROM JSON_TABLE(result, '$.items[*]' COLUMNS (
     position FOR ORDINALITY, product_id INT PATH '$.product_id', price DECIMAL(10,2) PATH '$.min_price'
     )) AS items
    ) AS sorted WHERE price > previous_price OR (price = previous_price AND product_id < previous_id)), 'price descending and ID tie-break');

    UPDATE product SET created_at = '2030-01-01 00:00:00' WHERE product_id = 1;
    CALL sp_catalogue_search(NULL, NULL, NULL, NULL, 0, 'newest', 1, 100, result);
    CALL catalogue_procedure_assert(JSON_EXTRACT(result, '$.items[0].product_id') = 1, 'newest sorting');

    SET all_pages = JSON_ARRAY();
    SET page_number = 1;
    WHILE page_number <= 4 DO
        CALL sp_catalogue_search(NULL,NULL,NULL,NULL,0,'name_asc',page_number,12,result);
        SET all_pages = JSON_MERGE_PRESERVE(all_pages, JSON_EXTRACT(result, '$.items'));
        SET page_number = page_number + 1;
    END WHILE;
    CALL catalogue_procedure_assert(JSON_LENGTH(all_pages) = 39 AND (SELECT COUNT(DISTINCT product_id) FROM JSON_TABLE(all_pages, '$[*]' COLUMNS (product_id INT PATH '$.product_id')) AS items) = 39, 'pagination has no missing or duplicate products');
    CALL catalogue_procedure_assert(JSON_LENGTH(JSON_EXTRACT(result,'$.items')) = 3 AND JSON_EXTRACT(result,'$.total_pages') = 4, 'last page and total pages');
    CALL sp_catalogue_search(NULL, NULL, NULL, NULL, 0, 'name_asc', 1000000, 100, result);
    CALL catalogue_procedure_assert(JSON_EXTRACT(result,'$.total_products') = 39 AND JSON_LENGTH(JSON_EXTRACT(result,'$.items')) = 0, 'far out-of-range page retains total');

    CALL sp_catalogue_search('  iPh  ', NULL, NULL, NULL, 0, 'name_asc', 1, 100, result);
    CALL catalogue_procedure_assert(JSON_EXTRACT(result,'$.total_products') = 1 AND JSON_EXTRACT(result,'$.items[0].product_id') = 1, 'trimmed case-insensitive partial keyword');

    CALL sp_catalogue_search('BB-ACC-SSD', NULL, NULL, NULL, 0, 'name_asc', 1, 100, result);
    CALL catalogue_procedure_assert(JSON_EXTRACT(result,'$.total_products') = 1 AND JSON_EXTRACT(result,'$.items[0].product_id') = 28, 'SKU keyword');

    CALL sp_catalogue_search('rc', NULL, NULL, NULL, 0, 'name_asc', 1, 100, result);
    CALL catalogue_procedure_assert(JSON_CONTAINS(JSON_EXTRACT(result,'$.items'),JSON_OBJECT('product_id',36)), 'short keyword fallback');

    CALL sp_catalogue_search('headphones', NULL, NULL, NULL, 0, 'name_asc', 1, 100, result);
    CALL catalogue_procedure_assert(JSON_CONTAINS(JSON_EXTRACT(result,'$.items'),JSON_OBJECT('product_id',3)), 'full-text keyword');

    CALL sp_catalogue_search('   ', NULL, NULL, NULL, 0, 'name_asc', 1, 100, result);
    CALL catalogue_procedure_assert(JSON_EXTRACT(result,'$.total_products') = 39, 'blank keyword means all');

    CALL sp_catalogue_search('%', NULL, NULL, NULL, 0, 'name_asc', 1, 100, result);
    CALL catalogue_procedure_assert(JSON_EXTRACT(result,'$.total_products') = 0, 'wildcard treated literally');

    CALL sp_catalogue_search('zzzzzznoresult', NULL, NULL, NULL, 0, 'name_asc', 1, 100, result);
    CALL catalogue_procedure_assert(JSON_EXTRACT(result,'$.total_pages') = 0 AND JSON_LENGTH(JSON_EXTRACT(result,'$.items')) = 0, 'no-match empty array');

    CALL sp_catalogue_search(NULL, 4, NULL, NULL, 0, 'name_asc', 1, 100, result);
    CALL catalogue_procedure_assert(JSON_EXTRACT(result,'$.total_products') = 7, 'child category');

    CALL sp_catalogue_search(NULL, 1, NULL, NULL, 0, 'name_asc', 1, 100, result);
    CALL catalogue_procedure_assert(JSON_EXTRACT(result,'$.total_products') = 18, 'root category without duplicates');

    CALL sp_catalogue_search(NULL, 2, NULL, NULL, 0, 'name_asc', 1, 100, result);
    CALL catalogue_procedure_assert(JSON_EXTRACT(result,'$.total_products') = 12, 'computer root category');

    CALL sp_catalogue_search(NULL, 3, NULL, NULL, 0, 'name_asc', 1, 100, result);
    CALL catalogue_procedure_assert(JSON_EXTRACT(result,'$.total_products') = 9, 'toy root hides inactive product');

    CALL sp_catalogue_search(NULL, 99999, NULL, NULL, 0, 'name_asc', 1, 100, result);
    CALL catalogue_procedure_assert(JSON_EXTRACT(result,'$.total_products') = 0, 'unknown category returns empty');

    DELETE FROM product_category WHERE product_id = 4 AND category_id = 1;
    CALL sp_catalogue_search(NULL, 1, NULL, NULL, 0, 'name_asc', 1, 100, result);
    CALL catalogue_procedure_assert(JSON_EXTRACT(result,'$.total_products') = 18, 'root browsing finds child-only mappings');
    ROLLBACK TO SAVEPOINT initial_state;

    CALL sp_catalogue_search(NULL, NULL, NULL, NULL, 1, 'name_asc', 1, 100, result);
    CALL catalogue_procedure_assert(JSON_EXTRACT(result,'$.total_products') = 37, 'stock filter removes completely unavailable products');
    CALL sp_catalogue_search('IPHONE-15-PRO', NULL, ROUND(1299*@catalogue_fixture_rate,2), ROUND(1299*@catalogue_fixture_rate,2), 1, 'name_asc', 1, 100, result);
    CALL catalogue_procedure_assert(JSON_EXTRACT(result,'$.total_products') = 0, 'price and stock must match the same variant');
    CALL sp_catalogue_search('IPHONE-15-PRO', NULL, ROUND(1299*@catalogue_fixture_rate,2), ROUND(1299*@catalogue_fixture_rate,2), 0, 'name_asc', 1, 100, result);
    CALL catalogue_procedure_assert(JSON_EXTRACT(result,'$.total_products') = 1 AND JSON_EXTRACT(result,'$.items[0].min_price') = ROUND(1299*@catalogue_fixture_rate,2) AND JSON_EXTRACT(result,'$.items[0].matching_variant_count') = 1, 'inclusive price bounds and matching summaries');
    CALL sp_catalogue_search('BB-PHONE-NOVA', 4, ROUND(400*@catalogue_fixture_rate,2), ROUND(500*@catalogue_fixture_rate,2), 1, 'name_asc', 1, 100, result);
    CALL catalogue_procedure_assert(JSON_EXTRACT(result,'$.total_products') = 1 AND JSON_EXTRACT(result,'$.items[0].min_price') = ROUND(449*@catalogue_fixture_rate,2) AND JSON_EXTRACT(result,'$.items[0].matching_stock_quantity') = 24, 'combined keyword category price and stock');
    CALL sp_catalogue_search(NULL, NULL, NULL, ROUND(20*@catalogue_fixture_rate,2), 0, 'name_asc', 1, 100, result);
    CALL catalogue_procedure_assert(JSON_EXTRACT(result,'$.total_products') = 3, 'maximum-only price filter');

    CALL sp_catalogue_categories(result);
    CALL catalogue_procedure_assert(JSON_LENGTH(JSON_EXTRACT(result,'$.items')) = 10, 'all active categories');
    CALL catalogue_procedure_assert(JSON_CONTAINS(JSON_EXTRACT(result,'$.items'),JSON_OBJECT('category_id',1,'product_count',18)), 'category counts deduplicate variants and assignments');
    UPDATE category SET is_active = FALSE WHERE category_id = 1;
    CALL sp_catalogue_categories(result);
    CALL catalogue_procedure_assert(JSON_LENGTH(JSON_EXTRACT(result,'$.items')) = 6, 'inactive root hides its children');
    CALL sp_catalogue_search(NULL, 4, NULL, NULL, 0, 'name_asc', 1, 100, result);
    CALL catalogue_procedure_assert(JSON_EXTRACT(result,'$.total_products') = 0, 'inactive ancestor prevents child browsing');
    CALL sp_catalogue_product_detail(1,result);
    CALL catalogue_procedure_assert(JSON_LENGTH(JSON_EXTRACT(result,'$.categories')) = 0, 'detail excludes hidden category paths');
    ROLLBACK TO SAVEPOINT initial_state;
    UPDATE category SET is_active = FALSE WHERE category_id = 4;
    CALL sp_catalogue_search(NULL, 4, NULL, NULL, 0, 'name_asc', 1, 100, result);
    CALL catalogue_procedure_assert(JSON_EXTRACT(result,'$.total_products') = 0, 'inactive category returns empty');
    ROLLBACK TO SAVEPOINT initial_state;

    CALL sp_catalogue_product_detail(1,result);
    CALL catalogue_procedure_assert(JSON_EXTRACT(result,'$.product_id') = 1 AND JSON_LENGTH(JSON_EXTRACT(result,'$.variants')) = 3, 'detail returns all product variants');
    CALL catalogue_procedure_assert(JSON_LENGTH(JSON_EXTRACT(result,'$.categories')) = 2 AND JSON_EXTRACT(result,'$.variants[0].variant_id') = 1 AND JSON_EXTRACT(result,'$.variants[2].variant_id') = 3, 'detail categories and ordered variants');
    CALL catalogue_procedure_assert(JSON_EXTRACT(result,'$.variants[2].stock_quantity') = 0, 'detail includes out-of-stock choices');
    CALL catalogue_procedure_assert(JSON_TYPE(JSON_EXTRACT(result,'$.image_url')) = 'NULL', 'missing image is JSON null');
    CALL sp_catalogue_product_detail(13,result);
    CALL catalogue_procedure_assert(JSON_EXTRACT(result,'$.variants[0].stock_quantity') = 0, 'out-of-stock product detail remains visible');
    CALL catalogue_procedure_reject('UPDATE variant SET price = NULL WHERE product_id = 1',
        '23000', 'null inventory prices rejected by NOT NULL');
    ROLLBACK TO SAVEPOINT initial_state;
    -- Invalid negatives must be rejected by the current inventory CHECK, not
    -- inserted by disabling a constraint just to exercise catalogue filtering.
    BEGIN
        DECLARE stock_errno INT DEFAULT 0;
        BEGIN
            DECLARE CONTINUE HANDLER FOR SQLEXCEPTION
                GET DIAGNOSTICS CONDITION 1 stock_errno = MYSQL_ERRNO;
            UPDATE variant SET stock_quantity = -1 WHERE product_id = 1;
        END;
        CALL catalogue_procedure_assert(stock_errno = 3819, 'negative stock rejected by CHECK');
    END;
    CALL catalogue_procedure_assert(
        (SELECT COUNT(*) FROM variant WHERE
            (variant_id = 1 AND stock_quantity = 50) OR
            (variant_id = 2 AND stock_quantity = 15) OR
            (variant_id = 3 AND stock_quantity = 0)) = 3,
        'rejected stock update leaves all product variants unchanged');
    CALL catalogue_procedure_reject('UPDATE variant SET stock_quantity = NULL WHERE product_id = 1',
        '23000', 'null inventory stock rejected by NOT NULL');
    ROLLBACK TO SAVEPOINT initial_state;

    CALL catalogue_procedure_reject('CALL sp_catalogue_search(NULL,NULL,NULL,NULL,0,''name_asc'',0,12,@rejected_result)', '45000', 'zero page');
    CALL catalogue_procedure_reject('CALL sp_catalogue_search(NULL,NULL,NULL,NULL,0,''name_asc'',NULL,12,@rejected_result)', '45000', 'null page');
    CALL catalogue_procedure_reject('CALL sp_catalogue_search(NULL,NULL,NULL,NULL,0,''name_asc'',1000001,12,@rejected_result)', '45000', 'page above bound');
    CALL catalogue_procedure_reject('CALL sp_catalogue_search(NULL,NULL,NULL,NULL,0,''name_asc'',1,0,@rejected_result)', '45000', 'zero page size');
    CALL catalogue_procedure_reject('CALL sp_catalogue_search(NULL,NULL,NULL,NULL,0,''name_asc'',1,101,@rejected_result)', '45000', 'oversized page');
    CALL catalogue_procedure_reject('CALL sp_catalogue_search(NULL,NULL,NULL,NULL,0,''name_asc'',1,NULL,@rejected_result)', '45000', 'null page size');
    CALL catalogue_procedure_reject('CALL sp_catalogue_search(NULL,0,NULL,NULL,0,''name_asc'',1,12,@rejected_result)', '45000', 'invalid category');
    CALL catalogue_procedure_reject('CALL sp_catalogue_search(NULL,NULL,-1,NULL,0,''name_asc'',1,12,@rejected_result)', '45000', 'negative minimum');
    CALL catalogue_procedure_reject('CALL sp_catalogue_search(NULL,NULL,NULL,-1,0,''name_asc'',1,12,@rejected_result)', '45000', 'negative maximum');
    CALL catalogue_procedure_reject('CALL sp_catalogue_search(NULL,NULL,100,10,0,''name_asc'',1,12,@rejected_result)', '45000', 'reversed price bounds');
    CALL catalogue_procedure_reject('CALL sp_catalogue_search(NULL,NULL,NULL,NULL,2,''name_asc'',1,12,@rejected_result)', '45000', 'invalid stock flag');
    CALL catalogue_procedure_reject('CALL sp_catalogue_search(NULL,NULL,NULL,NULL,NULL,''name_asc'',1,12,@rejected_result)', '45000', 'null stock flag');
    CALL catalogue_procedure_reject('CALL sp_catalogue_search(NULL,NULL,NULL,NULL,0,''unknown'',1,12,@rejected_result)', '45000', 'unsupported sort');
    CALL catalogue_procedure_reject('CALL sp_catalogue_search(REPEAT(''x'',256),NULL,NULL,NULL,0,''name_asc'',1,12,@rejected_result)', '45000', 'oversized keyword');
    CALL catalogue_procedure_reject('CALL sp_catalogue_product_detail(0,@rejected_result)', '45000', 'invalid detail ID');
    CALL catalogue_procedure_reject('CALL sp_catalogue_product_detail(NULL,@rejected_result)', '45000', 'null detail ID');
    CALL catalogue_procedure_reject('CALL sp_catalogue_product_detail(99999,@rejected_result)', '45004', 'missing detail');
    CALL catalogue_procedure_reject('CALL sp_catalogue_product_detail(40,@rejected_result)', '45004', 'inactive detail');
    CALL sp_catalogue_search(NULL, NULL, NULL, NULL, 0, NULL, 1, 12, result);
    CALL catalogue_procedure_assert(JSON_UNQUOTE(JSON_EXTRACT(result,'$.sort')) = 'name_asc', 'null sort default');
    CALL sp_catalogue_search(NULL, NULL, NULL, NULL, 0, ' PRICE_ASC ', 1, 12, result);
    CALL catalogue_procedure_assert(JSON_UNQUOTE(JSON_EXTRACT(result,'$.sort')) = 'price_asc', 'normalized sort');

    DELETE FROM variant WHERE product_id = 13;
    CALL catalogue_procedure_reject('CALL sp_catalogue_product_detail(13,@rejected_result)',
        '45004', 'detail without valid variants unavailable');
    ROLLBACK TO SAVEPOINT initial_state;
    UPDATE product SET is_active = FALSE;
    CALL sp_catalogue_search(NULL,NULL,NULL,NULL,0,'name_asc',1,12,result);
    CALL catalogue_procedure_assert(JSON_EXTRACT(result,'$.total_products') = 0
        AND JSON_LENGTH(JSON_EXTRACT(result,'$.items')) = 0, 'empty storefront response');
    CALL sp_catalogue_categories(result);
    CALL catalogue_procedure_assert(NOT EXISTS (
        SELECT 1 FROM JSON_TABLE(result, '$.items[*]' COLUMNS (product_count INT PATH '$.product_count')) AS items
        WHERE product_count <> 0), 'empty categories retained with zero counts');
    UPDATE category SET is_active = FALSE;
    CALL sp_catalogue_categories(result);
    CALL catalogue_procedure_assert(JSON_LENGTH(JSON_EXTRACT(result,'$.items')) = 0,
        'no active categories returns empty array');


    ROLLBACK;
    SELECT CONCAT('PASS: ',@procedure_test_count,' procedure assertions; row changes rolled back.') AS summary;
END$$
DELIMITER ;
CALL catalogue_procedure_tests();
DROP PROCEDURE catalogue_procedure_tests;
DROP PROCEDURE catalogue_procedure_reject;
DROP PROCEDURE catalogue_procedure_assert;
SET @procedure_test_sql = NULL;
SET @procedure_test_count = NULL;
SET @rejected_result = NULL;
