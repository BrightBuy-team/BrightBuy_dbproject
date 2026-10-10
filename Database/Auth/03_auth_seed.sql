-- =========================================================
-- BrightBuy | User & Auth | 03 Seed data (development and demonstration)
-- Module owner: Atapattu D.M.
-- Run after Inventory/03 (cities 1-3). Safe to rerun.
--
-- These rows give reports and sample orders something to refer to. Their
-- password hashes are PLACEHOLDERS, so nobody can sign in as them. Real
-- accounts are created through the application: customers register, the
-- first administrator is created from the BRIGHTBUY_BOOTSTRAP_ADMIN_*
-- settings, and that administrator creates the other employees.
-- =========================================================
USE brightbuy;

INSERT INTO employee (first_name, last_name, email, password_hash, contact_no, role) VALUES
('Nimal',  'Perera',  'admin@brightbuy.com',     '$2b$10$PLACEHOLDER_HASH_ADMIN_xxxxxxxxxxxxxxxxxxxxxxxxxxxxx', '555-0101', 'Admin'),
('Kamal',  'Silva',   'warehouse@brightbuy.com', '$2b$10$PLACEHOLDER_HASH_WAREHOUSE_xxxxxxxxxxxxxxxxxxxxxxxxxx', '555-0102', 'WarehouseStaff'),
('Sunil',  'Fernando','manager@brightbuy.com',   '$2b$10$PLACEHOLDER_HASH_MANAGER_xxxxxxxxxxxxxxxxxxxxxxxxxxx', '555-0103', 'Management')
AS new
ON DUPLICATE KEY UPDATE first_name = new.first_name;

INSERT INTO customer (first_name, last_name, email, password_hash, phone, address_line, city_id) VALUES
('Abraham', 'Lincon', 'abrahaml@example.com', '$2b$10$PLACEHOLDER_HASH_CUSTOMER1_xxxxxxxxxxxxxxxxxxxxxxxxxx', '555-0199', '123 Texas Ave',  1),
('Sarah',   'Miller', 'sarahm@example.com',   '$2b$10$PLACEHOLDER_HASH_CUSTOMER2_xxxxxxxxxxxxxxxxxxxxxxxxxx', '555-0200', '45 Elm Street',   2),
('David',   'Brown',  'davidb@example.com',   '$2b$10$PLACEHOLDER_HASH_CUSTOMER3_xxxxxxxxxxxxxxxxxxxxxxxxxx', '555-0201', '9 Ranch Road',    3)
AS new
ON DUPLICATE KEY UPDATE first_name = new.first_name;
