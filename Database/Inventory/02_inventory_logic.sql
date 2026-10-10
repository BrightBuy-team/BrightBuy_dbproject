-- =========================================================
-- BrightBuy | Inventory & Delivery | 02 Function, triggers and procedures
-- Module owner: Nirmal U.K.N
-- Run after Checkout/01 (the delivery function reads order_item).
-- Safe to reinstall: replaces three functions, two triggers and three procedures.
--
-- The audit triggers record the application user from @brightbuy_actor
-- (set by the backend for each request) or the database account otherwise.
-- Procedure errors: 45000 = invalid input, 45004 = row not found.
-- =========================================================
USE brightbuy;

DROP FUNCTION IF EXISTS fn_delivery_days;
DROP FUNCTION IF EXISTS fn_delivery_preview_date;
DROP FUNCTION IF EXISTS calculate_delivery_date;
DROP TRIGGER IF EXISTS after_variant_insert;
DROP TRIGGER IF EXISTS after_variant_update;
DROP PROCEDURE IF EXISTS sp_inventory_set_stock;
DROP PROCEDURE IF EXISTS sp_inventory_create_variant;
DROP PROCEDURE IF EXISTS sp_inventory_update_variant;

DELIMITER //

-- The delivery rule in one place (BR-8): 5 days for a main Texas city, 7 for
-- any other city (AS-5), plus 3 days when an item is out of stock.
CREATE FUNCTION fn_delivery_days(p_city_id INT, p_out_of_stock BOOLEAN)
RETURNS INT
NOT DETERMINISTIC
READS SQL DATA
BEGIN
    DECLARE v_is_main_city BOOLEAN DEFAULT FALSE;

    SELECT COALESCE(is_main_city, FALSE) INTO v_is_main_city FROM city WHERE city_id = p_city_id;

    RETURN IF(v_is_main_city, 5, 7) + IF(COALESCE(p_out_of_stock, FALSE), 3, 0);
END //

-- Estimate shown before ordering (UI-8): destination city plus the current
-- stock of the cart's variants, given as a JSON array of variant IDs.
-- Returns NULL for an unknown city.
CREATE FUNCTION fn_delivery_preview_date(p_city_id INT, p_variant_ids JSON)
RETURNS DATE
NOT DETERMINISTIC
READS SQL DATA
BEGIN
    DECLARE v_out_of_stock BOOLEAN DEFAULT FALSE;

    IF NOT EXISTS (SELECT 1 FROM city WHERE city_id = p_city_id) THEN
        RETURN NULL;
    END IF;
    IF p_variant_ids IS NOT NULL AND JSON_TYPE(p_variant_ids) = 'ARRAY' THEN
        SELECT COUNT(*) > 0 INTO v_out_of_stock
        FROM JSON_TABLE(p_variant_ids, '$[*]' COLUMNS (variant_id INT PATH '$')) j
        JOIN variant v ON v.variant_id = j.variant_id
        WHERE v.stock_quantity <= 0;
    END IF;

    RETURN DATE_ADD(CURDATE(), INTERVAL fn_delivery_days(p_city_id, v_out_of_stock) DAY);
END //

-- Estimate for an existing order, from today, using current stock.
CREATE FUNCTION calculate_delivery_date(p_city_id INT, p_order_id INT)
RETURNS DATE
NOT DETERMINISTIC
READS SQL DATA
BEGIN
    DECLARE v_out_of_stock BOOLEAN DEFAULT FALSE;

    SELECT COUNT(*) > 0 INTO v_out_of_stock
    FROM order_item oi
    JOIN variant v ON oi.variant_id = v.variant_id
    WHERE oi.order_id = p_order_id AND v.stock_quantity <= 0;

    RETURN DATE_ADD(CURDATE(), INTERVAL fn_delivery_days(p_city_id, v_out_of_stock) DAY);
END //

-- Stock audit (SAF-7): the opening stock of a new variant.
CREATE TRIGGER after_variant_insert
AFTER INSERT ON variant
FOR EACH ROW
BEGIN
    INSERT INTO variant_audit (variant_id, old_stock_quantity, new_stock_quantity, changed_by)
    VALUES (NEW.variant_id, NULL, NEW.stock_quantity, COALESCE(@brightbuy_actor, USER()));
END //

-- Stock audit (SAF-7): every later change, including checkout decrements.
CREATE TRIGGER after_variant_update
AFTER UPDATE ON variant
FOR EACH ROW
BEGIN
    IF OLD.stock_quantity != NEW.stock_quantity THEN
        INSERT INTO variant_audit (variant_id, old_stock_quantity, new_stock_quantity, changed_by)
        VALUES (NEW.variant_id, OLD.stock_quantity, NEW.stock_quantity, COALESCE(@brightbuy_actor, USER()));
    END IF;
END //

-- Warehouse staff set the counted stock of one variant.
CREATE PROCEDURE sp_inventory_set_stock(IN p_variant_id INT, IN p_quantity INT)
MODIFIES SQL DATA
BEGIN
    IF p_quantity IS NULL OR p_quantity < 0 THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'stock quantity must be zero or more';
    END IF;
    IF NOT EXISTS (SELECT 1 FROM variant WHERE variant_id = p_variant_id) THEN
        SIGNAL SQLSTATE '45004' SET MESSAGE_TEXT = 'Variant not found';
    END IF;

    UPDATE variant SET stock_quantity = p_quantity WHERE variant_id = p_variant_id;
END //

-- Adds a further variant (colour, memory size) to an existing product.
CREATE PROCEDURE sp_inventory_create_variant(
    IN  p_product_id   INT,
    IN  p_warehouse_id INT,
    IN  p_variant_name VARCHAR(255),
    IN  p_colour       VARCHAR(255),
    IN  p_memory_size  VARCHAR(255),
    IN  p_price        DECIMAL(10,2),
    IN  p_stock        INT,
    OUT p_variant_id   INT
)
MODIFIES SQL DATA
BEGIN
    DECLARE v_name VARCHAR(255) DEFAULT NULLIF(TRIM(p_variant_name), '');
    DECLARE v_colour VARCHAR(255) DEFAULT NULLIF(TRIM(p_colour), '');
    DECLARE v_memory VARCHAR(255) DEFAULT NULLIF(TRIM(p_memory_size), '');
    SET p_variant_id = NULL;

    IF v_name IS NULL OR CHAR_LENGTH(v_name) > 100 THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'variant name must be 1 to 100 characters';
    END IF;
    IF CHAR_LENGTH(v_colour) > 50 OR CHAR_LENGTH(v_memory) > 50 THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'colour and memory size must not exceed 50 characters';
    END IF;
    IF p_price IS NULL OR p_price <= 0 THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'variant price must be greater than zero';
    END IF;
    IF p_stock IS NULL OR p_stock < 0 THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'stock quantity must be zero or more';
    END IF;
    IF NOT EXISTS (SELECT 1 FROM product WHERE product_id = p_product_id) THEN
        SIGNAL SQLSTATE '45004' SET MESSAGE_TEXT = 'Product not found';
    END IF;
    IF p_warehouse_id IS NOT NULL AND NOT EXISTS (
        SELECT 1 FROM warehouse WHERE warehouse_id = p_warehouse_id
    ) THEN
        SIGNAL SQLSTATE '45004' SET MESSAGE_TEXT = 'Warehouse not found';
    END IF;

    INSERT INTO variant (product_id, warehouse_id, variant_name, colour, memory_size, price, stock_quantity)
    VALUES (p_product_id, p_warehouse_id, v_name, v_colour, v_memory, p_price, p_stock);
    SET p_variant_id = LAST_INSERT_ID();
END //

-- Changes the description and price of a variant. Stock has its own routine,
-- and past orders keep the unit price they were bought at (BR-13).
CREATE PROCEDURE sp_inventory_update_variant(
    IN p_variant_id   INT,
    IN p_variant_name VARCHAR(255),
    IN p_colour       VARCHAR(255),
    IN p_memory_size  VARCHAR(255),
    IN p_price        DECIMAL(10,2)
)
MODIFIES SQL DATA
BEGIN
    DECLARE v_name VARCHAR(255) DEFAULT NULLIF(TRIM(p_variant_name), '');
    DECLARE v_colour VARCHAR(255) DEFAULT NULLIF(TRIM(p_colour), '');
    DECLARE v_memory VARCHAR(255) DEFAULT NULLIF(TRIM(p_memory_size), '');

    IF v_name IS NULL OR CHAR_LENGTH(v_name) > 100 THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'variant name must be 1 to 100 characters';
    END IF;
    IF CHAR_LENGTH(v_colour) > 50 OR CHAR_LENGTH(v_memory) > 50 THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'colour and memory size must not exceed 50 characters';
    END IF;
    IF p_price IS NULL OR p_price <= 0 THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'variant price must be greater than zero';
    END IF;
    IF NOT EXISTS (SELECT 1 FROM variant WHERE variant_id = p_variant_id) THEN
        SIGNAL SQLSTATE '45004' SET MESSAGE_TEXT = 'Variant not found';
    END IF;

    UPDATE variant
    SET variant_name = v_name, colour = v_colour, memory_size = v_memory, price = p_price
    WHERE variant_id = p_variant_id;
END //

DELIMITER ;
