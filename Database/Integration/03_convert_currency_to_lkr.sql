-- HISTORICAL OPT-IN ONLY: current project currency is USD. DO NOT RUN this
-- during normal setup or Azure deployment. Retained for audit/recovery history.
-- One-time stored-money conversion. All pre-existing amounts are treated as USD
-- by explicit user/team approval. New writes after completion are already LKR.
-- PAUSE APPLICATION WRITES and back up shared DBs before owner-run deployment.
-- Opt in: mysql --init-command='SET @brightbuy_convert_all_usd=1' ...
-- Rate displayed by CBSL and retrieved 2026-10-09; frozen, not a live FX feed:
-- https://www.cbsl.gov.lk/cbsl_custom/charts/usd/indexsmall.php
USE brightbuy;
CREATE TABLE IF NOT EXISTS currency_conversion_log (
 migration_key VARCHAR(50) PRIMARY KEY,
 source_currency CHAR(3) NOT NULL, target_currency CHAR(3) NOT NULL,
 lkr_per_usd DECIMAL(12,4) NOT NULL, rate_source VARCHAR(500) NOT NULL,
 rate_retrieved_on DATE NOT NULL, completed_at DATETIME NOT NULL,
 executed_by VARCHAR(255) NOT NULL
) ENGINE=InnoDB;
CREATE TABLE IF NOT EXISTS currency_conversion_values (
 migration_key VARCHAR(50) NOT NULL, entity_type VARCHAR(30) NOT NULL,
 row_key VARCHAR(100) NOT NULL, original_amount DECIMAL(24,2),
 converted_amount DECIMAL(24,2),
 PRIMARY KEY(migration_key,entity_type,row_key)
) ENGINE=InnoDB;
DROP PROCEDURE IF EXISTS convert_all_usd_to_lkr;
DELIMITER //
CREATE PROCEDURE convert_all_usd_to_lkr()
SQL SECURITY INVOKER
conversion: BEGIN
 DECLARE rate DECIMAL(12,4) DEFAULT 330.9617;
 DECLARE locked INT DEFAULT 0;
 DECLARE EXIT HANDLER FOR SQLEXCEPTION
 BEGIN
  ROLLBACK;
  IF locked=1 THEN DO RELEASE_LOCK('brightbuy_currency_conversion'); END IF;
  RESIGNAL;
 END;
 IF COALESCE(@brightbuy_convert_all_usd,0)<>1 THEN
  SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='Explicit approval that all existing amounts are USD is required';
 END IF;
 IF FIND_IN_SET('STRICT_TRANS_TABLES',@@session.sql_mode)=0
 AND FIND_IN_SET('STRICT_ALL_TABLES',@@session.sql_mode)=0 THEN
  SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='Strict SQL mode is required for monetary conversion';
 END IF;
 SELECT GET_LOCK('brightbuy_currency_conversion',5) INTO locked;
 IF locked<>1 OR locked IS NULL THEN SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='Another currency conversion is running'; END IF;
 START TRANSACTION;
 IF EXISTS(SELECT 1 FROM currency_conversion_log WHERE migration_key='USD_TO_LKR_V1') THEN
  COMMIT; DO RELEASE_LOCK('brightbuy_currency_conversion');
  SELECT 'SKIP: already converted to LKR; amounts unchanged' AS result;
  LEAVE conversion;
 END IF;
 -- Never silently truncate/overflow or rewrite inconsistent historic totals.
 IF EXISTS(SELECT 1 FROM variant WHERE price IS NULL OR price<0 OR ROUND(price*rate,2)>99999999.99)
 OR EXISTS(SELECT 1 FROM order_item WHERE unit_price IS NULL OR unit_price<0 OR ROUND(unit_price*rate,2)>99999999.99)
 OR EXISTS(SELECT 1 FROM orders WHERE total_amount IS NULL OR total_amount<0 OR ROUND(total_amount*rate,2)>99999999.99)
 OR EXISTS(SELECT 1 FROM payment WHERE amount<0 OR ROUND(amount*rate,2)>99999999.99)
 OR EXISTS(SELECT 1 FROM sales_summary WHERE total_revenue<0 OR ROUND(total_revenue*rate,2)>9999999999.99) THEN
  SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='Invalid or overflowing monetary value; no conversion applied';
 END IF;
 IF EXISTS(SELECT 1 FROM orders o LEFT JOIN
   (SELECT order_id,SUM(quantity*unit_price) total FROM order_item GROUP BY order_id) i USING(order_id)
   WHERE i.total IS NULL OR o.total_amount<>i.total) THEN
  SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='Order totals differ from line totals; owner review required before conversion';
 END IF;
 INSERT INTO currency_conversion_values(migration_key,entity_type,row_key,original_amount)
 SELECT 'USD_TO_LKR_V1','variant',CAST(variant_id AS CHAR),price FROM variant
 UNION ALL SELECT 'USD_TO_LKR_V1','order',CAST(order_id AS CHAR),total_amount FROM orders
 UNION ALL SELECT 'USD_TO_LKR_V1','order_item',CONCAT(order_id,':',variant_id),unit_price FROM order_item
 UNION ALL SELECT 'USD_TO_LKR_V1','payment',CAST(payment_id AS CHAR),amount FROM payment
 UNION ALL SELECT 'USD_TO_LKR_V1','summary',CAST(summary_id AS CHAR),total_revenue FROM sales_summary;
 UPDATE variant SET price=ROUND(price*rate,2);
 UPDATE order_item SET unit_price=ROUND(unit_price*rate,2);
 -- Sum rounded unit prices, so customer order totals match their line items.
 UPDATE orders o JOIN (SELECT order_id,SUM(quantity*unit_price) total FROM order_item GROUP BY order_id) i USING(order_id)
 SET o.total_amount=i.total;
 UPDATE payment p JOIN orders o USING(order_id)
 JOIN currency_conversion_values original_order ON original_order.entity_type='order'
  AND original_order.migration_key='USD_TO_LKR_V1' AND original_order.row_key=CAST(o.order_id AS CHAR)
 SET p.amount=IF(p.amount=original_order.original_amount,o.total_amount,ROUND(p.amount*rate,2));
 UPDATE sales_summary SET total_revenue=ROUND(total_revenue*rate,2);
 -- Reconcile summaries with actual rounded line prices where history is present.
 UPDATE sales_summary s JOIN (
  SELECT oi.variant_id,DATE(o.order_date) day,SUM(oi.quantity*oi.unit_price) revenue,
   SUM(oi.quantity) units,COUNT(DISTINCT o.order_id) orders_count
  FROM orders o JOIN order_item oi USING(order_id) WHERE o.order_status<>'Cancelled'
  GROUP BY oi.variant_id,DATE(o.order_date)
 ) history ON history.variant_id=s.variant_id AND history.day=s.summary_date
 SET s.total_revenue=history.revenue
 WHERE s.units_sold=history.units AND s.order_count=history.orders_count;
 UPDATE currency_conversion_values b JOIN (
  SELECT 'variant' entity_type,CAST(variant_id AS CHAR) row_key,price amount FROM variant
  UNION ALL SELECT 'order',CAST(order_id AS CHAR),total_amount FROM orders
  UNION ALL SELECT 'order_item',CONCAT(order_id,':',variant_id),unit_price FROM order_item
  UNION ALL SELECT 'payment',CAST(payment_id AS CHAR),amount FROM payment
  UNION ALL SELECT 'summary',CAST(summary_id AS CHAR),total_revenue FROM sales_summary
 ) current_values ON b.entity_type=current_values.entity_type AND b.row_key=current_values.row_key
 SET b.converted_amount=current_values.amount WHERE b.migration_key='USD_TO_LKR_V1';
 INSERT INTO currency_conversion_log VALUES('USD_TO_LKR_V1','USD','LKR',rate,
  'https://www.cbsl.gov.lk/cbsl_custom/charts/usd/indexsmall.php','2026-10-09',UTC_TIMESTAMP(),USER());
 COMMIT; DO RELEASE_LOCK('brightbuy_currency_conversion');
 SELECT 'PASS: all stored monetary values converted once to LKR' AS result,rate AS lkr_per_usd;
END//
DELIMITER ;
CALL convert_all_usd_to_lkr();
DROP PROCEDURE convert_all_usd_to_lkr;
