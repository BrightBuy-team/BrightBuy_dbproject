-- DISPOSABLE ONLY. Adds 10,000 fictional products; not a production migration.
-- Run after baseline suites, with mysql --init-command='SET @brightbuy_disposable_tests=1'.
USE brightbuy;
DROP PROCEDURE IF EXISTS seed_catalogue_performance;
DELIMITER //
CREATE PROCEDURE seed_catalogue_performance()
BEGIN
 IF COALESCE(@brightbuy_disposable_tests,0)<>1 THEN
  SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='Explicit disposable performance opt-in required';
 END IF;
 IF EXISTS(SELECT 1 FROM product WHERE sku LIKE 'PERF-%') THEN
  SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='Performance fixtures already exist; use another fresh instance';
 END IF;
 SET @brightbuy_actor='performance-fixture';
 START TRANSACTION;
 INSERT INTO product(sku,name,description,is_active)
 SELECT CONCAT('PERF-',LPAD(n,5,'0')),CONCAT('Performance Phone ',LPAD(n,5,'0')),'Fictional local load-test product',TRUE
 FROM (
  SELECT a.n+10*b.n+100*c.n+1000*d.n+1 AS n
  FROM (SELECT 0 n UNION ALL SELECT 1 UNION ALL SELECT 2 UNION ALL SELECT 3 UNION ALL SELECT 4 UNION ALL SELECT 5 UNION ALL SELECT 6 UNION ALL SELECT 7 UNION ALL SELECT 8 UNION ALL SELECT 9) a
  CROSS JOIN (SELECT 0 n UNION ALL SELECT 1 UNION ALL SELECT 2 UNION ALL SELECT 3 UNION ALL SELECT 4 UNION ALL SELECT 5 UNION ALL SELECT 6 UNION ALL SELECT 7 UNION ALL SELECT 8 UNION ALL SELECT 9) b
  CROSS JOIN (SELECT 0 n UNION ALL SELECT 1 UNION ALL SELECT 2 UNION ALL SELECT 3 UNION ALL SELECT 4 UNION ALL SELECT 5 UNION ALL SELECT 6 UNION ALL SELECT 7 UNION ALL SELECT 8 UNION ALL SELECT 9) c
  CROSS JOIN (SELECT 0 n UNION ALL SELECT 1 UNION ALL SELECT 2 UNION ALL SELECT 3 UNION ALL SELECT 4 UNION ALL SELECT 5 UNION ALL SELECT 6 UNION ALL SELECT 7 UNION ALL SELECT 8 UNION ALL SELECT 9) d
 ) sequence;
 INSERT INTO product_category(product_id,category_id) SELECT product_id,1 FROM product WHERE sku LIKE 'PERF-%';
 INSERT INTO variant(product_id,warehouse_id,variant_name,price,stock_quantity)
 SELECT product_id,1,name,100.00,10 FROM product WHERE sku LIKE 'PERF-%';
 COMMIT; SET @brightbuy_actor=NULL;
 SELECT COUNT(*) AS fictional_load_products FROM product WHERE sku LIKE 'PERF-%';
END//
DELIMITER ;
CALL seed_catalogue_performance();
DROP PROCEDURE seed_catalogue_performance;
