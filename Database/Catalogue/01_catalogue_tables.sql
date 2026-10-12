-- =========================================================
-- BrightBuy | Catalogue | 01 Tables, indexes and hierarchy triggers
-- Module owner: Mihisara LHK
-- Tables: category, product, product_category
-- Safe to rerun: existing tables are kept, triggers are replaced.
-- =========================================================

USE brightbuy;


-- ---------------------------------------------------------
-- CATEGORY
-- Supports a two-level category hierarchy.
-- A NULL parent_category_id represents a top-level category.
-- ---------------------------------------------------------

CREATE TABLE IF NOT EXISTS category (
    category_id INT AUTO_INCREMENT,
    parent_category_id INT NULL,
    name VARCHAR(100) NOT NULL,
    description VARCHAR(500) NULL,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL
        DEFAULT CURRENT_TIMESTAMP
        ON UPDATE CURRENT_TIMESTAMP,

    CONSTRAINT pk_category
        PRIMARY KEY (category_id),

    CONSTRAINT uq_category_name
        UNIQUE (name),

    INDEX idx_category_parent (parent_category_id),

    CONSTRAINT fk_category_parent
        FOREIGN KEY (parent_category_id)
        REFERENCES category(category_id)
        ON UPDATE RESTRICT
        ON DELETE RESTRICT
) ENGINE = InnoDB;


-- ---------------------------------------------------------
-- CATEGORY HIERARCHY GUARDS
-- Enforce a maximum depth of two levels: parent and child.
-- ---------------------------------------------------------

DROP TRIGGER IF EXISTS trg_category_two_levels_insert;
DROP TRIGGER IF EXISTS trg_category_not_own_parent_insert;
DROP TRIGGER IF EXISTS trg_category_two_levels_update;

DELIMITER $$

CREATE TRIGGER trg_category_two_levels_insert
BEFORE INSERT ON category
FOR EACH ROW
BEGIN
    DECLARE parent_parent_id INT DEFAULT NULL;

    IF NEW.parent_category_id IS NOT NULL THEN
        SELECT parent_category_id
        INTO parent_parent_id
        FROM category
        WHERE category_id = NEW.parent_category_id;

        IF parent_parent_id IS NOT NULL THEN
            SIGNAL SQLSTATE '45000'
                SET MESSAGE_TEXT =
                    'Category hierarchy is limited to two levels';
        END IF;
    END IF;
END$$

-- AFTER INSERT sees the assigned AUTO_INCREMENT value; BEFORE INSERT does not.
CREATE TRIGGER trg_category_not_own_parent_insert
AFTER INSERT ON category
FOR EACH ROW
BEGIN
    IF NEW.parent_category_id = NEW.category_id THEN
        SIGNAL SQLSTATE '45000'
            SET MESSAGE_TEXT = 'A category cannot be its own parent';
    END IF;
END$$

CREATE TRIGGER trg_category_two_levels_update
BEFORE UPDATE ON category
FOR EACH ROW
BEGIN
    DECLARE parent_parent_id INT DEFAULT NULL;
    DECLARE child_count INT DEFAULT 0;

    IF NEW.parent_category_id = NEW.category_id THEN
        SIGNAL SQLSTATE '45000'
            SET MESSAGE_TEXT = 'A category cannot be its own parent';
    END IF;

    IF NEW.parent_category_id IS NOT NULL THEN
        SELECT parent_category_id
        INTO parent_parent_id
        FROM category
        WHERE category_id = NEW.parent_category_id;

        IF parent_parent_id IS NOT NULL THEN
            SIGNAL SQLSTATE '45000'
                SET MESSAGE_TEXT =
                    'Category hierarchy is limited to two levels';
        END IF;

        SELECT COUNT(*)
        INTO child_count
        FROM category
        WHERE parent_category_id = OLD.category_id;

        IF child_count > 0 THEN
            SIGNAL SQLSTATE '45000'
                SET MESSAGE_TEXT =
                    'A category with children cannot become a child category';
        END IF;
    END IF;
END$$

DELIMITER ;


-- ---------------------------------------------------------
-- PRODUCT
-- Stores information shared by all product variants.
-- Price and stock belong to variant, not product.
-- ---------------------------------------------------------

CREATE TABLE IF NOT EXISTS product (
    product_id INT AUTO_INCREMENT,
    sku VARCHAR(50) NOT NULL,
    name VARCHAR(150) NOT NULL,
    description TEXT NULL,
    image_url VARCHAR(500) NULL,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL
        DEFAULT CURRENT_TIMESTAMP
        ON UPDATE CURRENT_TIMESTAMP,

    CONSTRAINT pk_product
        PRIMARY KEY (product_id),

    CONSTRAINT uq_product_sku
        UNIQUE (sku),

    -- Browse/sort by name, storefront visibility, and keyword search (CON-6).
    INDEX idx_product_name (name),
    INDEX idx_product_active_name (is_active, name),
    FULLTEXT INDEX idx_product_search (name, description)
) ENGINE = InnoDB;


-- ---------------------------------------------------------
-- PRODUCT_CATEGORY
-- Implements the many-to-many relationship between
-- product and category.
-- ---------------------------------------------------------

CREATE TABLE IF NOT EXISTS product_category (
    product_id INT NOT NULL,
    category_id INT NOT NULL,
    assigned_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT pk_product_category
        PRIMARY KEY (product_id, category_id),

    INDEX idx_product_category_category (category_id, product_id),

    CONSTRAINT fk_product_category_product
        FOREIGN KEY (product_id)
        REFERENCES product(product_id)
        ON UPDATE CASCADE
        ON DELETE CASCADE,

    CONSTRAINT fk_product_category_category
        FOREIGN KEY (category_id)
        REFERENCES category(category_id)
        ON UPDATE CASCADE
        ON DELETE RESTRICT
) ENGINE = InnoDB;
