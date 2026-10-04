-- -- Simulate Customer 1 buying 1 of Variant 1 and 2 of Variant 2
-- SET @status_output = '';

-- CALL ProcessCheckout(
--     1, -- customer_id
--     '[{"variantId": 1, "quantity": 1}, {"variantId": 2, "quantity": 2}]', -- p_cart_json
--     @status_output -- p_status
-- );

-- -- Check the output status (Should be 'ASUCCESS')
-- SELECT @status_output AS Checkout_Status;

-- -- Verify the stock was deducted (Variant 1 should be 9, Variant 2 should be 3)
-- SELECT variant_id, stock_quantity FROM variant;

-- -- Verify the order and items were created
-- SELECT * FROM orders;
-- SELECT * FROM order_item;


-- Dynamically fetch a valid customer and variant from the Catalogue seed data
SET @test_customer_id = (SELECT customer_id FROM customer LIMIT 1);
SET @test_variant_1 = (SELECT variant_id FROM variant LIMIT 1);
SET @test_variant_2 = (SELECT variant_id FROM variant ORDER BY variant_id DESC LIMIT 1);

-- Construct the JSON dynamically using the valid IDs
SET @test_json = JSON_ARRAY(
    JSON_OBJECT('variantId', @test_variant_1, 'quantity', 1),
    JSON_OBJECT('variantId', @test_variant_2, 'quantity', 1)
);

SET @status_output = '';

CALL ProcessCheckout(@test_customer_id, @test_json, @status_output);

SELECT @status_output AS Checkout_Status;