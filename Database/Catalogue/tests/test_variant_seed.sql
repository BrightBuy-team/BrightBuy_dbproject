-- Variant seed safety regression (MySQL 8.0.19+).
-- DISPOSABLE catalogue fixture database ONLY; no concurrent application writes.
-- First load the real seed_catalogue_variants definition as documented in README.
-- The seed commits internally: a surrounding ROLLBACK cannot undo this test.
-- Snapshot the two touched fixtures and explicitly restore them on success/error.
-- If the connection/server is lost, restoration cannot run: rebuild the test DB.
USE brightbuy;

DROP PROCEDURE IF EXISTS catalogue_seed_safety_assert;
DROP PROCEDURE IF EXISTS catalogue_seed_safety_restore;
DROP PROCEDURE IF EXISTS catalogue_seed_safety_tests;
DELIMITER $$

CREATE PROCEDURE catalogue_seed_safety_assert(IN passed BOOLEAN, IN test_name VARCHAR(100))
BEGIN
    DECLARE failure_message VARCHAR(128);
    IF passed IS NULL OR passed = FALSE THEN
        SET failure_message = CONCAT('FAIL: ', test_name);
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = failure_message;
    END IF;
    SET @seed_safety_passed = @seed_safety_passed + 1;
    SELECT CONCAT('PASS: ', test_name) AS result;
END$$

CREATE PROCEDURE catalogue_seed_safety_restore()
BEGIN
    START TRANSACTION;
    UPDATE variant v JOIN catalogue_seed_safety_backup b USING (variant_id)
    SET v.product_id=b.product_id, v.warehouse_id=b.warehouse_id,
        v.variant_name=b.variant_name, v.colour=b.colour,
        v.memory_size=b.memory_size, v.price=b.price,
        v.stock_quantity=b.stock_quantity;
    INSERT INTO variant
        (variant_id, product_id, warehouse_id, variant_name, colour, memory_size, price, stock_quantity)
    SELECT b.variant_id, b.product_id, b.warehouse_id, b.variant_name,
           b.colour, b.memory_size, b.price, b.stock_quantity
    FROM catalogue_seed_safety_backup b
    WHERE NOT EXISTS (SELECT 1 FROM variant v WHERE v.variant_id=b.variant_id);
    COMMIT;
END$$

CREATE PROCEDURE catalogue_seed_safety_tests()
BEGIN
    DECLARE backup_ready BOOLEAN DEFAULT FALSE;
    DECLARE actual_state CHAR(5) DEFAULT '00000';
    DECLARE actual_errno INT DEFAULT 0;
    DECLARE actual_message TEXT DEFAULT '';
    DECLARE EXIT HANDLER FOR SQLEXCEPTION
    BEGIN
        ROLLBACK;
        IF backup_ready THEN
            CALL catalogue_seed_safety_restore();
        END IF;
        DROP TEMPORARY TABLE IF EXISTS catalogue_seed_safety_backup;
        RESIGNAL;
    END;

    SET @seed_safety_passed = 0;
    -- Check prerequisites before any fixture mutation.
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.routines
        WHERE routine_schema='brightbuy' AND routine_name='seed_catalogue_variants'
          AND routine_type='PROCEDURE'
    ) THEN
        SIGNAL SQLSTATE '45000'
            SET MESSAGE_TEXT='Load the real variant seed procedure definition first; see tests/README.md';
    END IF;
    CALL catalogue_seed_safety_assert(
        (SELECT COUNT(*) FROM variant)=48
        AND EXISTS (SELECT 1 FROM variant WHERE variant_id=1004 AND product_id=4)
        AND EXISTS (SELECT 1 FROM variant WHERE variant_id=1040 AND product_id=40),
        'complete variant fixtures available');

    DROP TEMPORARY TABLE IF EXISTS catalogue_seed_safety_backup;
    CREATE TEMPORARY TABLE catalogue_seed_safety_backup LIKE variant;
    INSERT INTO catalogue_seed_safety_backup
        SELECT * FROM variant WHERE variant_id IN (1004,1040);
    COMMIT;
    SET backup_ready = TRUE;

    UPDATE variant SET stock_quantity=7, price=388.00 WHERE variant_id=1004;
    COMMIT;
    CALL seed_catalogue_variants();
    CALL catalogue_seed_safety_assert(
        EXISTS (SELECT 1 FROM variant WHERE variant_id=1004 AND price=388.00 AND stock_quantity=7),
        'seed preserves changed price and stock');
    CALL seed_catalogue_variants();
    CALL catalogue_seed_safety_assert(
        (SELECT COUNT(*) FROM variant)=48
        AND EXISTS (SELECT 1 FROM variant WHERE variant_id=1004 AND price=388.00 AND stock_quantity=7),
        'second rerun preserves changes without duplicates');

    UPDATE variant SET product_id=5 WHERE variant_id=1004;
    DELETE FROM variant WHERE variant_id=1040;
    COMMIT;
    BEGIN
        DECLARE CONTINUE HANDLER FOR SQLEXCEPTION
            GET DIAGNOSTICS CONDITION 1 actual_state=RETURNED_SQLSTATE,
                actual_errno=MYSQL_ERRNO, actual_message=MESSAGE_TEXT;
        CALL seed_catalogue_variants();
    END;
    CALL catalogue_seed_safety_assert(
        actual_state='45000' AND actual_errno=1644
        AND actual_message='Catalogue variant ID collision: existing identity differs from fixture',
        'identity collision raises the expected error');
    CALL catalogue_seed_safety_assert(
        EXISTS (SELECT 1 FROM variant WHERE variant_id=1004 AND product_id=5
                AND price=388.00 AND stock_quantity=7),
        'failed seed does not overwrite conflicting variant');
    CALL catalogue_seed_safety_assert(
        (SELECT COUNT(*) FROM variant)=47
        AND NOT EXISTS (SELECT 1 FROM variant WHERE variant_id=1040),
        'failed seed leaves no partial fixture insert');

    UPDATE variant SET product_id=4 WHERE variant_id=1004;
    COMMIT;
    CALL seed_catalogue_variants();
    CALL catalogue_seed_safety_assert(
        (SELECT COUNT(*) FROM variant)=48
        AND EXISTS (SELECT 1 FROM variant WHERE variant_id=1040 AND product_id=40
                    AND price=39.00 AND stock_quantity=123)
        AND EXISTS (SELECT 1 FROM variant WHERE variant_id=1004 AND price=388.00 AND stock_quantity=7),
        'corrected collision allows a successful retry');

    CALL catalogue_seed_safety_restore();
    CALL catalogue_seed_safety_assert(
        (SELECT COUNT(*) FROM variant)=48 AND NOT EXISTS (
            SELECT 1 FROM catalogue_seed_safety_backup b
            LEFT JOIN variant v USING (variant_id)
            WHERE v.variant_id IS NULL OR NOT (v.product_id <=> b.product_id)
              OR NOT (v.warehouse_id <=> b.warehouse_id)
              OR NOT (BINARY v.variant_name <=> BINARY b.variant_name)
              OR NOT (BINARY v.colour <=> BINARY b.colour)
              OR NOT (BINARY v.memory_size <=> BINARY b.memory_size)
              OR NOT (v.price <=> b.price) OR NOT (v.stock_quantity <=> b.stock_quantity)
        ), 'both changed fixtures restored to their original values');
    DROP TEMPORARY TABLE catalogue_seed_safety_backup;
    SET backup_ready = FALSE;
    SELECT CONCAT('PASS: ', @seed_safety_passed,
                  ' variant seed safety assertions; touched fixtures restored.') AS summary;
END$$
DELIMITER ;

CALL catalogue_seed_safety_tests();
DROP PROCEDURE catalogue_seed_safety_tests;
DROP PROCEDURE catalogue_seed_safety_restore;
DROP PROCEDURE catalogue_seed_safety_assert;
DROP PROCEDURE seed_catalogue_variants;
SET @seed_safety_passed = NULL;
