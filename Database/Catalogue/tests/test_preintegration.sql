-- Pre-integration regression: NEW DISPOSABLE instance only, no concurrent writes.
-- Requires catalogue tables/seeds + inventory DDL and ONLY its first five variants.
-- Do not install 05 or 05b first. Load the real integration helper definition
-- without its final CALL/DROP, as documented in MYSQL8_DOCKER.md.
-- This test commits fixture changes and executes DDL: ROLLBACK cannot restore
-- the starting schema. On error, stop and rebuild this disposable test instance.
USE brightbuy;
DROP PROCEDURE IF EXISTS catalogue_preintegration_assert;
DROP PROCEDURE IF EXISTS catalogue_preintegration_reject;
DROP PROCEDURE IF EXISTS catalogue_preintegration_unchanged;
DROP PROCEDURE IF EXISTS catalogue_preintegration_tests;
DELIMITER $$

CREATE PROCEDURE catalogue_preintegration_assert(IN passed BOOLEAN, IN label_text VARCHAR(100))
BEGIN
    DECLARE failure_message VARCHAR(128);
    IF passed IS NULL OR passed=FALSE THEN
        SET failure_message=CONCAT('FAIL: ', label_text);
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT=failure_message;
    END IF;
    SET @preintegration_passed=@preintegration_passed+1;
    SELECT CONCAT('PASS: ', label_text) AS result;
END$$

CREATE PROCEDURE catalogue_preintegration_reject(IN expected_message TEXT, IN label_text VARCHAR(100))
BEGIN
    DECLARE actual_state CHAR(5) DEFAULT '00000';
    DECLARE actual_errno INT DEFAULT 0;
    DECLARE actual_message TEXT DEFAULT '';
    BEGIN
        DECLARE CONTINUE HANDLER FOR SQLEXCEPTION
            GET DIAGNOSTICS CONDITION 1 actual_state=RETURNED_SQLSTATE,
                actual_errno=MYSQL_ERRNO, actual_message=MESSAGE_TEXT;
        CALL apply_variant_product_integration();
    END;
    CALL catalogue_preintegration_assert(
        actual_state='45000' AND actual_errno=1644 AND actual_message=expected_message,
        label_text);
END$$

CREATE PROCEDURE catalogue_preintegration_unchanged(IN label_text VARCHAR(100))
BEGIN
    CALL catalogue_preintegration_assert(
        EXISTS (SELECT 1 FROM information_schema.columns
                WHERE table_schema=DATABASE() AND table_name='variant'
                  AND column_name='product_id' AND is_nullable='YES')
        AND NOT EXISTS (SELECT 1 FROM information_schema.statistics
                        WHERE table_schema=DATABASE() AND table_name='variant' AND column_name='product_id')
        AND NOT EXISTS (SELECT 1 FROM information_schema.key_column_usage
                        WHERE constraint_schema=DATABASE() AND table_name='variant'
                          AND column_name='product_id' AND referenced_table_name IS NOT NULL),
        label_text);
END$$

CREATE PROCEDURE catalogue_preintegration_tests()
BEGIN
    DECLARE EXIT HANDLER FOR SQLEXCEPTION
    BEGIN
        ROLLBACK;
        RESIGNAL;
    END;
    SET @preintegration_passed=0;
    IF NOT EXISTS (SELECT 1 FROM information_schema.routines
                   WHERE routine_schema=DATABASE() AND routine_name='apply_variant_product_integration'
                     AND routine_type='PROCEDURE') THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='Load the real integration helper definition first';
    END IF;
    CALL catalogue_preintegration_assert(
        (SELECT COUNT(*) FROM variant)=5
        AND (SELECT COUNT(*) FROM variant WHERE variant_id BETWEEN 1 AND 5)=5
        AND (SELECT COUNT(*) FROM product)=40
        AND NOT EXISTS (SELECT 1 FROM product WHERE product_id=99999),
        'fresh pre-integration fixtures available');
    CALL catalogue_preintegration_unchanged('starting product column nullable with no product index or FK');

    INSERT INTO variant (variant_id, product_id) VALUES (99999, NULL);
    COMMIT;
    CALL catalogue_preintegration_reject(
        'Variant integration stopped: orphaned or NULL product_id values exist',
        'null product reference rejected');
    CALL catalogue_preintegration_unchanged('null rejection leaves product column indexes and FKs unchanged');
    CALL catalogue_preintegration_assert(
        (SELECT COUNT(*) FROM variant)=6
        AND EXISTS (SELECT 1 FROM variant WHERE variant_id=99999 AND product_id IS NULL),
        'null rejection does not remove or repair invalid row');
    DELETE FROM variant WHERE variant_id=99999;
    COMMIT;

    INSERT INTO variant (variant_id, product_id) VALUES (99999, 99999);
    COMMIT;
    CALL catalogue_preintegration_reject(
        'Variant integration stopped: orphaned or NULL product_id values exist',
        'orphan product reference rejected');
    CALL catalogue_preintegration_unchanged('orphan rejection leaves product column indexes and FKs unchanged');
    CALL catalogue_preintegration_assert(
        (SELECT COUNT(*) FROM variant)=6
        AND EXISTS (SELECT 1 FROM variant WHERE variant_id=99999 AND product_id=99999),
        'orphan rejection does not remove or repair invalid row');
    DELETE FROM variant WHERE variant_id=99999;
    COMMIT;

    ALTER TABLE variant ADD INDEX idx_preintegration_product (product_id);
    ALTER TABLE variant ADD CONSTRAINT catalogue_preintegration_wrong_fk
        FOREIGN KEY (product_id) REFERENCES product(product_id)
        ON UPDATE RESTRICT ON DELETE CASCADE;
    CALL catalogue_preintegration_reject(
        'Variant integration stopped: conflicting product foreign key',
        'incompatible product foreign key rejected');
    CALL catalogue_preintegration_assert(
        EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema=DATABASE()
                AND table_name='variant' AND column_name='product_id' AND is_nullable='YES')
        AND (SELECT COUNT(*) FROM information_schema.key_column_usage WHERE constraint_schema=DATABASE()
             AND table_name='variant' AND column_name='product_id' AND referenced_table_name IS NOT NULL)=1
        AND EXISTS (SELECT 1 FROM information_schema.referential_constraints WHERE constraint_schema=DATABASE()
                    AND table_name='variant' AND constraint_name='catalogue_preintegration_wrong_fk'
                    AND update_rule='RESTRICT' AND delete_rule='CASCADE')
        AND (SELECT COUNT(*) FROM information_schema.statistics WHERE table_schema=DATABASE()
             AND table_name='variant' AND column_name='product_id')=1
        AND EXISTS (SELECT 1 FROM information_schema.statistics WHERE table_schema=DATABASE()
                    AND table_name='variant' AND index_name='idx_preintegration_product'
                    AND column_name='product_id' AND seq_in_index=1)
        AND (SELECT COUNT(*) FROM variant)=5,
        'conflict rejection preserves nullable column existing FK index and row count');

    -- Remove only the intentionally wrong test FK; retain the supporting index.
    ALTER TABLE variant DROP FOREIGN KEY catalogue_preintegration_wrong_fk;
    CALL apply_variant_product_integration();
    CALL catalogue_preintegration_assert(
        EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema=DATABASE()
                AND table_name='variant' AND column_name='product_id' AND is_nullable='NO'),
        'corrected integration requires non-null products');
    CALL catalogue_preintegration_assert(
        (SELECT COUNT(*) FROM information_schema.key_column_usage WHERE constraint_schema=DATABASE()
             AND table_name='variant' AND column_name='product_id' AND referenced_table_name IS NOT NULL)=1
        AND EXISTS (SELECT 1 FROM information_schema.key_column_usage k
                    JOIN information_schema.referential_constraints r
                      USING (constraint_schema, constraint_name, table_name)
                    WHERE k.constraint_schema=DATABASE() AND k.table_name='variant'
                      AND k.column_name='product_id' AND k.referenced_table_schema=DATABASE()
                      AND k.referenced_table_name='product' AND k.referenced_column_name='product_id'
                      AND r.update_rule='CASCADE' AND r.delete_rule IN ('RESTRICT','NO ACTION')),
        'corrected integration creates the agreed product FK');
    CALL catalogue_preintegration_assert(
        (SELECT COUNT(*) FROM information_schema.statistics WHERE table_schema=DATABASE()
             AND table_name='variant' AND column_name='product_id' AND seq_in_index=1)=1
        AND EXISTS (SELECT 1 FROM information_schema.statistics WHERE table_schema=DATABASE()
                    AND table_name='variant' AND index_name='idx_preintegration_product'
                    AND column_name='product_id' AND seq_in_index=1),
        'corrected integration reuses the existing supporting index');
    CALL apply_variant_product_integration();
    CALL catalogue_preintegration_assert(
        (SELECT COUNT(*) FROM information_schema.key_column_usage WHERE constraint_schema=DATABASE()
             AND table_name='variant' AND column_name='product_id' AND referenced_table_name IS NOT NULL)=1
        AND (SELECT COUNT(*) FROM information_schema.statistics WHERE table_schema=DATABASE()
             AND table_name='variant' AND column_name='product_id' AND seq_in_index=1)=1
        AND EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema=DATABASE()
                    AND table_name='variant' AND column_name='product_id' AND is_nullable='NO')
        AND (SELECT COUNT(*) FROM variant)=5,
        'second successful integration adds no duplicate FK index or rows');
    SELECT CONCAT('PASS: ', @preintegration_passed,
                  ' pre-integration assertions; instance is now integrated.') AS summary;
END$$
DELIMITER ;

CALL catalogue_preintegration_tests();
DROP PROCEDURE catalogue_preintegration_tests;
DROP PROCEDURE catalogue_preintegration_unchanged;
DROP PROCEDURE catalogue_preintegration_reject;
DROP PROCEDURE catalogue_preintegration_assert;
DROP PROCEDURE apply_variant_product_integration;
SET @preintegration_passed=NULL;
