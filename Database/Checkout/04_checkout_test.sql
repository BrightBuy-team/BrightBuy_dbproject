-- Run only on a disposable installed database, without concurrent writers.
-- Invalid cases must neither create orders nor change stock.
USE brightbuy;
DROP PROCEDURE IF EXISTS checkout_assert;
DELIMITER //
CREATE PROCEDURE checkout_assert(IN actual VARCHAR(255),IN expected VARCHAR(255))
BEGIN
 IF actual IS NULL OR actual<>expected THEN SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='Checkout assertion failed'; END IF;
 SELECT CONCAT('PASS: ',expected) AS result;
END//
DELIMITER ;
SET @before_orders=(SELECT COUNT(*) FROM orders);
SET @before_stock=(SELECT SUM(stock_quantity) FROM variant);
SET @customer=(SELECT MIN(customer_id) FROM customer);
SET @variant=(SELECT MIN(variant_id) FROM variant);
CALL ProcessCheckoutV2(@customer,JSON_ARRAY(),'pickup','cod',NULL,NULL,@status,@order);
CALL checkout_assert(@status,'INVALID_CART');
CALL ProcessCheckoutV2(@customer,JSON_ARRAY(JSON_OBJECT('variantId',@variant,'quantity',1.5)),'pickup','cod',NULL,NULL,@status,@order);
CALL checkout_assert(@status,'INVALID_CART');
CALL ProcessCheckoutV2(@customer,JSON_ARRAY(JSON_OBJECT('variantId',@variant,'quantity',1),JSON_OBJECT('variantId',@variant,'quantity',1)),'pickup','cod',NULL,NULL,@status,@order);
CALL checkout_assert(@status,'DUPLICATE_VARIANTS_IN_CART');
CALL ProcessCheckoutV2(@customer,JSON_ARRAY(JSON_OBJECT('variantId',2147483647,'quantity',1)),'pickup','cod',NULL,NULL,@status,@order);
CALL checkout_assert(@status,'UNKNOWN_VARIANT_OR_INVALID_PRICE_OR_RETIRED');
CALL ProcessCheckoutV2(@customer,JSON_ARRAY(JSON_OBJECT('variantId',@variant,'quantity',1)),'pickup','card',NULL,NULL,@status,@order);
CALL checkout_assert(@status,'PAYMENT_GATEWAY_UNAVAILABLE');
CALL ProcessCheckoutV2(@customer,JSON_ARRAY(JSON_OBJECT('variantId',@variant,'quantity',1)),'delivery','cod',NULL,NULL,@status,@order);
CALL checkout_assert(@status,'INVALID_DELIVERY_ADDRESS');
SET @quantity=(SELECT stock_quantity+1 FROM variant WHERE variant_id=@variant);
CALL ProcessCheckoutV2(@customer,JSON_ARRAY(JSON_OBJECT('variantId',@variant,'quantity',@quantity)),'pickup','cod',NULL,NULL,@status,@order);
CALL checkout_assert(@status,'INSUFFICIENT_STOCK');
CALL checkout_assert(IF(@before_orders=(SELECT COUNT(*) FROM orders) AND @before_stock=(SELECT SUM(stock_quantity) FROM variant) AND @order IS NULL,'UNCHANGED','CHANGED'),'UNCHANGED');
DROP PROCEDURE checkout_assert;
