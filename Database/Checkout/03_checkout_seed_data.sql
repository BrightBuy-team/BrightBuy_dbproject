-- 1. Insert a City and a Customer
INSERT INTO city (name, is_main_city) VALUES ('Austin', TRUE);
-- Assuming Austin gets city_id = 1
INSERT INTO customer (first_name, last_name, email, password_hash, phone, address_line, city_id) 
VALUES ('Abraham', 'Lincon', 'abrahaml@example.com', 'hashedpwd123', '555-0199', '123 Texas Ave', 1);

-- 2. Insert a Category and a Product
INSERT INTO category (name) VALUES ('Electronics');
-- Assuming Electronics gets category_id = 1
INSERT INTO product (sku, name, description) VALUES ('TB-SMART-001', 'TechBrand', 'Latest Smartphone');
-- Assuming Product gets product_id = 1
INSERT INTO product_category (product_id, category_id) VALUES (1, 1);

-- 3. Insert Variants (This is what your checkout procedure actually interacts with)
-- Variant 1: Black, 128GB, Price $799.00, Stock: 10
INSERT INTO variant (product_id, variant_name, colour, memory_size, price, stock_quantity) 
VALUES (1, 'TechBrand Phone - Base', 'Black', '128GB', 799.00, 10);

-- Variant 2: White, 256GB, Price $899.00, Stock: 5
INSERT INTO variant (product_id, variant_name, colour, memory_size, price, stock_quantity) 
VALUES (1, 'TechBrand Phone - Pro', 'White', '256GB', 899.00, 5);