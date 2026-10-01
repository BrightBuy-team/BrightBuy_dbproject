-- Simulate Customer 1 buying 1 of Variant 1 and 2 of Variant 2
SET @status_output = '';

CALL ProcessCheckout(
    1, -- customer_id
    '[{"variantId": 1, "quantity": 1}, {"variantId": 2, "quantity": 2}]', -- p_cart_json
    @status_output -- p_status
);

-- Check the output status (Should be 'SUCCESS')
SELECT @status_output AS Checkout_Status;

-- Verify the stock was deducted (Variant 1 should be 9, Variant 2 should be 3)
SELECT variant_id, stock_quantity FROM variant;

-- Verify the order and items were created
SELECT * FROM orders;
SELECT * FROM order_item;