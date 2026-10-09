-- Non-destructive shared integration upgrade. Run with application writes paused.
-- Existing data must already satisfy these contracts; duplicate payment/delivery
-- rows and NULL variant values are rejected rather than silently repaired.
USE brightbuy;
DROP PROCEDURE IF EXISTS brightbuy_schema_upgrade;
DELIMITER $$
CREATE PROCEDURE brightbuy_schema_upgrade()
BEGIN
  IF EXISTS (SELECT 1 FROM variant WHERE price IS NULL OR stock_quantity IS NULL) THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Review NULL variant price/stock before upgrading';
  END IF;
  IF EXISTS (SELECT order_id FROM payment GROUP BY order_id HAVING COUNT(*) > 1)
    OR EXISTS (SELECT order_id FROM delivery GROUP BY order_id HAVING COUNT(*) > 1) THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Review duplicate payment/delivery records before upgrading';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='brightbuy' AND table_name='delivery' AND column_name='address_line') THEN
    ALTER TABLE delivery ADD COLUMN address_line VARCHAR(255) AFTER city_id;
  END IF;
  ALTER TABLE variant MODIFY price DECIMAL(10,2) NOT NULL, MODIFY stock_quantity INT NOT NULL;
  IF NOT EXISTS (SELECT 1 FROM information_schema.statistics WHERE table_schema='brightbuy' AND table_name='orders' AND index_name='idx_orders_customer_date') THEN
    CREATE INDEX idx_orders_customer_date ON orders(customer_id, order_date);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.statistics WHERE table_schema='brightbuy' AND table_name='orders' AND index_name='idx_orders_status_date') THEN
    CREATE INDEX idx_orders_status_date ON orders(order_status, order_date);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.statistics WHERE table_schema='brightbuy' AND table_name='payment' AND non_unique=0 AND column_name='order_id') THEN
    CREATE UNIQUE INDEX uq_payment_order ON payment(order_id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.statistics WHERE table_schema='brightbuy' AND table_name='delivery' AND non_unique=0 AND column_name='order_id') THEN
    CREATE UNIQUE INDEX uq_delivery_order ON delivery(order_id);
  END IF;
END$$
DELIMITER ;
CALL brightbuy_schema_upgrade();
DROP PROCEDURE brightbuy_schema_upgrade;
