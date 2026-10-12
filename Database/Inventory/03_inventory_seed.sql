-- =========================================================
-- BrightBuy | Inventory & Delivery | 03 Seed data (development and demonstration)
-- Module owner: Nirmal U.K.N
-- Texas cities for delivery estimates and the central warehouse that holds all stock.
-- Variant rows are seeded by Catalogue/03. Safe to rerun.
-- =========================================================
USE brightbuy;

INSERT INTO city (city_id, name, is_main_city) VALUES
    (1, 'Houston', TRUE),
    (2, 'Dallas', TRUE),
    (3, 'Lubbock', FALSE),
    (4, 'Waco', FALSE)
AS new
ON DUPLICATE KEY UPDATE name = new.name, is_main_city = new.is_main_city;

INSERT INTO warehouse (warehouse_id, name, location) VALUES
    (1, 'Central Warehouse', '100 Industrial Way, Houston, TX')
AS new
ON DUPLICATE KEY UPDATE name = new.name, location = new.location;
