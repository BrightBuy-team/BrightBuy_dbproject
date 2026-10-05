-- Disposable, catalogue-only test: current inventory city/warehouse/variant
-- DDL, catalogue 00-03 and inventory sample seed. No variants initially.
-- Load the definitions from 05 and 05b WITHOUT their final CALL/DROP first.
-- This suite commits fixtures and changes constraints; never use on real data.
USE brightbuy;
DROP PROCEDURE IF EXISTS bridge_assert;
DROP PROCEDURE IF EXISTS bridge_reject;
DROP PROCEDURE IF EXISTS test_inventory_bridge;
DELIMITER $$
CREATE PROCEDURE bridge_assert(IN ok BOOLEAN, IN label_text VARCHAR(100))
BEGIN
    IF ok IS NULL OR NOT ok THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = label_text;
    END IF;
    SELECT CONCAT('PASS: ', label_text) AS result;
END$$
CREATE PROCEDURE bridge_reject(IN target_name VARCHAR(20), IN expected_message VARCHAR(128))
BEGIN
    DECLARE actual_message TEXT DEFAULT '';
    DECLARE actual_state CHAR(5) DEFAULT '00000';
    BEGIN
        DECLARE CONTINUE HANDLER FOR SQLEXCEPTION
            GET DIAGNOSTICS CONDITION 1 actual_message = MESSAGE_TEXT,
                actual_state = RETURNED_SQLSTATE;
        IF target_name = 'integration' THEN
            CALL apply_variant_product_integration();
        ELSE
            CALL seed_catalogue_variants();
        END IF;
    END;
    CALL bridge_assert(actual_state = '45000' AND actual_message = expected_message,
        CONCAT('expected rejection: ', target_name));
END$$
CREATE PROCEDURE test_inventory_bridge()
BEGIN
    CALL bridge_assert((SELECT COUNT(*) = 0 FROM variant), 'fresh variant table');
    CALL bridge_assert((SELECT COUNT(*) = 2 FROM warehouse), 'two inventory warehouses');
    INSERT INTO variant (variant_id, product_id) VALUES (99999, NULL);
    CALL bridge_reject('integration',
        'Variant integration stopped: orphaned or NULL product_id values exist');
    CALL bridge_assert((SELECT is_nullable = 'YES' FROM information_schema.columns
        WHERE table_schema = DATABASE() AND table_name = 'variant' AND column_name = 'product_id'),
        'null rejection precedes DDL');
    DELETE FROM variant WHERE variant_id = 99999;
    CALL apply_variant_product_integration();
    CALL apply_variant_product_integration();
    CALL bridge_assert((SELECT COUNT(*) = 1 FROM information_schema.referential_constraints
        WHERE constraint_schema = DATABASE() AND table_name = 'variant'
          AND referenced_table_name = 'product' AND update_rule = 'CASCADE'
          AND delete_rule IN ('RESTRICT', 'NO ACTION')), 'one cascading restrictive FK after rerun');
    CALL bridge_assert((SELECT is_nullable = 'NO' FROM information_schema.columns
        WHERE table_schema = DATABASE() AND table_name = 'variant' AND column_name = 'product_id'),
        'product reference is required');
    ALTER TABLE variant ADD CONSTRAINT bridge_duplicate_product
        FOREIGN KEY (product_id) REFERENCES product(product_id)
        ON UPDATE CASCADE ON DELETE RESTRICT;
    CALL bridge_reject('integration', 'Variant integration stopped: conflicting product foreign key');
    ALTER TABLE variant DROP FOREIGN KEY bridge_duplicate_product;

    DELETE FROM warehouse WHERE warehouse_id = 2;
    CALL bridge_reject('seed', 'Run catalogue product and inventory warehouse seeds first');
    CALL bridge_assert((SELECT COUNT(*) = 0 FROM warehouse WHERE warehouse_id = 3),
        'missing dependency rolls back warehouse 3');
    INSERT INTO warehouse VALUES (2, 'North Branch Storage', '4500 Tech Blvd, Dallas, TX');
    INSERT INTO warehouse VALUES (3, 'Conflicting warehouse', 'Not the fixture');
    CALL bridge_reject('seed', 'Catalogue warehouse 3 collision: existing identity differs from fixture');
    CALL bridge_assert((SELECT name = 'Conflicting warehouse' FROM warehouse WHERE warehouse_id = 3),
        'warehouse collision remains untouched');
    DELETE FROM warehouse WHERE warehouse_id = 3;
    INSERT INTO variant (variant_id, product_id, warehouse_id, variant_name, price, stock_quantity)
        VALUES (2, 2, 2, 'Conflicting variant', 12, 7);
    CALL bridge_reject('seed', 'Catalogue variant ID collision: existing identity differs from fixture');
    CALL bridge_assert((SELECT COUNT(*) = 0 FROM warehouse WHERE warehouse_id = 3),
        'variant collision rolls back warehouse insertion');
    CALL bridge_assert((SELECT product_id = 2 AND price = 12 AND stock_quantity = 7
        FROM variant WHERE variant_id = 2), 'variant collision remains untouched');
    DELETE FROM variant WHERE variant_id = 2;

    CALL seed_catalogue_variants();
    CALL bridge_assert((SELECT COUNT(*) = 48 FROM variant), '48 variants restored');
    CALL bridge_assert((SELECT COUNT(*) = 5 FROM variant WHERE variant_id BETWEEN 1 AND 5),
        'original five variants restored');
    CALL bridge_assert((SELECT COUNT(*) = 3 FROM warehouse), 'three warehouses available');
    UPDATE variant SET price = 999.50, stock_quantity = 17 WHERE variant_id = 1;
    CALL seed_catalogue_variants();
    CALL bridge_assert((SELECT price = 999.50 AND stock_quantity = 17 FROM variant WHERE variant_id = 1),
        'rerun preserves existing price and stock');
    CALL bridge_assert((SELECT COUNT(*) = 48 FROM variant), 'rerun creates no duplicates');
    UPDATE variant SET price = 1099.00, stock_quantity = 50 WHERE variant_id = 1;
END$$
DELIMITER ;
CALL test_inventory_bridge();
DROP PROCEDURE test_inventory_bridge;
DROP PROCEDURE bridge_reject;
DROP PROCEDURE bridge_assert;
DROP PROCEDURE apply_variant_product_integration;
DROP PROCEDURE seed_catalogue_variants;
