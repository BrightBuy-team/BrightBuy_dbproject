DELIMITER //

-- Function: Calculates delivery date (5 days vs 7 days + out of stock penalty)
CREATE FUNCTION calculate_delivery_date(p_city_id INT, p_order_id INT) 
RETURNS DATE
DETERMINISTIC
BEGIN
    DECLARE v_is_main_city BOOLEAN;
    DECLARE v_base_days INT;
    DECLARE v_out_of_stock_count INT;
    DECLARE v_total_days INT;

    SELECT is_main_city INTO v_is_main_city FROM city WHERE city_id = p_city_id;

    IF v_is_main_city = TRUE THEN SET v_base_days = 5;
    ELSE SET v_base_days = 7;
    END IF;

    SELECT COUNT(*) INTO v_out_of_stock_count
    FROM order_item oi
    JOIN variant v ON oi.variant_id = v.variant_id
    WHERE oi.order_id = p_order_id AND v.stock_quantity <= 0;

    IF v_out_of_stock_count > 0 THEN SET v_total_days = v_base_days + 3;
    ELSE SET v_total_days = v_base_days;
    END IF;

    RETURN DATE_ADD(CURDATE(), INTERVAL v_total_days DAY);
END //

-- Trigger: Atomic inventory decrement on order placement
CREATE TRIGGER after_order_item_insert
AFTER INSERT ON order_item
FOR EACH ROW
BEGIN
    UPDATE variant
    SET stock_quantity = stock_quantity - NEW.quantity
    WHERE variant_id = NEW.variant_id;
END //

-- Trigger: Audit variant stock changes (SAF-7) (all changes in varient stock shall be written to this table)
CREATE TRIGGER after_variant_update
AFTER UPDATE ON variant
FOR EACH ROW
BEGIN
    IF OLD.stock_quantity != NEW.stock_quantity THEN
        INSERT INTO variant_audit (variant_id, old_stock_quantity, new_stock_quantity, changed_by)
        VALUES (NEW.variant_id, OLD.stock_quantity, NEW.stock_quantity, USER());
    END IF;
END //

DELIMITER ;