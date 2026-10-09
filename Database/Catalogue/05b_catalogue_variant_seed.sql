-- Additional catalogue demonstration variants, MySQL 8.0.19+.
-- Run AFTER inventory DDL/sample data and 05_variant_integration.sql.
-- Restore missing legacy fixtures 1-5 and warehouse 3; existing rows are
-- identity-checked, never overwritten. This module reserves IDs 1004-1040
-- plus 1104, 1114, 1119, 1125, 1131 and 1136 for development fixtures.
-- Prices are illustrative values, not real market prices.
-- Reruns preserve existing price/stock; mismatched identity raises an error.

USE brightbuy;

DROP PROCEDURE IF EXISTS seed_catalogue_variants;
DELIMITER $$

CREATE PROCEDURE seed_catalogue_variants()
BEGIN
    DECLARE fixture_rate DECIMAL(12,4) DEFAULT 1;
    DECLARE EXIT HANDLER FOR SQLEXCEPTION
    BEGIN
        ROLLBACK;
        DROP TEMPORARY TABLE IF EXISTS catalogue_variant_fixtures;
        RESIGNAL;
    END;

    IF EXISTS(SELECT 1 FROM information_schema.tables WHERE table_schema='brightbuy' AND table_name='currency_conversion_log') THEN
        SELECT COALESCE(MAX(lkr_per_usd),1) INTO fixture_rate
        FROM currency_conversion_log WHERE migration_key='USD_TO_LKR_V1';
    END IF;
    DROP TEMPORARY TABLE IF EXISTS catalogue_variant_fixtures;
    CREATE TEMPORARY TABLE catalogue_variant_fixtures LIKE variant;
    START TRANSACTION;

    IF EXISTS (
        SELECT 1 FROM warehouse WHERE warehouse_id = 3
          AND (NOT (name <=> 'Westside Distribution')
               OR NOT (location <=> '7700 Logistics Dr, Austin, TX'))
    ) THEN
        SIGNAL SQLSTATE '45000'
            SET MESSAGE_TEXT = 'Catalogue warehouse 3 collision: existing identity differs from fixture';
    END IF;

    INSERT INTO warehouse (warehouse_id, name, location)
    SELECT 3, 'Westside Distribution', '7700 Logistics Dr, Austin, TX'
    WHERE NOT EXISTS (SELECT 1 FROM warehouse WHERE warehouse_id = 3);

    INSERT INTO catalogue_variant_fixtures
        (variant_id, product_id, warehouse_id, variant_name, colour, memory_size, price, stock_quantity)
    VALUES
        (1, 1, 1, 'iPhone 15 Pro - Black 256GB', 'Titanium Black', '256GB', 1099.00, 50),
        (2, 1, 2, 'iPhone 15 Pro - Blue 256GB', 'Titanium Blue', '256GB', 1099.00, 15),
        (3, 1, 1, 'iPhone 15 Pro - Black 512GB', 'Titanium Black', '512GB', 1299.00, 0),
        (4, 2, 3, 'Galaxy S24 Ultra - Gray 512GB', 'Titanium Gray', '512GB', 1299.99, 30),
        (5, 3, 1, 'Sony WH-1000XM5 - Silver', 'Silver', 'N/A', 348.00, 120),
        (1004, 4, 1, 'BrightBuy Nova Phone - Black', 'Black', '128GB', 399, 15),
        (1005, 5, 2, 'BrightBuy Lite Phone - Blue', 'Blue', '64GB', 149, 18),
        (1006, 6, 3, 'BrightBuy Max Phone - Silver', 'Silver', '256GB', 599, 21),
        (1007, 7, 1, 'BrightBuy Mini Phone - Green', 'Green', '128GB', 249, 24),
        (1008, 8, 2, 'BrightBuy Plus Phone - Black', 'Black', '256GB', 699, 27),
        (1009, 9, 3, 'BrightBuy Wireless Earbuds - White', 'White', 'N/A', 49, 30),
        (1010, 10, 1, 'BrightBuy Portable Speaker - Blue', 'Blue', 'N/A', 79, 33),
        (1011, 11, 2, 'BrightBuy Soundbar - Black', 'Black', 'N/A', 129, 36),
        (1012, 12, 3, 'BrightBuy Studio Headphones - Black', 'Black', 'N/A', 89, 39),
        (1013, 13, 1, 'BrightBuy Gaming Headset - Red', 'Red', 'N/A', 59, 0),
        (1014, 14, 2, 'BrightBuy Smart Watch - Black', 'Black', 'N/A', 119, 45),
        (1015, 15, 3, 'BrightBuy Fitness Band - Purple', 'Purple', 'N/A', 39, 48),
        (1016, 16, 1, 'BrightBuy Smart Plug - White', 'White', 'N/A', 19, 51),
        (1017, 17, 2, 'BrightBuy Smart Lamp - White', 'White', 'N/A', 45, 54),
        (1018, 18, 3, 'BrightBuy Indoor Camera - White', 'White', 'N/A', 69, 57),
        (1019, 19, 1, 'BrightBuy Air Laptop - Silver', 'Silver', '512GB', 649, 60),
        (1020, 20, 2, 'BrightBuy Pro Laptop - Gray', 'Gray', '512GB', 999, 63),
        (1021, 21, 3, 'BrightBuy Gaming Laptop - Black', 'Black', '512GB', 1399, 66),
        (1022, 22, 1, 'BrightBuy Student Laptop - Blue', 'Blue', '512GB', 349, 69),
        (1023, 23, 2, 'BrightBuy Convertible Laptop - Silver', 'Silver', '512GB', 799, 72),
        (1024, 24, 3, 'BrightBuy Workstation Laptop - Gray', 'Gray', '1TB', 1899, 75),
        (1025, 25, 1, 'BrightBuy Mechanical Keyboard - Black', 'Black', 'N/A', 79, 78),
        (1026, 26, 2, 'BrightBuy Wireless Mouse - White', 'White', 'N/A', 25, 81),
        (1027, 27, 3, 'BrightBuy USB-C Hub - Gray', 'Gray', 'N/A', 39, 84),
        (1028, 28, 1, 'BrightBuy Portable SSD - Black', 'Black', '1TB', 99, 87),
        (1029, 29, 2, 'BrightBuy Desktop Monitor - Black', 'Black', 'N/A', 179, 90),
        (1030, 30, 3, 'BrightBuy Webcam - Black', 'Black', 'N/A', 49, 93),
        (1031, 31, 1, 'BrightBuy Learning Blocks - Mixed', 'Mixed', 'N/A', 29, 96),
        (1032, 32, 2, 'BrightBuy Coding Robot Kit - White', 'White', 'N/A', 89, 99),
        (1033, 33, 3, 'BrightBuy Science Activity Kit - Mixed', 'Mixed', 'N/A', 35, 102),
        (1034, 34, 1, 'BrightBuy Alphabet Puzzle - Mixed', 'Mixed', 'N/A', 15, 105),
        (1035, 35, 2, 'BrightBuy Counting Abacus - Natural', 'Natural', 'N/A', 19, 108),
        (1036, 36, 3, 'BrightBuy RC Racing Car - Red', 'Red', 'N/A', 49, 111),
        (1037, 37, 1, 'BrightBuy RC Monster Truck - Blue', 'Blue', 'N/A', 69, 114),
        (1038, 38, 2, 'BrightBuy RC Boat - White', 'White', 'N/A', 59, 0),
        (1039, 39, 3, 'BrightBuy RC Robot - Silver', 'Silver', 'N/A', 79, 1),
        (1040, 40, 1, 'BrightBuy RC Buggy - Green', 'Green', 'N/A', 39, 123),
        (1104, 4, 2, 'BrightBuy Nova Phone - Blue 256GB', 'Blue', '256GB', 449, 24),
        (1114, 14, 2, 'BrightBuy Smart Watch - Silver', 'Silver', 'N/A', 129, 18),
        (1119, 19, 3, 'BrightBuy Air Laptop - Silver 1TB', 'Silver', '1TB', 749, 12),
        (1125, 25, 2, 'BrightBuy Mechanical Keyboard - White', 'White', 'N/A', 79, 30),
        (1131, 31, 3, 'BrightBuy Learning Blocks - Pastel', 'Pastel', 'N/A', 29, 35),
        (1136, 36, 2, 'BrightBuy RC Racing Car - Blue', 'Blue', 'N/A', 49, 20);

    IF EXISTS (
        SELECT 1 FROM catalogue_variant_fixtures f
        LEFT JOIN product p ON p.product_id = f.product_id
        LEFT JOIN warehouse w ON w.warehouse_id = f.warehouse_id
        WHERE p.product_id IS NULL OR w.warehouse_id IS NULL
    ) THEN
        SIGNAL SQLSTATE '45000'
            SET MESSAGE_TEXT = 'Run catalogue product and inventory warehouse seeds first';
    END IF;

    IF EXISTS (
        SELECT 1 FROM catalogue_variant_fixtures f
        JOIN variant v ON v.variant_id = f.variant_id
        WHERE NOT (v.product_id <=> f.product_id)
           OR NOT (v.warehouse_id <=> f.warehouse_id)
           OR NOT (v.variant_name <=> f.variant_name)
           OR NOT (v.colour <=> f.colour)
           OR NOT (v.memory_size <=> f.memory_size)
    ) THEN
        SIGNAL SQLSTATE '45000'
            SET MESSAGE_TEXT = 'Catalogue variant ID collision: existing identity differs from fixture';
    END IF;

    INSERT INTO variant
        (variant_id, product_id, warehouse_id, variant_name, colour, memory_size, price, stock_quantity)
    SELECT f.variant_id, f.product_id, f.warehouse_id, f.variant_name,
           f.colour, f.memory_size, ROUND(f.price*fixture_rate,2), f.stock_quantity
    FROM catalogue_variant_fixtures f
    WHERE NOT EXISTS (SELECT 1 FROM variant v WHERE v.variant_id = f.variant_id);

    COMMIT;
    DROP TEMPORARY TABLE catalogue_variant_fixtures;
END$$

DELIMITER ;
CALL seed_catalogue_variants();
DROP PROCEDURE seed_catalogue_variants;
