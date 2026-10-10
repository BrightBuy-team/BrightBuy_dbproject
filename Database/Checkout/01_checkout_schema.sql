-- =========================================================
-- BrightBuy | Cart & Checkout | 01 Tables
-- Module owner: Adeesha W.G.I.
-- Tables: orders, order_item, delivery, payment
-- Run after Auth/01 (customer) and Inventory/01 (variant, city).
-- Safe to rerun: existing tables are kept.
-- =========================================================
USE brightbuy;

-- One confirmed purchase by a registered customer (BR-1).
-- delivery_mode and payment_method repeat the choice made at checkout so an
-- order can be listed without joining; delivery and payment hold the details.
CREATE TABLE IF NOT EXISTS orders (
    order_id INT AUTO_INCREMENT PRIMARY KEY,
    customer_id INT NOT NULL,
    order_date DATETIME NOT NULL,
    order_status VARCHAR(50) NOT NULL,
    total_amount DECIMAL(10,2) NOT NULL CHECK (total_amount >= 0),
    delivery_mode VARCHAR(50),
    payment_method VARCHAR(50),
    FOREIGN KEY (customer_id) REFERENCES customer(customer_id),
    INDEX idx_orders_customer_date (customer_id, order_date),
    INDEX idx_orders_status_date (order_status, order_date),
    INDEX idx_orders_date (order_date)
) ENGINE=InnoDB;

-- Order lines keep the unit price paid at purchase time (BR-13). RESTRICT
-- keeps catalogue maintenance from removing order history (SAF-6, BR-18).
-- backordered_quantity is the part of the line that was not in stock when
-- the order was placed: it was not taken from stock and follows later.
CREATE TABLE IF NOT EXISTS order_item (
    order_id INT,
    variant_id INT,
    quantity INT NOT NULL CHECK (quantity > 0),
    unit_price DECIMAL(10,2) NOT NULL CHECK (unit_price >= 0),
    backordered_quantity INT NOT NULL DEFAULT 0,
    CONSTRAINT chk_order_item_backorder CHECK (backordered_quantity BETWEEN 0 AND quantity),
    PRIMARY KEY (order_id, variant_id),
    FOREIGN KEY (order_id) REFERENCES orders(order_id) ON DELETE RESTRICT,
    FOREIGN KEY (variant_id) REFERENCES variant(variant_id) ON DELETE RESTRICT
) ENGINE=InnoDB;

-- One delivery record per order. Store pickup has no city or estimate (BR-11).
CREATE TABLE IF NOT EXISTS delivery (
    delivery_id INT AUTO_INCREMENT PRIMARY KEY,
    order_id INT NOT NULL UNIQUE,
    city_id INT,
    address_line VARCHAR(255), -- Purchase-time address; profile edits do not rewrite history.
    delivery_mode VARCHAR(50),
    est_delivery_date DATE,
    delivery_status VARCHAR(50),
    FOREIGN KEY (city_id) REFERENCES city(city_id),
    FOREIGN KEY (order_id) REFERENCES orders(order_id),
    INDEX idx_delivery_status_date (delivery_status, est_delivery_date)
) ENGINE=InnoDB;

-- One payment record per order. Cash on delivery stays Pending until paid.
-- A card payment keeps only what the gateway returns: its token, its
-- reference, the last four digits and the card type. The full card number
-- and the CVV are never stored (CON-5, SEC-2).
CREATE TABLE IF NOT EXISTS payment (
    payment_id INT AUTO_INCREMENT PRIMARY KEY,
    order_id INT NOT NULL UNIQUE,
    payment_method VARCHAR(50),
    payment_status VARCHAR(50),
    amount DECIMAL(10,2),
    payment_date DATETIME,
    gateway_token VARCHAR(64) NULL,
    gateway_reference VARCHAR(64) NULL,
    card_last_four CHAR(4) NULL,
    card_type VARCHAR(20) NULL,
    FOREIGN KEY (order_id) REFERENCES orders(order_id),
    CONSTRAINT chk_payment_card_last_four
        CHECK (card_last_four IS NULL OR card_last_four REGEXP '^[0-9]{4}$'),
    CONSTRAINT chk_payment_card_details CHECK (
        payment_method IS NULL
        OR (payment_method = 'card' AND gateway_token IS NOT NULL AND gateway_reference IS NOT NULL
            AND card_last_four IS NOT NULL AND card_type IS NOT NULL)
        OR (payment_method <> 'card' AND gateway_token IS NULL AND gateway_reference IS NULL
            AND card_last_four IS NULL AND card_type IS NULL)),
    INDEX idx_payment_status (payment_status)
) ENGINE=InnoDB;
