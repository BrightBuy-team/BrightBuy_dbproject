-- BrightBuy catalogue maintenance procedures (SRS 2.2.4, BR-14), MySQL 8.0.19+.
-- Install after 06. Safe to reinstall; replaces seven routines, changes no rows.
-- Writes only category, product and product_category. Variants, prices and
-- stock stay with the inventory module. Nothing here deletes a product (BR-18).
--
-- Errors: 45000 = invalid input or broken business rule, 45004 = row not found,
-- 23000 = duplicate SKU/category name or other constraint (raised by MySQL).
--
-- Single-statement routines neither start nor commit a transaction. The two
-- multi-statement routines (create product, unassign category) run their own
-- transaction, like ProcessCheckout: they commit on success and roll back on
-- any error. Do not call those two inside an open transaction, because
-- START TRANSACTION would implicitly commit the caller's pending work.
USE brightbuy;

DROP PROCEDURE IF EXISTS sp_catalogue_create_category;
DROP PROCEDURE IF EXISTS sp_catalogue_update_category;
DROP PROCEDURE IF EXISTS sp_catalogue_create_product;
DROP PROCEDURE IF EXISTS sp_catalogue_update_product;
DROP PROCEDURE IF EXISTS sp_catalogue_set_product_active;
DROP PROCEDURE IF EXISTS sp_catalogue_assign_category;
DROP PROCEDURE IF EXISTS sp_catalogue_unassign_category;

DELIMITER $$

-- Two-level hierarchy and self-parenting are enforced by the category triggers.
CREATE PROCEDURE sp_catalogue_create_category(
    IN p_name TEXT,
    IN p_description TEXT,
    IN p_parent_category_id INT,
    OUT p_category_id INT
)
SQL SECURITY INVOKER
MODIFIES SQL DATA
BEGIN
    DECLARE clean_name VARCHAR(255);
    DECLARE clean_description TEXT;
    SET p_category_id = NULL;
    SET clean_name = NULLIF(TRIM(p_name), '');
    SET clean_description = NULLIF(TRIM(p_description), '');

    IF clean_name IS NULL OR CHAR_LENGTH(clean_name) > 100 THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'category name must be 1 to 100 characters';
    END IF;
    IF CHAR_LENGTH(clean_description) > 500 THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'category description must not exceed 500 characters';
    END IF;
    IF p_parent_category_id IS NOT NULL AND NOT EXISTS (
        SELECT 1 FROM category WHERE category_id = p_parent_category_id
    ) THEN
        SIGNAL SQLSTATE '45004' SET MESSAGE_TEXT = 'Parent category not found';
    END IF;

    INSERT INTO category (parent_category_id, name, description)
    VALUES (p_parent_category_id, clean_name, clean_description);
    SET p_category_id = LAST_INSERT_ID();
END$$

-- Replaces every editable field. Deactivating a parent hides its children too.
CREATE PROCEDURE sp_catalogue_update_category(
    IN p_category_id INT,
    IN p_name TEXT,
    IN p_description TEXT,
    IN p_parent_category_id INT,
    IN p_is_active TINYINT
)
SQL SECURITY INVOKER
MODIFIES SQL DATA
BEGIN
    DECLARE clean_name VARCHAR(255);
    DECLARE clean_description TEXT;
    SET clean_name = NULLIF(TRIM(p_name), '');
    SET clean_description = NULLIF(TRIM(p_description), '');

    IF clean_name IS NULL OR CHAR_LENGTH(clean_name) > 100 THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'category name must be 1 to 100 characters';
    END IF;
    IF CHAR_LENGTH(clean_description) > 500 THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'category description must not exceed 500 characters';
    END IF;
    IF p_is_active IS NULL OR p_is_active NOT IN (0,1) THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'is_active must be 0 or 1';
    END IF;
    IF NOT EXISTS (SELECT 1 FROM category WHERE category_id = p_category_id) THEN
        SIGNAL SQLSTATE '45004' SET MESSAGE_TEXT = 'Category not found';
    END IF;
    IF p_parent_category_id IS NOT NULL AND NOT EXISTS (
        SELECT 1 FROM category WHERE category_id = p_parent_category_id
    ) THEN
        SIGNAL SQLSTATE '45004' SET MESSAGE_TEXT = 'Parent category not found';
    END IF;

    UPDATE category
    SET name = clean_name,
        description = clean_description,
        parent_category_id = p_parent_category_id,
        is_active = p_is_active
    WHERE category_id = p_category_id;
END$$

-- Creates the product and its first category together (BR-2). The product has
-- no variant yet, so the storefront keeps it hidden until inventory adds one (BR-3).
CREATE PROCEDURE sp_catalogue_create_product(
    IN p_sku TEXT,
    IN p_name TEXT,
    IN p_description TEXT,
    IN p_image_url TEXT,
    IN p_category_id INT,
    OUT p_product_id INT
)
SQL SECURITY INVOKER
MODIFIES SQL DATA
BEGIN
    DECLARE clean_sku VARCHAR(255);
    DECLARE clean_name VARCHAR(255);
    DECLARE clean_image_url TEXT;
    DECLARE EXIT HANDLER FOR SQLEXCEPTION
    BEGIN
        ROLLBACK;
        SET p_product_id = NULL;
        RESIGNAL;
    END;

    SET p_product_id = NULL;
    SET clean_sku = NULLIF(TRIM(p_sku), '');
    SET clean_name = NULLIF(TRIM(p_name), '');
    SET clean_image_url = NULLIF(TRIM(p_image_url), '');

    START TRANSACTION;

    IF clean_sku IS NULL OR NOT REGEXP_LIKE(clean_sku, '^[A-Za-z0-9][A-Za-z0-9._-]{0,49}$') THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'sku must be 1 to 50 letters, digits, dots, hyphens or underscores';
    END IF;
    IF clean_name IS NULL OR CHAR_LENGTH(clean_name) > 150 THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'product name must be 1 to 150 characters';
    END IF;
    IF CHAR_LENGTH(clean_image_url) > 500 THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'image_url must not exceed 500 characters';
    END IF;
    IF NOT EXISTS (SELECT 1 FROM category WHERE category_id = p_category_id) THEN
        SIGNAL SQLSTATE '45004' SET MESSAGE_TEXT = 'Category not found';
    END IF;

    INSERT INTO product (sku, name, description, image_url)
    VALUES (clean_sku, clean_name, NULLIF(TRIM(p_description), ''), clean_image_url);
    SET p_product_id = LAST_INSERT_ID();

    INSERT INTO product_category (product_id, category_id)
    VALUES (p_product_id, p_category_id);

    COMMIT;
END$$

-- Replaces every editable field. Use sp_catalogue_set_product_active to retire.
CREATE PROCEDURE sp_catalogue_update_product(
    IN p_product_id INT,
    IN p_sku TEXT,
    IN p_name TEXT,
    IN p_description TEXT,
    IN p_image_url TEXT
)
SQL SECURITY INVOKER
MODIFIES SQL DATA
BEGIN
    DECLARE clean_sku VARCHAR(255);
    DECLARE clean_name VARCHAR(255);
    DECLARE clean_image_url TEXT;
    SET clean_sku = NULLIF(TRIM(p_sku), '');
    SET clean_name = NULLIF(TRIM(p_name), '');
    SET clean_image_url = NULLIF(TRIM(p_image_url), '');

    IF clean_sku IS NULL OR NOT REGEXP_LIKE(clean_sku, '^[A-Za-z0-9][A-Za-z0-9._-]{0,49}$') THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'sku must be 1 to 50 letters, digits, dots, hyphens or underscores';
    END IF;
    IF clean_name IS NULL OR CHAR_LENGTH(clean_name) > 150 THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'product name must be 1 to 150 characters';
    END IF;
    IF CHAR_LENGTH(clean_image_url) > 500 THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'image_url must not exceed 500 characters';
    END IF;
    IF NOT EXISTS (SELECT 1 FROM product WHERE product_id = p_product_id) THEN
        SIGNAL SQLSTATE '45004' SET MESSAGE_TEXT = 'Product not found';
    END IF;

    UPDATE product
    SET sku = clean_sku,
        name = clean_name,
        description = NULLIF(TRIM(p_description), ''),
        image_url = clean_image_url
    WHERE product_id = p_product_id;
END$$

-- Soft retire/restore. Order history keeps its variants and product (BR-18).
CREATE PROCEDURE sp_catalogue_set_product_active(
    IN p_product_id INT,
    IN p_is_active TINYINT
)
SQL SECURITY INVOKER
MODIFIES SQL DATA
BEGIN
    IF p_is_active IS NULL OR p_is_active NOT IN (0,1) THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'is_active must be 0 or 1';
    END IF;
    IF NOT EXISTS (SELECT 1 FROM product WHERE product_id = p_product_id) THEN
        SIGNAL SQLSTATE '45004' SET MESSAGE_TEXT = 'Product not found';
    END IF;

    UPDATE product SET is_active = p_is_active WHERE product_id = p_product_id;
END$$

-- Idempotent: assigning an existing pair changes nothing.
CREATE PROCEDURE sp_catalogue_assign_category(
    IN p_product_id INT,
    IN p_category_id INT
)
SQL SECURITY INVOKER
MODIFIES SQL DATA
BEGIN
    IF NOT EXISTS (SELECT 1 FROM product WHERE product_id = p_product_id) THEN
        SIGNAL SQLSTATE '45004' SET MESSAGE_TEXT = 'Product not found';
    END IF;
    IF NOT EXISTS (SELECT 1 FROM category WHERE category_id = p_category_id) THEN
        SIGNAL SQLSTATE '45004' SET MESSAGE_TEXT = 'Category not found';
    END IF;

    INSERT INTO product_category (product_id, category_id)
    VALUES (p_product_id, p_category_id) AS new
    ON DUPLICATE KEY UPDATE category_id = new.category_id;
END$$

-- Refuses to remove a product's last category (BR-2). The product row is
-- locked so two concurrent removals cannot both pass the count check.
CREATE PROCEDURE sp_catalogue_unassign_category(
    IN p_product_id INT,
    IN p_category_id INT
)
SQL SECURITY INVOKER
MODIFIES SQL DATA
BEGIN
    DECLARE locked_product_id INT DEFAULT NULL;
    DECLARE assignment_count INT DEFAULT 0;
    DECLARE EXIT HANDLER FOR SQLEXCEPTION
    BEGIN
        ROLLBACK;
        RESIGNAL;
    END;

    START TRANSACTION;

    SELECT product_id INTO locked_product_id
    FROM product WHERE product_id = p_product_id FOR UPDATE;
    IF locked_product_id IS NULL THEN
        SIGNAL SQLSTATE '45004' SET MESSAGE_TEXT = 'Product not found';
    END IF;
    IF NOT EXISTS (
        SELECT 1 FROM product_category
        WHERE product_id = p_product_id AND category_id = p_category_id
    ) THEN
        SIGNAL SQLSTATE '45004' SET MESSAGE_TEXT = 'Product is not assigned to this category';
    END IF;

    SELECT COUNT(*) INTO assignment_count
    FROM product_category WHERE product_id = p_product_id;
    IF assignment_count <= 1 THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'A product must belong to at least one category';
    END IF;

    DELETE FROM product_category
    WHERE product_id = p_product_id AND category_id = p_category_id;

    COMMIT;
END$$

DELIMITER ;
