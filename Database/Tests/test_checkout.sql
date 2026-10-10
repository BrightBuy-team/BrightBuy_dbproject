-- =========================================================
-- BrightBuy | Tests | Checkout: quote, atomic order placement, card and COD
-- Run on a disposable database after a fresh install (install_all.sh), as an
-- administrator, with no other writers. Prints PASS per assertion; a failure
-- raises SQLSTATE 45000 and stops.
-- ProcessCheckout commits its own transaction, so this suite cannot roll
-- back: it uses its own TEST-CHECKOUT products and customer and removes them.
-- =========================================================
USE brightbuy;
DROP PROCEDURE IF EXISTS checkout_test_assert;
DROP PROCEDURE IF EXISTS checkout_test_reject;
DROP PROCEDURE IF EXISTS checkout_test_cleanup;
DROP PROCEDURE IF EXISTS checkout_tests;
DELIMITER $$

CREATE PROCEDURE checkout_test_assert(IN passed BOOLEAN, IN test_name VARCHAR(100))
BEGIN
    DECLARE failure_message VARCHAR(128);
    IF passed IS NULL OR passed = FALSE THEN
        SET failure_message = CONCAT('FAIL: ', test_name);
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = failure_message;
    END IF;
    SET @checkout_test_count = @checkout_test_count + 1;
    SELECT CONCAT('PASS: ', test_name) AS result;
END$$

CREATE PROCEDURE checkout_test_reject(IN statement_text TEXT, IN expected_state CHAR(5), IN test_name VARCHAR(100))
BEGIN
    DECLARE actual_state CHAR(5) DEFAULT '00000';
    SET @checkout_test_sql = statement_text;
    PREPARE checkout_test_statement FROM @checkout_test_sql;
    BEGIN
        DECLARE CONTINUE HANDLER FOR SQLEXCEPTION
            GET DIAGNOSTICS CONDITION 1 actual_state = RETURNED_SQLSTATE;
        EXECUTE checkout_test_statement;
    END;
    DEALLOCATE PREPARE checkout_test_statement;
    CALL checkout_test_assert(actual_state = expected_state, test_name);
END$$

CREATE PROCEDURE checkout_test_cleanup()
BEGIN
    DELETE FROM email_outbox WHERE recipient = 'checkout-test@example.invalid';
    DELETE i FROM order_item i JOIN orders o ON o.order_id = i.order_id
        JOIN customer c ON c.customer_id = o.customer_id WHERE c.email = 'checkout-test@example.invalid';
    DELETE d FROM delivery d JOIN orders o ON o.order_id = d.order_id
        JOIN customer c ON c.customer_id = o.customer_id WHERE c.email = 'checkout-test@example.invalid';
    DELETE p FROM payment p JOIN orders o ON o.order_id = p.order_id
        JOIN customer c ON c.customer_id = o.customer_id WHERE c.email = 'checkout-test@example.invalid';
    DELETE o FROM orders o JOIN customer c ON c.customer_id = o.customer_id
        WHERE c.email = 'checkout-test@example.invalid';
    DELETE FROM customer WHERE email = 'checkout-test@example.invalid';
    DELETE a FROM variant_audit a JOIN variant v ON v.variant_id = a.variant_id
        JOIN product p ON p.product_id = v.product_id WHERE p.sku LIKE 'TEST-CHECKOUT-%';
    DELETE v FROM variant v JOIN product p ON p.product_id = v.product_id WHERE p.sku LIKE 'TEST-CHECKOUT-%';
    DELETE FROM product WHERE sku LIKE 'TEST-CHECKOUT-%';
    DELETE FROM audit_log WHERE actor = 'test:checkout';
END$$

CREATE PROCEDURE checkout_tests()
BEGIN
    DECLARE buyer INT;
    DECLARE product_a INT;
    DECLARE product_b INT;
    DECLARE product_retired INT;
    DECLARE variant_a INT;          -- USD 100.00, stock 10
    DECLARE variant_b INT;          -- USD 50.00, stock 3
    DECLARE variant_retired INT;
    DECLARE cart JSON;
    DECLARE status_text VARCHAR(255);
    DECLARE quoted DECIMAL(10,2);
    DECLARE order_cod INT;
    DECLARE order_card INT;
    DECLARE order_last INT;
    DECLARE order_none INT;
    DECLARE order_back INT;
    DECLARE order_part INT;
    DECLARE audits_before INT;
    DECLARE orders_before INT;
    DECLARE EXIT HANDLER FOR SQLEXCEPTION
    BEGIN
        ROLLBACK;
        SET @brightbuy_actor = 'test:checkout';
        CALL checkout_test_cleanup();
        SET @brightbuy_actor = NULL;
        RESIGNAL;
    END;
    SET @checkout_test_count = 0;
    SET @brightbuy_actor = 'test:checkout';
    CALL checkout_test_cleanup();
    SELECT COUNT(*) INTO orders_before FROM orders;

    CALL sp_register_customer('Checkout', 'Tester', 'checkout-test@example.invalid',
        '$2b$12$checkout-test-hash-00000000000000000000000000000000000000', NULL, NULL, NULL, buyer);
    CALL sp_catalogue_create_product('TEST-CHECKOUT-A', 'Checkout Test Phone', NULL, NULL, 1, 1, 100.00, 10, product_a);
    CALL sp_catalogue_create_product('TEST-CHECKOUT-B', 'Checkout Test Cable', NULL, NULL, 1, 1, 50.00, 3, product_b);
    CALL sp_catalogue_create_product('TEST-CHECKOUT-C', 'Checkout Test Retired', NULL, NULL, 1, 1, 20.00, 5, product_retired);
    CALL sp_catalogue_set_product_active(product_retired, 0);
    SELECT variant_id INTO variant_a FROM variant WHERE product_id = product_a;
    SELECT variant_id INTO variant_b FROM variant WHERE product_id = product_b;
    SELECT variant_id INTO variant_retired FROM variant WHERE product_id = product_retired;
    SET cart = JSON_ARRAY(JSON_OBJECT('variantId', variant_a, 'quantity', 2),
                          JSON_OBJECT('variantId', variant_b, 'quantity', 1));

    -- Quote: the amount a card is authorised for
    CALL sp_checkout_quote(cart, status_text, quoted);
    CALL checkout_test_assert(status_text = 'OK' AND quoted = 250.00, 'quote totals the cart from database prices');
    CALL sp_checkout_quote(JSON_ARRAY(), status_text, quoted);
    CALL checkout_test_assert(status_text = 'INVALID_CART' AND quoted IS NULL, 'quote rejects an empty cart');
    CALL sp_checkout_quote(JSON_ARRAY(JSON_OBJECT('variantId', variant_a, 'quantity', 1.5)), status_text, quoted);
    CALL checkout_test_assert(status_text = 'INVALID_CART', 'quote rejects a fractional quantity');
    CALL sp_checkout_quote(JSON_ARRAY(JSON_OBJECT('variantId', variant_a, 'quantity', '2')), status_text, quoted);
    CALL checkout_test_assert(status_text = 'INVALID_CART', 'quote rejects a quantity sent as text');
    CALL sp_checkout_quote(JSON_ARRAY(JSON_OBJECT('variantId', variant_a, 'quantity', 1),
                                      JSON_OBJECT('variantId', variant_a, 'quantity', 1)), status_text, quoted);
    CALL checkout_test_assert(status_text = 'DUPLICATE_VARIANTS_IN_CART', 'quote rejects a repeated variant');
    CALL sp_checkout_quote(JSON_ARRAY(JSON_OBJECT('variantId', variant_b, 'quantity', 4)), status_text, quoted);
    CALL checkout_test_assert(status_text = 'OK' AND quoted = 200.00, 'quote prices a line that is partly out of stock');
    CALL sp_checkout_quote(JSON_ARRAY(JSON_OBJECT('variantId', variant_retired, 'quantity', 1)), status_text, quoted);
    CALL checkout_test_assert(status_text = 'ITEM_UNAVAILABLE', 'quote refuses a retired product');
    CALL sp_checkout_quote(JSON_ARRAY(JSON_OBJECT('variantId', 2147483647, 'quantity', 1)), status_text, quoted);
    CALL checkout_test_assert(status_text = 'ITEM_UNAVAILABLE', 'quote refuses an unknown variant');

    -- Checkout: every refusal leaves no order and no stock change
    CALL ProcessCheckout(buyer, JSON_ARRAY(), 'pickup', 'cod', NULL, NULL, NULL, NULL, NULL, NULL, NULL, status_text, order_none);
    CALL checkout_test_assert(status_text = 'INVALID_CART', 'empty cart refused');
    CALL ProcessCheckout(buyer, cart, 'pickup', 'paypal', NULL, NULL, NULL, NULL, NULL, NULL, NULL, status_text, order_none);
    CALL checkout_test_assert(status_text = 'INVALID_PAYMENT_METHOD', 'unknown payment method refused');
    CALL ProcessCheckout(buyer, cart, 'pickup', 'cod', NULL, NULL, 'tok_x', 'SIM-X', '4242', 'Visa', 250.00, status_text, order_none);
    CALL checkout_test_assert(status_text = 'INVALID_PAYMENT_DETAILS', 'cash on delivery with card details refused');
    CALL ProcessCheckout(buyer, cart, 'pickup', 'card', NULL, NULL, NULL, 'SIM-X', '4242', 'Visa', 250.00, status_text, order_none);
    CALL checkout_test_assert(status_text = 'INVALID_PAYMENT_DETAILS', 'card without a gateway token refused');
    CALL ProcessCheckout(buyer, cart, 'pickup', 'card', NULL, NULL, 'tok_x', 'SIM-X', '42a2', 'Visa', 250.00, status_text, order_none);
    CALL checkout_test_assert(status_text = 'INVALID_PAYMENT_DETAILS', 'card with malformed last four digits refused');
    CALL ProcessCheckout(buyer, cart, 'courier', 'cod', NULL, NULL, NULL, NULL, NULL, NULL, NULL, status_text, order_none);
    CALL checkout_test_assert(status_text = 'INVALID_DELIVERY_MODE', 'unknown delivery mode refused');
    CALL ProcessCheckout(2147483647, cart, 'pickup', 'cod', NULL, NULL, NULL, NULL, NULL, NULL, NULL, status_text, order_none);
    CALL checkout_test_assert(status_text = 'INVALID_CUSTOMER', 'unknown customer refused');
    CALL ProcessCheckout(buyer, cart, 'delivery', 'cod', 1, NULL, NULL, NULL, NULL, NULL, NULL, status_text, order_none);
    CALL checkout_test_assert(status_text = 'INVALID_DELIVERY_ADDRESS', 'delivery without an address refused');
    CALL ProcessCheckout(buyer, cart, 'delivery', 'cod', 2147483647, '1 Test Street', NULL, NULL, NULL, NULL, NULL, status_text, order_none);
    CALL checkout_test_assert(status_text = 'INVALID_DELIVERY_ADDRESS', 'delivery to an unknown city refused');
    CALL ProcessCheckout(buyer, JSON_ARRAY(JSON_OBJECT('variantId', variant_retired, 'quantity', 1)),
        'pickup', 'cod', NULL, NULL, NULL, NULL, NULL, NULL, NULL, status_text, order_none);
    CALL checkout_test_assert(status_text = 'ITEM_UNAVAILABLE', 'retired product refused');
    CALL ProcessCheckout(buyer, cart, 'pickup', 'card', NULL, NULL, 'tok_x', 'SIM-X', '4242', 'Visa', 249.99, status_text, order_none);
    CALL checkout_test_assert(status_text = 'AUTHORISED_AMOUNT_MISMATCH', 'card authorised for a different amount refused');
    CALL checkout_test_assert(order_none IS NULL AND (SELECT COUNT(*) FROM orders) = orders_before
        AND (SELECT stock_quantity FROM variant WHERE variant_id = variant_a) = 10
        AND (SELECT stock_quantity FROM variant WHERE variant_id = variant_b) = 3,
        'refused checkouts created no order and changed no stock');

    -- Cash on delivery, delivered to a main city
    CALL ProcessCheckout(buyer, cart, 'delivery', 'cod', 1, '  12 Test Street  ', NULL, NULL, NULL, NULL, NULL, status_text, order_cod);
    CALL checkout_test_assert(status_text = 'SUCCESS' AND EXISTS (SELECT 1 FROM orders WHERE order_id = order_cod
        AND customer_id = buyer AND order_status = 'Confirmed' AND total_amount = 250.00), 'cash-on-delivery order confirmed with the database total');
    CALL checkout_test_assert((SELECT COUNT(*) FROM order_item WHERE order_id = order_cod) = 2
        AND (SELECT unit_price FROM order_item WHERE order_id = order_cod AND variant_id = variant_a) = 100.00
        AND (SELECT quantity FROM order_item WHERE order_id = order_cod AND variant_id = variant_b) = 1
        AND (SELECT SUM(backordered_quantity) FROM order_item WHERE order_id = order_cod) = 0,
        'order lines keep variant, quantity and unit price; nothing is back-ordered while stock lasts');
    CALL checkout_test_assert((SELECT stock_quantity FROM variant WHERE variant_id = variant_a) = 8
        AND (SELECT stock_quantity FROM variant WHERE variant_id = variant_b) = 2, 'stock decremented once per line');
    CALL checkout_test_assert((SELECT COUNT(*) FROM variant_audit WHERE variant_id = variant_a
        AND old_stock_quantity = 10 AND new_stock_quantity = 8 AND changed_by = 'test:checkout') = 1,
        'checkout stock change is in the stock audit');
    CALL checkout_test_assert(EXISTS (SELECT 1 FROM delivery WHERE order_id = order_cod AND city_id = 1
        AND address_line = '12 Test Street' AND delivery_mode = 'delivery' AND delivery_status = 'Pending'
        AND est_delivery_date = CURDATE() + INTERVAL 5 DAY), 'delivery record holds the address and a 5-day estimate');
    CALL checkout_test_assert(EXISTS (SELECT 1 FROM payment WHERE order_id = order_cod AND payment_method = 'cod'
        AND payment_status = 'Pending' AND amount = 250.00 AND payment_date IS NULL
        AND gateway_token IS NULL AND card_last_four IS NULL), 'cash on delivery stays pending with no card data');
    CALL checkout_test_assert((SELECT COUNT(*) FROM email_outbox WHERE recipient = 'checkout-test@example.invalid'
        AND category = 'order_confirmation' AND related_id = order_cod AND status = 'Pending') = 1,
        'order confirmation is queued after the commit');

    -- Card payment, store pickup
    SET cart = JSON_ARRAY(JSON_OBJECT('variantId', variant_a, 'quantity', 3));
    CALL sp_checkout_quote(cart, status_text, quoted);
    CALL ProcessCheckout(buyer, cart, 'pickup', 'card', NULL, NULL, 'tok_test_checkout', 'SIM-TEST-CHECKOUT', '4242', 'Visa',
        quoted, status_text, order_card);
    CALL checkout_test_assert(status_text = 'SUCCESS' AND quoted = 300.00 AND EXISTS (SELECT 1 FROM payment
        WHERE order_id = order_card AND payment_method = 'card' AND payment_status = 'Paid' AND amount = 300.00
          AND payment_date IS NOT NULL AND gateway_token = 'tok_test_checkout'
          AND gateway_reference = 'SIM-TEST-CHECKOUT' AND card_last_four = '4242' AND card_type = 'Visa'),
        'card order is paid and keeps only token, reference, last four and type');
    CALL checkout_test_assert(EXISTS (SELECT 1 FROM delivery WHERE order_id = order_card AND delivery_mode = 'pickup'
        AND city_id IS NULL AND address_line IS NULL AND est_delivery_date IS NULL),
        'store pickup has no city and no delivery estimate');
    CALL checkout_test_assert((SELECT stock_quantity FROM variant WHERE variant_id = variant_a) = 5, 'card order decrements stock');

    -- Last units, another city
    CALL ProcessCheckout(buyer, JSON_ARRAY(JSON_OBJECT('variantId', variant_b, 'quantity', 2)), 'delivery', 'cod', 3,
        '9 Test Road', NULL, NULL, NULL, NULL, NULL, status_text, order_last);
    CALL checkout_test_assert(status_text = 'SUCCESS' AND (SELECT stock_quantity FROM variant WHERE variant_id = variant_b) = 0
        AND (SELECT est_delivery_date FROM delivery WHERE order_id = order_last) = CURDATE() + INTERVAL 7 DAY,
        'buying the last units empties stock and keeps the 7-day estimate');

    -- Out of stock at the time of order: back-ordered, 3 days later, stock never below zero
    CALL checkout_test_assert(fn_delivery_preview_date(3, JSON_ARRAY(JSON_OBJECT('variantId', variant_b, 'quantity', 1)))
        = CURDATE() + INTERVAL 10 DAY, 'the estimate for the sold-out variant includes the 3-day delay');
    SELECT COUNT(*) INTO audits_before FROM variant_audit WHERE variant_id = variant_b;
    CALL ProcessCheckout(buyer, JSON_ARRAY(JSON_OBJECT('variantId', variant_b, 'quantity', 2)), 'delivery', 'cod', 1,
        '5 Back Order Lane', NULL, NULL, NULL, NULL, NULL, status_text, order_back);
    CALL checkout_test_assert(status_text = 'SUCCESS' AND EXISTS (SELECT 1 FROM order_item WHERE order_id = order_back
        AND variant_id = variant_b AND quantity = 2 AND backordered_quantity = 2 AND unit_price = 50.00)
        AND (SELECT total_amount FROM orders WHERE order_id = order_back) = 100.00,
        'a sold-out variant can be ordered and the whole line is back-ordered');
    CALL checkout_test_assert((SELECT stock_quantity FROM variant WHERE variant_id = variant_b) = 0
        AND (SELECT COUNT(*) FROM variant_audit WHERE variant_id = variant_b) = audits_before,
        'a back-order takes nothing from stock: it stays at zero and no stock change is recorded');
    CALL checkout_test_assert((SELECT est_delivery_date FROM delivery WHERE order_id = order_back) = CURDATE() + INTERVAL 8 DAY,
        'out of stock in a main city: 5 days plus 3');
    CALL checkout_test_assert(calculate_delivery_date(1, order_back) = CURDATE() + INTERVAL 8 DAY
        AND calculate_delivery_date(1, order_cod) = CURDATE() + INTERVAL 5 DAY,
        'the order estimate function follows the back-order recorded on the order');

    -- Partly in stock (5 left, 7 ordered), mixed with a back-ordered line, paid by card
    SET cart = JSON_ARRAY(JSON_OBJECT('variantId', variant_a, 'quantity', 7), JSON_OBJECT('variantId', variant_b, 'quantity', 1));
    CALL sp_checkout_quote(cart, status_text, quoted);
    CALL ProcessCheckout(buyer, cart, 'delivery', 'card', 3, '9 Test Road', 'tok_test_partial', 'SIM-TEST-PARTIAL', '4242', 'Visa',
        quoted, status_text, order_part);
    CALL checkout_test_assert(status_text = 'SUCCESS' AND quoted = 750.00
        AND (SELECT backordered_quantity FROM order_item WHERE order_id = order_part AND variant_id = variant_a) = 2
        AND (SELECT backordered_quantity FROM order_item WHERE order_id = order_part AND variant_id = variant_b) = 1
        AND (SELECT amount FROM payment WHERE order_id = order_part AND payment_status = 'Paid') = 750.00,
        'a line that is partly in stock back-orders only the shortfall and is charged in full');
    CALL checkout_test_assert((SELECT stock_quantity FROM variant WHERE variant_id = variant_a) = 0
        AND (SELECT COUNT(*) FROM variant_audit WHERE variant_id = variant_a AND old_stock_quantity = 5
             AND new_stock_quantity = 0) = 1, 'only the units that were in stock leave it');
    CALL checkout_test_assert((SELECT est_delivery_date FROM delivery WHERE order_id = order_part) = CURDATE() + INTERVAL 10 DAY,
        'out of stock in another city: 7 days plus 3');
    CALL checkout_test_assert((SELECT COUNT(*) FROM email_outbox WHERE related_id = order_part
        AND category = 'order_confirmation' AND body LIKE '%out of stock and will follow%') = 1,
        'the confirmation says that part of the order follows later');
    CALL checkout_test_assert(NOT EXISTS (SELECT 1 FROM variant WHERE stock_quantity < 0), 'no variant ever has negative stock');

    -- History is protected
    CALL sp_inventory_update_variant(variant_a, 'Checkout Test Phone', NULL, NULL, 175.00);
    CALL checkout_test_assert((SELECT unit_price FROM order_item WHERE order_id = order_cod AND variant_id = variant_a) = 100.00
        AND (SELECT total_amount FROM orders WHERE order_id = order_cod) = 250.00, 'a later price change does not alter past orders');
    CALL checkout_test_reject(CONCAT('DELETE FROM orders WHERE order_id = ', order_cod), '23000', 'an order with lines cannot be deleted');
    CALL checkout_test_reject(CONCAT('DELETE FROM variant WHERE variant_id = ', variant_a), '23000', 'an ordered variant cannot be deleted');
    CALL checkout_test_reject(CONCAT('DELETE FROM customer WHERE customer_id = ', buyer), '23000', 'a customer with orders cannot be deleted');

    -- Constraints on the tables themselves
    CALL checkout_test_reject(CONCAT('INSERT INTO payment (order_id, payment_method, payment_status, amount) VALUES (', order_cod, ', ''cod'', ''Pending'', 1)'),
        '23000', 'second payment for the same order rejected');
    CALL checkout_test_reject(CONCAT('UPDATE payment SET payment_method = ''card'' WHERE order_id = ', order_cod),
        'HY000', 'card payment without gateway details rejected by the CHECK constraint');
    CALL checkout_test_reject(CONCAT('UPDATE payment SET card_last_four = ''12ab'' WHERE order_id = ', order_card),
        'HY000', 'non-numeric last four digits rejected by the CHECK constraint');
    CALL checkout_test_reject(CONCAT('UPDATE order_item SET quantity = 0 WHERE order_id = ', order_cod),
        'HY000', 'zero quantity rejected by the CHECK constraint');
    CALL checkout_test_reject(CONCAT('UPDATE order_item SET backordered_quantity = quantity + 1 WHERE order_id = ', order_cod),
        'HY000', 'a back-order larger than the line rejected by the CHECK constraint');
    CALL checkout_test_reject(CONCAT('UPDATE order_item SET backordered_quantity = -1 WHERE order_id = ', order_cod),
        'HY000', 'a negative back-order rejected by the CHECK constraint');
    CALL checkout_test_reject(CONCAT('UPDATE orders SET total_amount = -1 WHERE order_id = ', order_cod),
        'HY000', 'negative order total rejected by the CHECK constraint');

    CALL checkout_test_cleanup();
    SET @brightbuy_actor = NULL;
    CALL checkout_test_assert((SELECT COUNT(*) FROM orders) = orders_before
        AND (SELECT COUNT(*) FROM product WHERE sku LIKE 'TEST-CHECKOUT-%') = 0, 'cleanup removed the test orders and products');
    SELECT CONCAT('PASS: all ', @checkout_test_count, ' checkout assertions') AS result;
END$$

DELIMITER ;

CALL checkout_tests();
DROP PROCEDURE checkout_tests;
DROP PROCEDURE checkout_test_cleanup;
DROP PROCEDURE checkout_test_reject;
DROP PROCEDURE checkout_test_assert;
SET @checkout_test_sql = NULL;
SET @checkout_test_count = NULL;
