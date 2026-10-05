-- BrightBuy | User & Auth | 04 Tests
-- Run after the schema, routines, seed data, and Inventory city fixtures.
USE brightbuy;

SET @auth_test_email = CONCAT('auth-test-', REPLACE(UUID(), '-', ''), '@example.com');
SET @auth_test_employee_email = CONCAT('auth-employee-', REPLACE(UUID(), '-', ''), '@example.com');

-- 1. Registration and duplicate-email rejection.
CALL sp_register_customer('Test', 'User', @auth_test_email, '$2b$10$test-hash', '555-0300', '1 Main St', 1, @cid);
SELECT @cid AS new_customer_id;

DROP PROCEDURE IF EXISTS sp_test_expected_auth_errors;
DELIMITER //
CREATE PROCEDURE sp_test_expected_auth_errors()
BEGIN
	DECLARE v_failed BOOLEAN DEFAULT FALSE;

	BEGIN
		DECLARE CONTINUE HANDLER FOR SQLEXCEPTION SET v_failed = TRUE;
		CALL sp_register_customer('Test', 'Again', @auth_test_email, '$2b$10$test-hash', '555-0301', '2 Main St', 1, @cid);
	END;
	SELECT IF(v_failed, 'PASS', 'FAIL') AS duplicate_email_rejected;

	SET v_failed = FALSE;
	BEGIN
		DECLARE CONTINUE HANDLER FOR SQLEXCEPTION SET v_failed = TRUE;
		CALL sp_register_customer('Bad', 'Email', 'not-an-email', '$2b$10$test-hash', '555', 'x', 1, @cid);
	END;
	SELECT IF(v_failed, 'PASS', 'FAIL') AS invalid_email_rejected;

	SET v_failed = FALSE;
	BEGIN
		DECLARE CONTINUE HANDLER FOR SQLEXCEPTION SET v_failed = TRUE;
		CALL sp_register_customer('Bad', 'City', 'badcity@example.com', '$2b$10$test-hash', '555', 'x', 999, @cid);
	END;
	SELECT IF(v_failed, 'PASS', 'FAIL') AS invalid_city_rejected;

	SET v_failed = FALSE;
	BEGIN
		DECLARE CONTINUE HANDLER FOR SQLEXCEPTION SET v_failed = TRUE;
		CALL sp_create_employee('Bad', 'Role', 'badrole@brightbuy.com', '$2b$10$test-hash', '555', 'Cashier', @eid);
	END;
	SELECT IF(v_failed, 'PASS', 'FAIL') AS invalid_employee_role_rejected;
END //
DELIMITER ;

CALL sp_test_expected_auth_errors();
DROP PROCEDURE sp_test_expected_auth_errors;

-- 2. Valid employee registration.
CALL sp_create_employee('New', 'Staff', @auth_test_employee_email, '$2b$10$test-hash', '555', 'WarehouseStaff', @eid);
SELECT @eid AS new_employee_id;

-- 3. Login lookups.
CALL sp_get_customer_login('abrahaml@example.com');
CALL sp_get_customer_login('nobody@example.com');
CALL sp_get_employee_login('manager@brightbuy.com');

-- 4. Rate limiting: five failures in the current 15-minute window.
CALL sp_log_login(@auth_test_email, 'customer', FALSE);
CALL sp_log_login(@auth_test_email, 'customer', FALSE);
CALL sp_log_login(@auth_test_email, 'customer', FALSE);
CALL sp_log_login(@auth_test_email, 'customer', FALSE);
CALL sp_log_login(@auth_test_email, 'customer', FALSE);
SELECT fn_recent_failures(@auth_test_email) AS failures;

-- 5. Role checks use the seeded account emails, not assumed auto-increment IDs.
SELECT fn_employee_has_role((SELECT employee_id FROM employee WHERE email = 'manager@brightbuy.com'), 'Management') AS is_manager;
SELECT fn_employee_has_role((SELECT employee_id FROM employee WHERE email = 'warehouse@brightbuy.com'), 'Management') AS is_not_manager;

-- Referential protection can be checked after checkout creates an order:
-- DELETE FROM customer WHERE email = 'abrahaml@example.com';
