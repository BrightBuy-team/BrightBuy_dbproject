-- =========================================================
-- BrightBuy | Inventory & Delivery | 01 Tables
-- Module owner: Nirmal U.K.N
-- Tables: city, warehouse, variant, variant_audit
-- Run after Catalogue/01 (variant references product).
-- Safe to rerun: existing tables are kept.
-- The delivery table belongs to Checkout because it references orders.
-- =========================================================
USE brightbuy;

-- Texas destinations. Main cities get the shorter delivery estimate (BR-8).
CREATE TABLE IF NOT EXISTS city (
    city_id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(100),
    is_main_city BOOLEAN
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS warehouse (
    warehouse_id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(100),
    location VARCHAR(255)
) ENGINE=InnoDB;

-- A purchasable configuration of a product. Price and stock live here (BR-4).
-- Stock can never go below zero (CON-4, BR-10). A product that has variants
-- cannot be deleted (SAF-6): products are retired instead.
CREATE TABLE IF NOT EXISTS variant (
    variant_id INT AUTO_INCREMENT PRIMARY KEY,
    product_id INT NOT NULL,
    warehouse_id INT,
    variant_name VARCHAR(100),
    colour VARCHAR(50),
    memory_size VARCHAR(50),
    price DECIMAL(10,2) NOT NULL CONSTRAINT ck_variant_price_nonnegative CHECK (price >= 0),
    stock_quantity INT NOT NULL CONSTRAINT ck_variant_stock_nonnegative CHECK (stock_quantity >= 0),
    FOREIGN KEY (warehouse_id) REFERENCES warehouse(warehouse_id),
    CONSTRAINT fk_variant_product FOREIGN KEY (product_id) REFERENCES product(product_id)
        ON UPDATE CASCADE ON DELETE RESTRICT
) ENGINE=InnoDB;

-- Every change to variant stock (SAF-7): who, when, old and new value.
CREATE TABLE IF NOT EXISTS variant_audit (
    audit_id INT AUTO_INCREMENT PRIMARY KEY,
    variant_id INT,
    old_stock_quantity INT,
    new_stock_quantity INT,
    changed_by VARCHAR(100),
    changed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (variant_id) REFERENCES variant(variant_id)
) ENGINE=InnoDB;
