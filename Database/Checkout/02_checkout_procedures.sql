-- =========================================================
-- BrightBuy | Cart & Checkout | 02 Procedures
-- Module owner: Adeesha W.G.I.
-- Run after Checkout/01, Inventory/02 (fn_delivery_days) and Shared/01.
-- Safe to reinstall: replaces three routines, changes no rows.
--
-- Order placement is one stored procedure and one transaction (CON-3,
-- SRS 3.3.1): stock is locked, validated and decremented together with the
-- order, its items, its delivery record and its payment record. Any failure
-- rolls everything back, so there are no partial orders (SAF-1).
--
-- The cart is a JSON array: [{"variantId": 12, "quantity": 2}, ...].
-- =========================================================
USE brightbuy;

DROP PROCEDURE IF EXISTS sp_checkout_validate_cart;
DROP PROCEDURE IF EXISTS sp_checkout_quote;
DROP PROCEDURE IF EXISTS ProcessCheckout;
DROP PROCEDURE IF EXISTS ProcessCheckoutV2; -- former name

DELIMITER //

-- Shape check shared by the quote and the checkout.
-- p_status: OK, INVALID_CART or DUPLICATE_VARIANTS_IN_CART.
CREATE PROCEDURE sp_checkout_validate_cart(IN p_cart_json JSON, OUT p_status VARCHAR(255))
validate: BEGIN
    DECLARE v_count INT;
    DECLARE v_valid INT;

    SET p_status = 'INVALID_CART';
    IF p_cart_json IS NULL OR JSON_TYPE(p_cart_json) <> 'ARRAY'
       OR JSON_LENGTH(p_cart_json) = 0 OR JSON_LENGTH(p_cart_json) > 100 THEN
        LEAVE validate;
    END IF;
    SET v_count = JSON_LENGTH(p_cart_json);

    -- Whole positive numbers only: 1.5 or "2" must not be coerced.
    SELECT COUNT(*) INTO v_valid
    FROM JSON_TABLE(p_cart_json, '$[*]' COLUMNS (item JSON PATH '$')) j
    WHERE JSON_TYPE(JSON_EXTRACT(item, '$.variantId')) = 'INTEGER'
      AND JSON_TYPE(JSON_EXTRACT(item, '$.quantity')) = 'INTEGER'
      AND CAST(JSON_UNQUOTE(JSON_EXTRACT(item, '$.variantId')) AS SIGNED) > 0
      AND CAST(JSON_UNQUOTE(JSON_EXTRACT(item, '$.quantity')) AS SIGNED) BETWEEN 1 AND 100000;
    IF v_valid <> v_count THEN
        LEAVE validate;
    END IF;

    SELECT COUNT(DISTINCT variant_id) INTO v_valid
    FROM JSON_TABLE(p_cart_json, '$[*]' COLUMNS (variant_id INT PATH '$.variantId')) j;
    IF v_valid <> v_count THEN
        SET p_status = 'DUPLICATE_VARIANTS_IN_CART';
        LEAVE validate;
    END IF;

    SET p_status = 'OK';
END //

-- Read-only price check used before a card is authorised (BR-12): the
-- gateway is asked for exactly the amount the database would charge now.
-- p_status: OK, INVALID_CART, DUPLICATE_VARIANTS_IN_CART, ITEM_UNAVAILABLE
-- or INSUFFICIENT_STOCK. Nothing is locked or reserved (AS-10).
CREATE PROCEDURE sp_checkout_quote(
    IN  p_cart_json JSON,
    OUT p_status    VARCHAR(255),
    OUT p_total     DECIMAL(10,2)
)
READS SQL DATA
quote: BEGIN
    DECLARE v_lines INT;
    DECLARE v_sellable INT;
    DECLARE v_short INT;

    SET p_total = NULL;
    CALL sp_checkout_validate_cart(p_cart_json, p_status);
    IF p_status <> 'OK' THEN
        LEAVE quote;
    END IF;
    SET v_lines = JSON_LENGTH(p_cart_json);

    SELECT COUNT(*), COALESCE(SUM(j.quantity > v.stock_quantity), 0), SUM(j.quantity * v.price)
    INTO v_sellable, v_short, p_total
    FROM JSON_TABLE(p_cart_json, '$[*]'
         COLUMNS (variant_id INT PATH '$.variantId', quantity INT PATH '$.quantity')) j
    JOIN variant v ON v.variant_id = j.variant_id
    JOIN product p ON p.product_id = v.product_id
    WHERE p.is_active = TRUE AND v.price > 0;

    IF v_sellable <> v_lines THEN
        SET p_status = 'ITEM_UNAVAILABLE';
        SET p_total = NULL;
    ELSEIF v_short > 0 THEN
        SET p_status = 'INSUFFICIENT_STOCK';
        SET p_total = NULL;
    END IF;
END //

-- Places an order atomically.
--   p_delivery_mode  'delivery' (needs a Texas city and an address) or 'pickup'
--   p_payment_method 'cod'  - payment stays Pending (AS-8); card arguments NULL
--                    'card' - pass what the gateway returned after authorising
--                             p_authorised_amount; the order is refused if the
--                             database total differs from that amount
-- p_status: SUCCESS, INVALID_CART, DUPLICATE_VARIANTS_IN_CART,
--   INVALID_PAYMENT_METHOD, INVALID_PAYMENT_DETAILS, INVALID_DELIVERY_MODE,
--   INVALID_CUSTOMER, INVALID_DELIVERY_ADDRESS, ITEM_UNAVAILABLE,
--   INSUFFICIENT_STOCK, AUTHORISED_AMOUNT_MISMATCH or SQL_ERROR.
CREATE PROCEDURE ProcessCheckout(
    IN  p_customer_id       INT,
    IN  p_cart_json         JSON,
    IN  p_delivery_mode     VARCHAR(50),
    IN  p_payment_method    VARCHAR(50),
    IN  p_city_id           INT,
    IN  p_address           VARCHAR(255),
    IN  p_gateway_token     VARCHAR(64),
    IN  p_gateway_reference VARCHAR(64),
    IN  p_card_last_four    VARCHAR(4),
    IN  p_card_type         VARCHAR(20),
    IN  p_authorised_amount DECIMAL(10,2),
    OUT p_status            VARCHAR(255),
    OUT p_order_id          INT
)
checkout: BEGIN
    DECLARE v_count INT;
    DECLARE v_id INT;
    DECLARE v_previous INT DEFAULT 0;
    DECLARE v_quantity INT;
    DECLARE v_stock INT;
    DECLARE v_price DECIMAL(10,2);
    DECLARE v_total DECIMAL(10,2) DEFAULT 0;
    DECLARE v_estimate DATE DEFAULT NULL;
    DECLARE v_email VARCHAR(150) DEFAULT NULL;
    DECLARE EXIT HANDLER FOR SQLEXCEPTION
    BEGIN
        ROLLBACK;
        SET p_order_id = NULL;
        SET p_status = 'SQL_ERROR';
    END;

    SET p_order_id = NULL;
    CALL sp_checkout_validate_cart(p_cart_json, p_status);
    IF p_status <> 'OK' THEN
        LEAVE checkout;
    END IF;
    SET v_count = JSON_LENGTH(p_cart_json);

    IF p_payment_method IS NULL OR p_payment_method NOT IN ('cod', 'card') THEN
        SET p_status = 'INVALID_PAYMENT_METHOD';
        LEAVE checkout;
    END IF;
    IF (p_payment_method = 'card' AND (
            p_gateway_token IS NULL OR CHAR_LENGTH(TRIM(p_gateway_token)) = 0
            OR p_gateway_reference IS NULL OR CHAR_LENGTH(TRIM(p_gateway_reference)) = 0
            OR p_card_last_four IS NULL OR NOT REGEXP_LIKE(p_card_last_four, '^[0-9]{4}$')
            OR p_card_type IS NULL OR CHAR_LENGTH(TRIM(p_card_type)) = 0
            OR p_authorised_amount IS NULL OR p_authorised_amount <= 0))
       OR (p_payment_method = 'cod' AND (
            p_gateway_token IS NOT NULL OR p_gateway_reference IS NOT NULL
            OR p_card_last_four IS NOT NULL OR p_card_type IS NOT NULL
            OR p_authorised_amount IS NOT NULL)) THEN
        SET p_status = 'INVALID_PAYMENT_DETAILS';
        LEAVE checkout;
    END IF;
    IF p_delivery_mode IS NULL OR p_delivery_mode NOT IN ('delivery', 'pickup') THEN
        SET p_status = 'INVALID_DELIVERY_MODE';
        LEAVE checkout;
    END IF;

    SELECT email INTO v_email FROM customer WHERE customer_id = p_customer_id;
    IF v_email IS NULL THEN
        SET p_status = 'INVALID_CUSTOMER';
        LEAVE checkout;
    END IF;
    IF p_delivery_mode = 'delivery' AND (
            p_address IS NULL OR CHAR_LENGTH(TRIM(p_address)) < 5
            OR p_city_id IS NULL OR NOT EXISTS (SELECT 1 FROM city WHERE city_id = p_city_id)) THEN
        SET p_status = 'INVALID_DELIVERY_ADDRESS';
        LEAVE checkout;
    END IF;

    START TRANSACTION;

    -- Lock each variant row in ascending ID order (no deadlocks between two
    -- carts), then validate against the locked stock and price.
    WHILE v_count > 0 DO
        SELECT MIN(variant_id) INTO v_id
        FROM JSON_TABLE(p_cart_json, '$[*]' COLUMNS (variant_id INT PATH '$.variantId')) j
        WHERE variant_id > v_previous;

        SET v_stock = NULL;
        SET v_price = NULL;
        BEGIN
            DECLARE CONTINUE HANDLER FOR NOT FOUND SET v_stock = NULL;
            SELECT stock_quantity, price INTO v_stock, v_price
            FROM variant WHERE variant_id = v_id FOR UPDATE;
        END;
        IF v_stock IS NULL OR v_price IS NULL OR v_price <= 0 OR NOT EXISTS (
                SELECT 1 FROM variant v JOIN product p ON p.product_id = v.product_id
                WHERE v.variant_id = v_id AND p.is_active = TRUE) THEN
            ROLLBACK;
            SET p_status = 'ITEM_UNAVAILABLE';
            LEAVE checkout;
        END IF;

        SELECT quantity INTO v_quantity
        FROM JSON_TABLE(p_cart_json, '$[*]'
             COLUMNS (variant_id INT PATH '$.variantId', quantity INT PATH '$.quantity')) j
        WHERE variant_id = v_id;
        IF v_quantity > v_stock THEN
            ROLLBACK;
            SET p_status = 'INSUFFICIENT_STOCK';
            LEAVE checkout;
        END IF;

        SET v_total = v_total + v_quantity * v_price;
        SET v_previous = v_id;
        SET v_count = v_count - 1;
    END WHILE;

    -- The card was authorised for the quoted total; a price change since the
    -- quote must not be charged silently.
    IF p_payment_method = 'card' AND p_authorised_amount <> v_total THEN
        ROLLBACK;
        SET p_status = 'AUTHORISED_AMOUNT_MISMATCH';
        LEAVE checkout;
    END IF;

    INSERT INTO orders (customer_id, order_date, order_status, total_amount, delivery_mode, payment_method)
    VALUES (p_customer_id, NOW(), 'Confirmed', v_total, p_delivery_mode, p_payment_method);
    SET p_order_id = LAST_INSERT_ID();

    INSERT INTO order_item (order_id, variant_id, quantity, unit_price)
    SELECT p_order_id, j.variant_id, j.quantity, v.price
    FROM JSON_TABLE(p_cart_json, '$[*]'
         COLUMNS (variant_id INT PATH '$.variantId', quantity INT PATH '$.quantity')) j
    JOIN variant v ON v.variant_id = j.variant_id;

    -- Estimated before the stock is decremented: every ordered item is in
    -- stock at this point, so buying the last unit does not add the delay.
    IF p_delivery_mode = 'delivery' THEN
        SET v_estimate = DATE_ADD(CURDATE(), INTERVAL fn_delivery_days(p_city_id, FALSE) DAY);
    END IF;
    INSERT INTO delivery (order_id, city_id, address_line, delivery_mode, est_delivery_date, delivery_status)
    VALUES (p_order_id,
            IF(p_delivery_mode = 'delivery', p_city_id, NULL),
            IF(p_delivery_mode = 'delivery', TRIM(p_address), NULL),
            p_delivery_mode, v_estimate, 'Pending');

    IF p_payment_method = 'card' THEN
        INSERT INTO payment (order_id, payment_method, payment_status, amount, payment_date,
                             gateway_token, gateway_reference, card_last_four, card_type)
        VALUES (p_order_id, 'card', 'Paid', v_total, NOW(),
                TRIM(p_gateway_token), TRIM(p_gateway_reference), p_card_last_four, TRIM(p_card_type));
    ELSE
        INSERT INTO payment (order_id, payment_method, payment_status, amount, payment_date)
        VALUES (p_order_id, 'cod', 'Pending', v_total, NULL);
    END IF;

    UPDATE variant v
    JOIN order_item i ON i.variant_id = v.variant_id AND i.order_id = p_order_id
    SET v.stock_quantity = v.stock_quantity - i.quantity;

    COMMIT;
    SET p_status = 'SUCCESS';

    -- Order confirmation. The order is already committed, so a problem with
    -- the email queue can never roll it back (DEP-2, SAF-8).
    BEGIN
        DECLARE CONTINUE HANDLER FOR SQLEXCEPTION BEGIN END;
        CALL sp_email_enqueue(v_email, 'order_confirmation',
            CONCAT('BrightBuy order #', p_order_id, ' confirmed'),
            CONCAT('Thank you for your order. Order #', p_order_id, ' for USD ', v_total, ' is confirmed. ',
                   IF(p_delivery_mode = 'delivery',
                      CONCAT('Estimated delivery: ', DATE_FORMAT(v_estimate, '%Y-%m-%d'), '. '),
                      'Collect it at the store. '),
                   IF(p_payment_method = 'card',
                      CONCAT('Paid by card ending ', p_card_last_four, '.'),
                      'Pay cash on delivery.')),
            p_order_id);
    END;
END //

DELIMITER ;
