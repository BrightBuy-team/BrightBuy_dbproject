-- =========================================================
-- Variant and Product Integration
-- Author: Kavindu Mihisara
-- =========================================================

USE brightbuy;


-- This helper procedure makes the integration rerunnable.
-- It aborts before changing the table when a variant has no product.

DROP PROCEDURE IF EXISTS apply_variant_product_integration;

DELIMITER $$

CREATE PROCEDURE apply_variant_product_integration()
BEGIN
    DECLARE orphan_count INT DEFAULT 0;
    DECLARE product_index_count INT DEFAULT 0;
    DECLARE product_fk_count INT DEFAULT 0;
    DECLARE matching_fk_count INT DEFAULT 0;
    DECLARE existing_fk_name VARCHAR(64);
    DECLARE existing_update_rule VARCHAR(30);
    DECLARE replacement_fk_name VARCHAR(64) DEFAULT 'fk_variant_product';
    DECLARE replacement_suffix INT DEFAULT 0;

    SELECT COUNT(*)
    INTO orphan_count
    FROM variant v
    LEFT JOIN product p
        ON p.product_id = v.product_id
    WHERE p.product_id IS NULL;

    IF orphan_count > 0 THEN
        SIGNAL SQLSTATE '45000'
            SET MESSAGE_TEXT =
                'Variant integration stopped: orphaned or NULL product_id values exist';
    END IF;

    -- Accept only a single-column FK with the agreed target and actions.
    SELECT COUNT(DISTINCT constraint_name)
    INTO product_fk_count
    FROM information_schema.key_column_usage
    WHERE constraint_schema = DATABASE()
      AND table_name = 'variant'
      AND column_name = 'product_id'
      AND referenced_table_name IS NOT NULL;

    SELECT COUNT(*)
    INTO matching_fk_count
    FROM (
        SELECT k.constraint_name
        FROM information_schema.key_column_usage k
        JOIN information_schema.referential_constraints r
          ON r.constraint_schema = k.constraint_schema
         AND r.constraint_name = k.constraint_name
         AND r.table_name = k.table_name
        WHERE k.constraint_schema = DATABASE()
          AND k.table_name = 'variant'
        GROUP BY k.constraint_name
        HAVING COUNT(*) = 1
           AND MAX(k.column_name) = 'product_id'
           AND MAX(k.referenced_table_schema) = DATABASE()
           AND MAX(k.referenced_table_name) = 'product'
           AND MAX(k.referenced_column_name) = 'product_id'
           AND MAX(r.update_rule) IN ('CASCADE', 'RESTRICT', 'NO ACTION')
           AND MAX(r.delete_rule) IN ('RESTRICT', 'NO ACTION')
    ) AS matching_constraints;

    IF product_fk_count <> matching_fk_count OR product_fk_count > 1 THEN
        SIGNAL SQLSTATE '45000'
            SET MESSAGE_TEXT = 'Variant integration stopped: conflicting product foreign key';
    END IF;

    -- Inventory now supplies a default restrictive FK. Upgrade only the
    -- validated single-column product FK, keeping restrictive deletion.
    IF product_fk_count = 1 THEN
        SELECT k.constraint_name, r.update_rule
        INTO existing_fk_name, existing_update_rule
        FROM information_schema.key_column_usage k
        JOIN information_schema.referential_constraints r
          ON r.constraint_schema = k.constraint_schema
         AND r.constraint_name = k.constraint_name
         AND r.table_name = k.table_name
        WHERE k.constraint_schema = DATABASE()
          AND k.table_name = 'variant'
          AND k.column_name = 'product_id'
          AND k.referenced_table_name IS NOT NULL;

        IF existing_update_rule <> 'CASCADE' THEN
            -- MySQL cannot DROP/ADD the same FK name in one ALTER. Names are
            -- schema-wide, so choose an unused name without touching other FKs.
            WHILE EXISTS (
                SELECT 1 FROM information_schema.referential_constraints
                WHERE constraint_schema = DATABASE()
                  AND constraint_name = replacement_fk_name
            ) DO
                SET replacement_suffix = replacement_suffix + 1;
                SET replacement_fk_name = CONCAT('fk_variant_product_', replacement_suffix);
            END WHILE;
            -- One ALTER replaces the FK; never disable foreign_key_checks.
            SET @catalogue_fk_ddl = CONCAT(
                'ALTER TABLE variant DROP FOREIGN KEY `',
                REPLACE(existing_fk_name, '`', '``'),
                '`, ADD CONSTRAINT `', replacement_fk_name,
                '` FOREIGN KEY (product_id) REFERENCES product(product_id)',
                ' ON UPDATE CASCADE ON DELETE RESTRICT');
            PREPARE catalogue_fk_statement FROM @catalogue_fk_ddl;
            EXECUTE catalogue_fk_statement;
            DEALLOCATE PREPARE catalogue_fk_statement;
            SET @catalogue_fk_ddl = NULL;
        END IF;
    END IF;

    SELECT COUNT(*)
    INTO product_index_count
    FROM information_schema.statistics
    WHERE table_schema = DATABASE()
      AND table_name = 'variant'
      AND column_name = 'product_id'
      AND seq_in_index = 1;

    IF product_index_count = 0 THEN
        ALTER TABLE variant
            ADD INDEX idx_variant_product (product_id);
    END IF;

    -- The inventory DDL uses nullable INT. Keep its type but require a product.
    IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = DATABASE()
          AND table_name = 'variant'
          AND column_name = 'product_id'
          AND is_nullable = 'YES'
    ) THEN
        ALTER TABLE variant MODIFY COLUMN product_id INT NOT NULL;
    END IF;

    IF product_fk_count = 0 THEN
        ALTER TABLE variant
            ADD CONSTRAINT fk_variant_product
            FOREIGN KEY (product_id)
            REFERENCES product(product_id)
            ON UPDATE CASCADE
            ON DELETE RESTRICT;
    END IF;
END$$

DELIMITER ;

CALL apply_variant_product_integration();
DROP PROCEDURE apply_variant_product_integration;
