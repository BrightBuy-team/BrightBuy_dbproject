INSERT INTO city (city_id, name, is_main_city) VALUES
(1, 'Houston', TRUE),
(2, 'Dallas', TRUE),
(3, 'Lubbock', FALSE),
(4, 'Waco', FALSE);

INSERT INTO warehouse (warehouse_id, name, location) VALUES
(1, 'Texas Central Depot', '100 Industrial Way, Houston, TX'),
(2, 'North Branch Storage', '4500 Tech Blvd, Dallas, TX');

-- -- Assumes Mihisara's products 1 & 2 exist
-- INSERT INTO variant (variant_id, product_id, warehouse_id, variant_name, colour, memory_size, price, stock_quantity) VALUES
-- (1, 1, 1, 'iPhone 15 Pro - Black 256GB', 'Titanium Black', '256GB', 1099.00, 50),
-- (2, 2, 2, 'Galaxy S24 Ultra - Gray 512GB', 'Titanium Gray', '512GB', 1299.99, 30);

-- -- Assumes Adeesha's orders 101 & 102 exist
-- INSERT INTO delivery (delivery_id, order_id, city_id, delivery_mode, est_delivery_date, delivery_status) VALUES
-- (1, 101, 1, 'Standard Delivery', '2026-09-23', 'Processing'),
-- (2, 102, 3, 'Standard Delivery', '2026-09-25', 'Processing');