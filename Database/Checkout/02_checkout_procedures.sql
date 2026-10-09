-- V2 records delivery/payment atomically. Card fails closed until a real gateway exists.
DELIMITER //
DROP PROCEDURE IF EXISTS ProcessCheckoutV2//
CREATE PROCEDURE ProcessCheckoutV2(
 IN p_customer_id INT, IN p_cart_json JSON, IN p_delivery_mode VARCHAR(50),
 IN p_payment_method VARCHAR(50), IN p_city_id INT, IN p_address VARCHAR(255),
 OUT p_status VARCHAR(255), OUT p_order_id INT)
checkout: BEGIN
 DECLARE v_count INT;
 DECLARE v_valid INT;
 DECLARE v_id INT;
 DECLARE v_previous INT DEFAULT 0;
 DECLARE v_stock INT;
 DECLARE v_price DECIMAL(10,2);
 DECLARE v_total DECIMAL(10,2) DEFAULT 0;
 DECLARE v_days INT;
 DECLARE EXIT HANDLER FOR SQLEXCEPTION
 BEGIN ROLLBACK; SET p_order_id=NULL; SET p_status='SQL_ERROR'; END;
 SET p_status='INVALID_CART'; SET p_order_id=NULL;
 IF p_cart_json IS NULL OR JSON_TYPE(p_cart_json)<>'ARRAY' OR JSON_LENGTH(p_cart_json)=0
 OR JSON_LENGTH(p_cart_json)>100 THEN LEAVE checkout; END IF;
 SELECT COUNT(*) INTO v_valid FROM JSON_TABLE(p_cart_json,'$[*]' COLUMNS(item JSON PATH '$')) j
 WHERE JSON_TYPE(JSON_EXTRACT(item,'$.variantId'))='INTEGER'
 AND JSON_TYPE(JSON_EXTRACT(item,'$.quantity'))='INTEGER'
 AND CAST(JSON_UNQUOTE(JSON_EXTRACT(item,'$.variantId')) AS SIGNED)>0
 AND CAST(JSON_UNQUOTE(JSON_EXTRACT(item,'$.quantity')) AS SIGNED) BETWEEN 1 AND 100000;
 SET v_count=JSON_LENGTH(p_cart_json);
 IF v_valid<>v_count THEN LEAVE checkout; END IF;
 SELECT COUNT(DISTINCT variant_id) INTO v_valid FROM JSON_TABLE(p_cart_json,'$[*]'
 COLUMNS(variant_id INT PATH '$.variantId')) j;
 IF v_valid<>v_count THEN SET p_status='DUPLICATE_VARIANTS_IN_CART'; LEAVE checkout; END IF;
 IF p_payment_method IS NULL OR p_payment_method NOT IN ('cod','card') THEN
 SET p_status='INVALID_PAYMENT_METHOD'; LEAVE checkout; END IF;
 IF p_payment_method='card' THEN SET p_status='PAYMENT_GATEWAY_UNAVAILABLE'; LEAVE checkout; END IF;
 IF p_delivery_mode IS NULL OR p_delivery_mode NOT IN ('delivery','pickup') THEN
 SET p_status='INVALID_DELIVERY_MODE'; LEAVE checkout; END IF;
 IF NOT EXISTS(SELECT 1 FROM customer WHERE customer_id=p_customer_id) THEN
 SET p_status='INVALID_CUSTOMER'; LEAVE checkout; END IF;
 IF p_delivery_mode='delivery' AND (p_address IS NULL OR CHAR_LENGTH(TRIM(p_address))<5
 OR p_city_id IS NULL OR NOT EXISTS(SELECT 1 FROM city WHERE city_id=p_city_id)) THEN
 SET p_status='INVALID_DELIVERY_ADDRESS'; LEAVE checkout; END IF;
 START TRANSACTION;
 -- Lock actual rows in ascending ID order, not an aggregate.
 WHILE v_count>0 DO
   SELECT MIN(variant_id) INTO v_id FROM JSON_TABLE(p_cart_json,'$[*]'
   COLUMNS(variant_id INT PATH '$.variantId')) j WHERE variant_id>v_previous;
   SET v_stock=NULL; SET v_price=NULL;
   BEGIN
     DECLARE CONTINUE HANDLER FOR NOT FOUND SET v_stock=NULL;
     SELECT stock_quantity,price INTO v_stock,v_price FROM variant WHERE variant_id=v_id FOR UPDATE;
   END;
   IF v_stock IS NULL OR v_price IS NULL OR v_price<=0 OR NOT EXISTS(
     SELECT 1 FROM variant v JOIN product p ON p.product_id=v.product_id
     WHERE v.variant_id=v_id AND p.is_active=TRUE) THEN
     ROLLBACK; SET p_status='UNKNOWN_VARIANT_OR_INVALID_PRICE_OR_RETIRED'; LEAVE checkout;
   END IF;
   SELECT quantity INTO v_valid FROM JSON_TABLE(p_cart_json,'$[*]'
   COLUMNS(variant_id INT PATH '$.variantId',quantity INT PATH '$.quantity')) j WHERE variant_id=v_id;
   IF v_valid>v_stock THEN ROLLBACK; SET p_status='INSUFFICIENT_STOCK'; LEAVE checkout; END IF;
   SET v_total=v_total+v_valid*v_price;
   SET v_previous=v_id; SET v_count=v_count-1;
 END WHILE;
 INSERT INTO orders(customer_id,order_date,order_status,total_amount,delivery_mode,payment_method)
 VALUES(p_customer_id,NOW(),'Confirmed',v_total,p_delivery_mode,p_payment_method);
 SET p_order_id=LAST_INSERT_ID();
 INSERT INTO order_item(order_id,variant_id,quantity,unit_price)
 SELECT p_order_id,j.variant_id,j.quantity,v.price FROM JSON_TABLE(p_cart_json,'$[*]'
 COLUMNS(variant_id INT PATH '$.variantId',quantity INT PATH '$.quantity')) j
 JOIN variant v ON v.variant_id=j.variant_id;
 IF p_delivery_mode='delivery' THEN
   SELECT IF(is_main_city,5,7) INTO v_days FROM city WHERE city_id=p_city_id;
 END IF;
 INSERT INTO delivery(order_id,city_id,address_line,delivery_mode,est_delivery_date,delivery_status)
 VALUES(p_order_id,IF(p_delivery_mode='delivery',p_city_id,NULL),
 IF(p_delivery_mode='delivery',TRIM(p_address),NULL),p_delivery_mode,
 IF(p_delivery_mode='delivery',DATE_ADD(CURDATE(),INTERVAL v_days DAY),NULL),'Pending');
 INSERT INTO payment(order_id,payment_method,payment_status,amount,payment_date)
 VALUES(p_order_id,'cod','Pending',v_total,NULL);
 UPDATE variant v JOIN order_item i ON i.variant_id=v.variant_id AND i.order_id=p_order_id
 SET v.stock_quantity=v.stock_quantity-i.quantity;
 COMMIT; SET p_status='SUCCESS';
END//
DROP PROCEDURE IF EXISTS ProcessCheckout//
-- Compatibility: delivery uses stored customer address; new callers use V2.
CREATE PROCEDURE ProcessCheckout(IN p_customer_id INT,IN p_cart_json JSON,
 IN p_delivery_mode VARCHAR(50),IN p_payment_method VARCHAR(50),OUT p_status VARCHAR(255))
BEGIN
 DECLARE v_city INT; DECLARE v_address VARCHAR(255); DECLARE v_order INT;
 SELECT city_id,address_line INTO v_city,v_address FROM customer WHERE customer_id=p_customer_id;
 CALL ProcessCheckoutV2(p_customer_id,p_cart_json,LOWER(p_delivery_mode),LOWER(p_payment_method),
 v_city,v_address,p_status,v_order);
END//
DELIMITER ;
