-- =========================================================
-- BrightBuy | Cart & Checkout | 03 Seed data (development and demonstration)
-- Module owner: Adeesha W.G.I.
-- Run after the auth seed (customers 1-3) and the variant seed (variants 1-2).
-- Sample orders so the reports have data: delivered and pickup orders, a
-- cancelled order and one card payment. They do not change variant stock.
-- Unit prices are purchase-time values and need not equal today's prices.
-- Safe to rerun.
-- =========================================================
USE brightbuy;

INSERT INTO orders (order_id, customer_id, order_date, order_status, total_amount, delivery_mode, payment_method)
VALUES (101, 1, DATE_SUB(NOW(), INTERVAL 2 DAY), 'Confirmed', 799.00, 'delivery', 'cod'),
       (102, 2, DATE_SUB(NOW(), INTERVAL 1 DAY), 'Confirmed', 899.00, 'pickup', 'cod'),
       (103, 3, NOW(), 'Confirmed', 1598.00, 'delivery', 'cod'),
       (104, 1, NOW(), 'Cancelled', 799.00, 'delivery', 'cod'),
       (105, 2, NOW(), 'Confirmed', 899.00, 'pickup', 'card')
AS new
ON DUPLICATE KEY UPDATE order_id = new.order_id;

INSERT INTO order_item (order_id, variant_id, quantity, unit_price)
VALUES (101, 1, 1, 799.00), (102, 2, 1, 899.00), (103, 1, 2, 799.00), (104, 1, 1, 799.00), (105, 2, 1, 899.00)
AS new
ON DUPLICATE KEY UPDATE quantity = new.quantity;

INSERT INTO delivery (order_id, city_id, address_line, delivery_mode, est_delivery_date, delivery_status)
VALUES (101, 1, '101 Fictional Houston Street', 'delivery', DATE_ADD(CURDATE(), INTERVAL 3 DAY), 'Pending'),
       (102, NULL, NULL, 'pickup', NULL, 'Pending'),
       (103, 3, '103 Fictional Lubbock Street', 'delivery', DATE_ADD(CURDATE(), INTERVAL 7 DAY), 'Pending'),
       (104, 1, '104 Fictional Houston Street', 'delivery', NULL, 'Cancelled'),
       (105, NULL, NULL, 'pickup', NULL, 'Pending')
AS new
ON DUPLICATE KEY UPDATE order_id = new.order_id;

INSERT INTO payment (order_id, payment_method, payment_status, amount, payment_date,
                     gateway_token, gateway_reference, card_last_four, card_type)
VALUES (101, 'cod', 'Pending', 799, NULL, NULL, NULL, NULL, NULL),
       (102, 'cod', 'Pending', 899, NULL, NULL, NULL, NULL, NULL),
       (103, 'cod', 'Pending', 1598, NULL, NULL, NULL, NULL, NULL),
       (104, 'cod', 'Cancelled', 799, NULL, NULL, NULL, NULL, NULL),
       (105, 'card', 'Paid', 899, NOW(), 'tok_seed_example', 'SIM-SEED-EXAMPLE', '4242', 'Visa')
AS new
ON DUPLICATE KEY UPDATE order_id = new.order_id;
