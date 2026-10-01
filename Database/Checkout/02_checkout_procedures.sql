DELIMITER //

CREATE PROCEDURE ProcessCheckout(
    IN p_customer_id INT,
    IN p_cart_json JSON,
    OUT p_status VARCHAR(50)
)
BEGIN
    -- Declare Variables 
    DECLARE v_order_id INT;
    DECLARE v_total_amount DECIMAL(10,2);
    DECLARE v_insufficient_stock INT DEFAULT 0;

    -- Declare an exit handler for SQL errors to guarantee atomicity
    DECLARE EXIT HANDLER FOR SQLEXCEPTION
    BEGIN   
        ROLLBACK;
        SET p_status = 'SQL_ERROR';
    END;

    -- Begin the transaction with ACID properties
    START TRANSACTION;

    -- Apply row-level locks on the requested variants
    -- This prevents other users from buying these items until transaction is complete
    SELECT variant_id
    FROM variant
    WHERE variant_id IN (
        SELECT variant_id FROM JSON_TABLE(p_cart_json, '$[*]' COLUMNS(variant_id INT PATH '$.variantId')) AS cart
    )
    FOR UPDATE; 
    -- This is the place where we lock the database row until we update it. 
    -- Others can't change this until finished via 'COMMIT' or 'ROLLBACK'.

    -- Validate stock quantities
    -- Check if any requested quantity in the JSON is greater than the available stock_quantity
    SELECT count(*) INTO v_insufficient_stock
    FROM JSON_TABLE(
        p_cart_json,
        '$[*]' COLUMNS(
            variant_id INT PATH '$.variantId',
            quantity INT PATH '$.quantity'
        )
    ) AS cart_data 
    JOIN variant v ON cart_data.variant_id = v.variant_id
    WHERE cart_data.quantity > v.stock_quantity;

    -- Branching Logic : Rollback or Proceed
    IF v_insufficient_stock > 0 THEN
        -- If even one item lacks stock, cancel everything and release the locks
        ROLLBACK;
        SET p_status = 'INSUFFICIENT_STOCK';
    ELSE
        -- Calculate the total amount for the order based on variant prices
        SELECT SUM(cart_data.quantity * v.price) INTO v_total_amount
        FROM JSON_TABLE(
            p_cart_json,
            '$[*]' COLUMNS(
                variant_id INT PATH '$.variantId',
                quantity INT PATH '$.quantity'
            )
        ) AS cart_data
        JOIN variant v ON cart_data.variant_id = v.variant_id;

        -- Insert the main order record 
        INSERT INTO orders (customer_id, order_date, order_status, total_amount)
        VALUES (p_customer_id, NOW(), 'Pending_Payment', v_total_amount);

        -- Capture the auto generated order_id to use for the items 
        SET v_order_id = LAST_INSERT_ID();

        -- Deduct the stock quantities atomically
        UPDATE variant v
        JOIN JSON_TABLE(
            p_cart_json,
            '$[*]' COLUMNS(
                variant_id INT PATH '$.variantId',
                quantity INT PATH '$.quantity'
            )
        ) AS cart_data ON v.variant_id = cart_data.variant_id
        SET v.stock_quantity = v.stock_quantity - cart_data.quantity;

        -- Insert the individual order items with their locked-in prices
        INSERT INTO order_item(order_id, variant_id, quantity, unit_price)
        SELECT v_order_id, cart_data.variant_id, cart_data.quantity, v.price
        FROM JSON_TABLE(
            p_cart_json,
            '$[*]' COLUMNS(
                variant_id INT PATH '$.variantId',
                quantity INT PATH '$.quantity'
            )
        ) AS cart_data
        JOIN variant v ON cart_data.variant_id = v.variant_id;

        -- Commit the transaction to disk
        COMMIT;
        SET p_status = 'SUCCESS';
    END IF;
END //

DELIMITER ;