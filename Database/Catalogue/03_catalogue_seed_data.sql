-- =========================================================
-- BrightBuy Catalogue Seed Data
-- Author: Kavindu Mihisara
-- =========================================================

USE brightbuy;

-- Run with a client that stops on errors. Disconnect/ROLLBACK on failure.
START TRANSACTION;

-- ---------------------------------------------------------
-- Top-level categories
-- ---------------------------------------------------------

INSERT INTO category (
    category_id,
    parent_category_id,
    name,
    description
) VALUES
    (1, NULL, 'Electronics', 'Consumer electronic products'),
    (2, NULL, 'Computers', 'Computers and related devices'),
    (3, NULL, 'Toys', 'Toys and recreational products')
AS new
ON DUPLICATE KEY UPDATE
    parent_category_id = new.parent_category_id,
    name = new.name,
    description = new.description,
    is_active = TRUE;


-- ---------------------------------------------------------
-- Child categories
-- ---------------------------------------------------------

INSERT INTO category (
    category_id,
    parent_category_id,
    name,
    description
) VALUES
    (4, 1, 'Mobile Phones', 'Smartphones and mobile phones'),
    (5, 1, 'Audio Devices', 'Headphones, speakers and audio equipment'),
    (6, 1, 'Smart Devices', 'Smart watches and connected devices'),
    (7, 2, 'Laptops', 'Portable computers'),
    (8, 2, 'Computer Accessories', 'Computer accessories and peripherals'),
    (9, 3, 'Educational Toys', 'Learning and educational toys'),
    (10, 3, 'Remote Controlled Toys', 'Remote-controlled toys')
AS new
ON DUPLICATE KEY UPDATE
    parent_category_id = new.parent_category_id,
    name = new.name,
    description = new.description,
    is_active = TRUE;


-- ---------------------------------------------------------
-- Products 1-3 match ../Inventory & Delivery/Inventory_Delivery_sample_data.sql.
-- Products 4-40 are fictional BrightBuy demonstration fixtures.
-- Keep these IDs stable: variants and category mappings depend on them.
-- ---------------------------------------------------------

INSERT INTO product (
    product_id,
    sku,
    name,
    description,
    image_url
) VALUES
    (
        1,
        'IPHONE-15-PRO',
        'Apple iPhone 15 Pro',
        'Apple smartphone available in 256GB and 512GB variants',
        NULL
    ),
    (
        2,
        'GALAXY-S24-ULTRA',
        'Samsung Galaxy S24 Ultra',
        'Samsung smartphone available in a 512GB variant',
        NULL
    ),
    (
        3,
        'SONY-WH-1000XM5',
        'Sony WH-1000XM5',
        'Wireless noise-cancelling over-ear headphones',
        NULL
    ),
    (4, 'BB-PHONE-NOVA', 'BrightBuy Nova Phone', 'Everyday smartphone with a 128GB storage option', NULL),
    (5, 'BB-PHONE-LITE', 'BrightBuy Lite Phone', 'Compact smartphone for calls messaging and web browsing', NULL),
    (6, 'BB-PHONE-MAX', 'BrightBuy Max Phone', 'Large-screen smartphone for entertainment and everyday use', NULL),
    (7, 'BB-PHONE-MINI', 'BrightBuy Mini Phone', 'Small smartphone designed for one-handed use', NULL),
    (8, 'BB-PHONE-PLUS', 'BrightBuy Plus Phone', 'Smartphone with generous storage for photos and applications', NULL),
    (9, 'BB-AUDIO-BUDS', 'BrightBuy Wireless Earbuds', 'Compact wireless earbuds with a charging case', NULL),
    (10, 'BB-AUDIO-SPEAKER', 'BrightBuy Portable Speaker', 'Portable wireless speaker for indoor and outdoor listening', NULL),
    (11, 'BB-AUDIO-SOUNDBAR', 'BrightBuy Soundbar', 'TV soundbar for dialogue music and movies', NULL),
    (12, 'BB-AUDIO-STUDIO', 'BrightBuy Studio Headphones', 'Wired over-ear headphones for music and audio monitoring', NULL),
    (13, 'BB-AUDIO-HEADSET', 'BrightBuy Gaming Headset', 'Gaming headset with an adjustable microphone', NULL),
    (14, 'BB-SMART-WATCH', 'BrightBuy Smart Watch', 'Smart watch with activity tracking and notification display', NULL),
    (15, 'BB-SMART-BAND', 'BrightBuy Fitness Band', 'Lightweight fitness band for daily activity tracking', NULL),
    (16, 'BB-SMART-PLUG', 'BrightBuy Smart Plug', 'Connected plug for scheduling household devices', NULL),
    (17, 'BB-SMART-LAMP', 'BrightBuy Smart Lamp', 'Adjustable smart desk lamp with selectable light levels', NULL),
    (18, 'BB-SMART-CAMERA', 'BrightBuy Indoor Camera', 'Connected indoor camera for home monitoring', NULL),
    (19, 'BB-LAPTOP-AIR', 'BrightBuy Air Laptop', 'Lightweight laptop for documents browsing and study', NULL),
    (20, 'BB-LAPTOP-PRO', 'BrightBuy Pro Laptop', 'Laptop for programming multitasking and office work', NULL),
    (21, 'BB-LAPTOP-GAME', 'BrightBuy Gaming Laptop', 'Laptop for gaming and creative projects', NULL),
    (22, 'BB-LAPTOP-STUDY', 'BrightBuy Student Laptop', 'Entry-level laptop for lessons assignments and video calls', NULL),
    (23, 'BB-LAPTOP-FLEX', 'BrightBuy Convertible Laptop', 'Convertible laptop for typing and touch-based work', NULL),
    (24, 'BB-LAPTOP-WORK', 'BrightBuy Workstation Laptop', 'Laptop for demanding design and development workloads', NULL),
    (25, 'BB-ACC-KEYBOARD', 'BrightBuy Mechanical Keyboard', 'Mechanical keyboard for work and gaming', NULL),
    (26, 'BB-ACC-MOUSE', 'BrightBuy Wireless Mouse', 'Wireless mouse for laptop and desktop use', NULL),
    (27, 'BB-ACC-HUB', 'BrightBuy USB-C Hub', 'Multiport USB-C hub for connecting desktop accessories', NULL),
    (28, 'BB-ACC-SSD', 'BrightBuy Portable SSD', 'Portable solid-state drive for file backups and transfers', NULL),
    (29, 'BB-ACC-MONITOR', 'BrightBuy Desktop Monitor', 'Desktop monitor for study productivity and entertainment', NULL),
    (30, 'BB-ACC-WEBCAM', 'BrightBuy Webcam', 'USB webcam for meetings and remote lessons', NULL),
    (31, 'BB-EDU-BLOCKS', 'BrightBuy Learning Blocks', 'Building blocks for creative play and shape recognition', NULL),
    (32, 'BB-EDU-ROBOT', 'BrightBuy Coding Robot Kit', 'Educational robot kit for introductory programming activities', NULL),
    (33, 'BB-EDU-SCIENCE', 'BrightBuy Science Activity Kit', 'Educational kit for supervised science activities', NULL),
    (34, 'BB-EDU-PUZZLE', 'BrightBuy Alphabet Puzzle', 'Alphabet puzzle for early letter recognition', NULL),
    (35, 'BB-EDU-ABACUS', 'BrightBuy Counting Abacus', 'Counting abacus for practising arithmetic', NULL),
    (36, 'BB-RC-CAR', 'BrightBuy RC Racing Car', 'Remote-controlled toy car for racing activities', NULL),
    (37, 'BB-RC-TRUCK', 'BrightBuy RC Monster Truck', 'Remote-controlled toy truck with large wheels', NULL),
    (38, 'BB-RC-BOAT', 'BrightBuy RC Boat', 'Remote-controlled toy boat for suitable supervised water play', NULL),
    (39, 'BB-RC-ROBOT', 'BrightBuy RC Robot', 'Remote-controlled toy robot with movement controls', NULL),
    (40, 'BB-RC-BUGGY', 'BrightBuy RC Buggy', 'Retired remote-controlled toy buggy retained for inactive-product tests', NULL)
AS new
ON DUPLICATE KEY UPDATE
    sku = new.sku,
    name = new.name,
    description = new.description,
    image_url = new.image_url,
    is_active = TRUE;

-- One inactive product exercises catalogue visibility; the other 39 are active.
UPDATE product SET is_active = FALSE WHERE product_id = 40;

-- ---------------------------------------------------------
-- Product-category assignments
-- Remove mappings created by the earlier placeholder seed so
-- rerunning this corrected seed does not retain bad categories.
-- ---------------------------------------------------------

DELETE FROM product_category
WHERE (product_id = 2 AND category_id IN (2, 7))
   OR (product_id = 3 AND category_id IN (3, 9));


-- Ignore only duplicate assignments, not invalid data or foreign-key errors.

INSERT INTO product_category (
    product_id,
    category_id
) VALUES
    (1, 4),
    (1, 1),
    (2, 4),
    (2, 1),
    (3, 5),
    (3, 1),
    (4, 4), (4, 1),
    (5, 4), (5, 1),
    (6, 4), (6, 1),
    (7, 4), (7, 1),
    (8, 4), (8, 1),
    (9, 5), (9, 1),
    (10, 5), (10, 1),
    (11, 5), (11, 1),
    (12, 5), (12, 1),
    (13, 5), (13, 1),
    (14, 6), (14, 1),
    (15, 6), (15, 1),
    (16, 6), (16, 1),
    (17, 6), (17, 1),
    (18, 6), (18, 1),
    (19, 7), (19, 2),
    (20, 7), (20, 2),
    (21, 7), (21, 2),
    (22, 7), (22, 2),
    (23, 7), (23, 2),
    (24, 7), (24, 2),
    (25, 8), (25, 2),
    (26, 8), (26, 2),
    (27, 8), (27, 2),
    (28, 8), (28, 2),
    (29, 8), (29, 2),
    (30, 8), (30, 2),
    (31, 9), (31, 3),
    (32, 9), (32, 3),
    (33, 9), (33, 3),
    (34, 9), (34, 3),
    (35, 9), (35, 3),
    (36, 10), (36, 3),
    (37, 10), (37, 3),
    (38, 10), (38, 3),
    (39, 10), (39, 3),
    (40, 10), (40, 3)
AS new
ON DUPLICATE KEY UPDATE
    category_id = new.category_id;

COMMIT;
