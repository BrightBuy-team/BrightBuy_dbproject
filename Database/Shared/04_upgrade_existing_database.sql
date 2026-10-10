-- =========================================================
-- BrightBuy | Shared | 04 Upgrade an existing database
-- For a database that already holds data (for example the shared server).
-- A fresh install never needs this script. Safe to rerun.
--
-- Run it FIRST, with application writes paused and after taking a backup,
-- then rerun the table scripts (they only add what is missing), reinstall the
-- routines and roles, and finish with Shared/05_release_checks.sql.
-- `bash Database/install_all.sh --upgrade ...` does all of that in order.
--
-- Non-destructive: it adds columns, constraints and indexes, renames the
-- former catalogue_audit table and drops routines that were replaced. It
-- never deletes rows, runs no seed and changes no price. Existing data that
-- already breaks a rule is reported and nothing is changed.
-- =========================================================
USE brightbuy;

DROP PROCEDURE IF EXISTS brightbuy_upgrade_run;
DROP PROCEDURE IF EXISTS brightbuy_upgrade_add_column;
DROP PROCEDURE IF EXISTS brightbuy_upgrade_add_index;
DROP PROCEDURE IF EXISTS brightbuy_upgrade_add_check;
DROP PROCEDURE IF EXISTS brightbuy_upgrade_existing_database;

DELIMITER $$

CREATE PROCEDURE brightbuy_upgrade_run(IN p_sql TEXT)
BEGIN
    SET @brightbuy_upgrade_sql = p_sql;
    PREPARE brightbuy_upgrade_statement FROM @brightbuy_upgrade_sql;
    EXECUTE brightbuy_upgrade_statement;
    DEALLOCATE PREPARE brightbuy_upgrade_statement;
END$$

-- Each helper does nothing when the table is absent (its table script will
-- create it complete) or when the column, index or constraint already exists.
CREATE PROCEDURE brightbuy_upgrade_add_column(IN p_table VARCHAR(64), IN p_column VARCHAR(64), IN p_definition TEXT)
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables
               WHERE table_schema = DATABASE() AND table_name = p_table)
       AND NOT EXISTS (SELECT 1 FROM information_schema.columns
                       WHERE table_schema = DATABASE() AND table_name = p_table AND column_name = p_column) THEN
        CALL brightbuy_upgrade_run(CONCAT('ALTER TABLE `', p_table, '` ADD COLUMN `', p_column, '` ', p_definition));
    END IF;
END$$

CREATE PROCEDURE brightbuy_upgrade_add_index(IN p_table VARCHAR(64), IN p_index VARCHAR(64), IN p_definition TEXT)
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables
               WHERE table_schema = DATABASE() AND table_name = p_table)
       AND NOT EXISTS (SELECT 1 FROM information_schema.statistics
                       WHERE table_schema = DATABASE() AND table_name = p_table AND index_name = p_index) THEN
        CALL brightbuy_upgrade_run(CONCAT('ALTER TABLE `', p_table, '` ADD ', p_definition));
    END IF;
END$$

CREATE PROCEDURE brightbuy_upgrade_add_check(IN p_table VARCHAR(64), IN p_constraint VARCHAR(64), IN p_definition TEXT)
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables
               WHERE table_schema = DATABASE() AND table_name = p_table)
       AND NOT EXISTS (SELECT 1 FROM information_schema.table_constraints
                       WHERE constraint_schema = DATABASE() AND table_name = p_table
                         AND constraint_name = p_constraint) THEN
        CALL brightbuy_upgrade_run(CONCAT('ALTER TABLE `', p_table, '` ADD CONSTRAINT `', p_constraint, '` ', p_definition));
    END IF;
END$$

CREATE PROCEDURE brightbuy_upgrade_existing_database()
BEGIN
    DECLARE has_variant BOOLEAN DEFAULT EXISTS (SELECT 1 FROM information_schema.tables
        WHERE table_schema = DATABASE() AND table_name = 'variant');
    DECLARE has_payment BOOLEAN DEFAULT EXISTS (SELECT 1 FROM information_schema.tables
        WHERE table_schema = DATABASE() AND table_name = 'payment');
    DECLARE has_delivery BOOLEAN DEFAULT EXISTS (SELECT 1 FROM information_schema.tables
        WHERE table_schema = DATABASE() AND table_name = 'delivery');

    -- ---- 1. Refuse to continue if existing rows already break a rule ----
    IF has_variant THEN
        IF EXISTS (SELECT 1 FROM variant WHERE price IS NULL OR stock_quantity IS NULL
                                           OR price < 0 OR stock_quantity < 0) THEN
            SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Review invalid variant price/stock before upgrading';
        END IF;
        IF EXISTS (SELECT 1 FROM variant v LEFT JOIN product p ON p.product_id = v.product_id
                   WHERE p.product_id IS NULL) THEN
            SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Review variants without a valid product before upgrading';
        END IF;
    END IF;
    IF has_payment THEN
        IF EXISTS (SELECT 1 FROM payment WHERE order_id IS NULL)
           OR EXISTS (SELECT order_id FROM payment GROUP BY order_id HAVING COUNT(*) > 1) THEN
            SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Review NULL or duplicate payment order references before upgrading';
        END IF;
        -- Card payments recorded before the gateway columns existed cannot
        -- satisfy the new card-detail rule.
        IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints
                       WHERE constraint_schema = DATABASE() AND table_name = 'payment'
                         AND constraint_name = 'chk_payment_card_details')
           AND EXISTS (SELECT 1 FROM payment WHERE payment_method = 'card') THEN
            SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Review existing card payments before adding card detail rules';
        END IF;
    END IF;
    IF has_delivery THEN
        IF EXISTS (SELECT 1 FROM delivery WHERE order_id IS NULL)
           OR EXISTS (SELECT order_id FROM delivery GROUP BY order_id HAVING COUNT(*) > 1) THEN
            SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Review NULL or duplicate delivery order references before upgrading';
        END IF;
    END IF;

    -- ---- 2. Catalogue: search and browse indexes ----
    CALL brightbuy_upgrade_add_index('product', 'idx_product_name', 'INDEX idx_product_name (name)');
    CALL brightbuy_upgrade_add_index('product', 'idx_product_active_name', 'INDEX idx_product_active_name (is_active, name)');
    CALL brightbuy_upgrade_add_index('product', 'idx_product_search', 'FULLTEXT INDEX idx_product_search (name, description)');

    -- ---- 3. Variant: required values, non-negative rules, product link ----
    IF has_variant THEN
        ALTER TABLE variant MODIFY product_id INT NOT NULL,
                            MODIFY price DECIMAL(10,2) NOT NULL,
                            MODIFY stock_quantity INT NOT NULL;
        CALL brightbuy_upgrade_add_check('variant', 'ck_variant_price_nonnegative', 'CHECK (price >= 0)');
        CALL brightbuy_upgrade_add_check('variant', 'ck_variant_stock_nonnegative', 'CHECK (stock_quantity >= 0)');
        IF NOT EXISTS (SELECT 1 FROM information_schema.key_column_usage
                       WHERE constraint_schema = DATABASE() AND table_name = 'variant'
                         AND column_name = 'product_id' AND referenced_table_name = 'product') THEN
            ALTER TABLE variant ADD CONSTRAINT fk_variant_product FOREIGN KEY (product_id)
                REFERENCES product(product_id) ON UPDATE CASCADE ON DELETE RESTRICT;
        END IF;
    END IF;

    -- ---- 4. Orders: checkout choices and report indexes ----
    CALL brightbuy_upgrade_add_column('orders', 'delivery_mode', 'VARCHAR(50) NULL');
    CALL brightbuy_upgrade_add_column('orders', 'payment_method', 'VARCHAR(50) NULL');
    CALL brightbuy_upgrade_add_index('orders', 'idx_orders_customer_date', 'INDEX idx_orders_customer_date (customer_id, order_date)');
    CALL brightbuy_upgrade_add_index('orders', 'idx_orders_status_date', 'INDEX idx_orders_status_date (order_status, order_date)');
    CALL brightbuy_upgrade_add_index('orders', 'idx_orders_date', 'INDEX idx_orders_date (order_date)');

    -- ---- 5. Delivery: purchase-time address, one row per order ----
    CALL brightbuy_upgrade_add_column('delivery', 'address_line', 'VARCHAR(255) NULL AFTER city_id');
    IF has_delivery THEN
        ALTER TABLE delivery MODIFY order_id INT NOT NULL;
        IF NOT EXISTS (SELECT 1 FROM information_schema.statistics
                       WHERE table_schema = DATABASE() AND table_name = 'delivery' AND non_unique = 0
                       GROUP BY index_name HAVING COUNT(*) = 1 AND MAX(column_name) = 'order_id') THEN
            ALTER TABLE delivery ADD UNIQUE INDEX uq_delivery_order (order_id);
        END IF;
    END IF;
    CALL brightbuy_upgrade_add_index('delivery', 'idx_delivery_status_date', 'INDEX idx_delivery_status_date (delivery_status, est_delivery_date)');

    -- ---- 6. Payment: one row per order, card details from the gateway ----
    IF has_payment THEN
        ALTER TABLE payment MODIFY order_id INT NOT NULL;
        IF NOT EXISTS (SELECT 1 FROM information_schema.statistics
                       WHERE table_schema = DATABASE() AND table_name = 'payment' AND non_unique = 0
                       GROUP BY index_name HAVING COUNT(*) = 1 AND MAX(column_name) = 'order_id') THEN
            ALTER TABLE payment ADD UNIQUE INDEX uq_payment_order (order_id);
        END IF;
    END IF;
    CALL brightbuy_upgrade_add_column('payment', 'gateway_token', 'VARCHAR(64) NULL');
    CALL brightbuy_upgrade_add_column('payment', 'gateway_reference', 'VARCHAR(64) NULL');
    CALL brightbuy_upgrade_add_column('payment', 'card_last_four', 'CHAR(4) NULL');
    CALL brightbuy_upgrade_add_column('payment', 'card_type', 'VARCHAR(20) NULL');
    CALL brightbuy_upgrade_add_check('payment', 'chk_payment_card_last_four',
        'CHECK (card_last_four IS NULL OR card_last_four REGEXP ''^[0-9]{4}$'')');
    CALL brightbuy_upgrade_add_check('payment', 'chk_payment_card_details',
        'CHECK (payment_method IS NULL
            OR (payment_method = ''card'' AND gateway_token IS NOT NULL AND gateway_reference IS NOT NULL
                AND card_last_four IS NOT NULL AND card_type IS NOT NULL)
            OR (payment_method <> ''card'' AND gateway_token IS NULL AND gateway_reference IS NULL
                AND card_last_four IS NULL AND card_type IS NULL))');
    CALL brightbuy_upgrade_add_index('payment', 'idx_payment_status', 'INDEX idx_payment_status (payment_status)');

    -- ---- 7. Audit log: the catalogue-only table became the shared one ----
    IF EXISTS (SELECT 1 FROM information_schema.tables
               WHERE table_schema = DATABASE() AND table_name = 'catalogue_audit')
       AND NOT EXISTS (SELECT 1 FROM information_schema.tables
                       WHERE table_schema = DATABASE() AND table_name = 'audit_log') THEN
        RENAME TABLE catalogue_audit TO audit_log;
    END IF;
    CALL brightbuy_upgrade_add_index('audit_log', 'idx_audit_entity', 'INDEX idx_audit_entity (entity_type, entity_id)');
    CALL brightbuy_upgrade_add_index('audit_log', 'idx_audit_changed_at', 'INDEX idx_audit_changed_at (changed_at)');
END$$

DELIMITER ;

CALL brightbuy_upgrade_existing_database();

-- Routines replaced by this release. Their successors are installed by the
-- module scripts; the audit triggers are recreated by Shared/02.
DROP PROCEDURE IF EXISTS ProcessCheckoutV2;
DROP PROCEDURE IF EXISTS sp_catalogue_create_product_with_variant;
DROP PROCEDURE IF EXISTS apply_variant_product_integration;

DROP PROCEDURE brightbuy_upgrade_existing_database;
DROP PROCEDURE brightbuy_upgrade_add_check;
DROP PROCEDURE brightbuy_upgrade_add_index;
DROP PROCEDURE brightbuy_upgrade_add_column;
DROP PROCEDURE brightbuy_upgrade_run;
SET @brightbuy_upgrade_sql = NULL;
