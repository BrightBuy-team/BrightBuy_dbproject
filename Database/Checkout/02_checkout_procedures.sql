DELIMITER //
DROP PROCEDURE IF EXISTS ProcessCheckout//

CREATE PROCEDURE ProcessCheckout(
    IN p_customer_id INT,
    IN p_cart_json JSON,
    OUT p_status VARCHAR(255)
)
BEGIN
    -- Declare Variables 
    DECLARE v_order_id INT;
    DECLARE v_total_amount DECIMAL(10,2);
    DECLARE v_insufficient_stock INT DEFAULT 0;

    -- New Validation Variables After recheck (04 Oct 2026)
    DECLARE v_cart_count INT DEFAULT 0;
    DECLARE v_distinct_variants INT DEFAULT 0;
    DECLARE v_invalid_quantities INT DEFAULT 0;
    DECLARE v_valid_db_variants INT DEFAULT 0;

    DECLARE v_error_msg TEXT;

    -- Declare an exit handler for SQL errors to guarantee atomicity
    DECLARE EXIT HANDLER FOR SQLEXCEPTION
    BEGIN   
        -- Capture the exact MySQL error message
        GET DIAGNOSTICS CONDITION 1 v_error_msg = MESSAGE_TEXT;
        ROLLBACK;
        SET p_status = CONCAT('SQL_ERROR: ', v_error_msg);
    END;

    -- Check 1: Reject empty carts immediately
    IF p_cart_json IS NULL OR JSON_LENGTH(p_cart_json) = 0 THEN
        SET p_status = 'EMPTY_CART';
    ELSE
        -- Begin the transaction with ACID properties
        START TRANSACTION;

        -- Extract cart statistics
        SELECT 
            COUNT(*), 
            COUNT(DISTINCT variant_id),
            COUNT(CASE WHEN quantity IS NULL OR quantity <= 0 THEN 1 END)
        INTO
            v_cart_count, v_distinct_variants, v_invalid_quantities
        FROM JSON_TABLE(
            p_cart_json, 
            '$[*]' COLUMNS(
                variant_id INT PATH '$.variantId', 
                quantity INT PATH '$.quantity'
            )
        ) AS cart;

        -- Check 2 & 3: Reject negative/zero quantities and duplicate variant IDs
        IF v_invalid_quantities > 0 THEN
            SET p_status = 'INVALID_QUANTITY';
            ROLLBACK;
        ELSEIF v_cart_count != v_distinct_variants THEN
            SET p_status = 'DUPLICATE_VARIANTS_IN_CART';
            ROLLBACK;
        ELSE
            -- Apply row-level locks safely by redirecting output to a dummy variable
            -- This prevents other users from buying these items until transaction is complete
            SELECT COUNT(variant_id) INTO @dummy_lock
            FROM variant
            WHERE variant_id IN (
                SELECT variant_id 
                FROM JSON_TABLE(
                    p_cart_json, 
                    '$[*]' COLUMNS(variant_id INT PATH '$.variantId')
                ) AS cart
            )
            FOR UPDATE; 
            
            -- This is the place where we lock the database row until we update it. 
            -- Others can't change this until finished via 'COMMIT' or 'ROLLBACK'.

            -- Check 4: Prevent purchasing unknown variants or invalid prices
            SELECT COUNT(*) INTO v_valid_db_variants
            FROM JSON_TABLE(
                p_cart_json, 
                '$[*]' COLUMNS(variant_id INT PATH '$.variantId')
            ) AS cart
            JOIN variant v ON cart.variant_id = v.variant_id
            WHERE v.price > 0;

            IF v_valid_db_variants != v_cart_count THEN
                SET p_status = 'UNKNOWN_VARIANT_OR_INVALID_PRICE';
                ROLLBACK;
            ELSE
                -- Validate stock quantities
                -- Check if any requested quantity in the JSON is greater than the available stock_quantity
                SELECT COUNT(*) INTO v_insufficient_stock
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
                END IF; -- closes the insufficient stock check
            END IF; -- closes the unknown variant check
        END IF; -- closes the invalid quantity/duplicate check
    END IF; -- closes the empty cart check
END //

DELIMITER ;