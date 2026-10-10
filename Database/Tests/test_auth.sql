-- =========================================================
-- BrightBuy | Tests | Accounts, sign-in rate limit, roles and password reset
-- Run on a disposable database after a fresh install (install_all.sh), as an
-- administrator. Prints PASS per assertion; a failure raises SQLSTATE 45000.
-- The reset procedures commit their own transaction, so this suite cannot
-- roll back: it uses its own auth-test-... accounts and removes them again.
-- Sign-in itself (BCrypt comparison, sessions) is covered by the HTTP tests.
-- =========================================================
USE brightbuy;
DROP PROCEDURE IF EXISTS auth_test_assert;
DROP PROCEDURE IF EXISTS auth_test_reject;
DROP PROCEDURE IF EXISTS auth_test_cleanup;
DROP PROCEDURE IF EXISTS auth_tests;
DELIMITER $$

CREATE PROCEDURE auth_test_assert(IN passed BOOLEAN, IN test_name VARCHAR(100))
BEGIN
    DECLARE failure_message VARCHAR(128);
    IF passed IS NULL OR passed = FALSE THEN
        SET failure_message = CONCAT('FAIL: ', test_name);
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = failure_message;
    END IF;
    SET @auth_test_count = @auth_test_count + 1;
    SELECT CONCAT('PASS: ', test_name) AS result;
END$$

CREATE PROCEDURE auth_test_reject(IN statement_text TEXT, IN expected_state CHAR(5), IN test_name VARCHAR(100))
BEGIN
    DECLARE actual_state CHAR(5) DEFAULT '00000';
    SET @auth_test_sql = statement_text;
    PREPARE auth_test_statement FROM @auth_test_sql;
    BEGIN
        DECLARE CONTINUE HANDLER FOR SQLEXCEPTION
            GET DIAGNOSTICS CONDITION 1 actual_state = RETURNED_SQLSTATE;
        EXECUTE auth_test_statement;
    END;
    DEALLOCATE PREPARE auth_test_statement;
    CALL auth_test_assert(actual_state = expected_state, test_name);
END$$

CREATE PROCEDURE auth_test_cleanup()
BEGIN
    DELETE t FROM password_reset_token t JOIN customer c ON c.customer_id = t.customer_id
        WHERE c.email LIKE 'auth-test-%@example.invalid';
    DELETE t FROM password_reset_token t JOIN employee e ON e.employee_id = t.employee_id
        WHERE e.email LIKE 'auth-test-%@example.invalid';
    DELETE FROM email_outbox WHERE recipient LIKE 'auth-test-%@example.invalid';
    DELETE FROM login_attempts WHERE email LIKE 'auth-test-%@example.invalid';
    DELETE FROM customer WHERE email LIKE 'auth-test-%@example.invalid';
    DELETE FROM employee WHERE email LIKE 'auth-test-%@example.invalid';
    DELETE FROM audit_log WHERE actor = 'test:auth';
END$$

CREATE PROCEDURE auth_tests()
BEGIN
    DECLARE customer_email VARCHAR(150) DEFAULT 'auth-test-customer@example.invalid';
    DECLARE staff_email VARCHAR(150) DEFAULT 'auth-test-staff@example.invalid';
    DECLARE old_hash VARCHAR(255) DEFAULT '$2b$12$auth-test-old-hash-000000000000000000000000000000000000';
    DECLARE new_hash VARCHAR(255) DEFAULT '$2b$12$auth-test-new-hash-111111111111111111111111111111111111';
    DECLARE code_a VARCHAR(64) DEFAULT CONCAT('A', REPLACE(UUID(), '-', ''));
    DECLARE code_b VARCHAR(64) DEFAULT CONCAT('B', REPLACE(UUID(), '-', ''));
    DECLARE code_c VARCHAR(64) DEFAULT CONCAT('C', REPLACE(UUID(), '-', ''));
    DECLARE code_d VARCHAR(64) DEFAULT CONCAT('D', REPLACE(UUID(), '-', ''));
    DECLARE code_e VARCHAR(64) DEFAULT CONCAT('E', REPLACE(UUID(), '-', ''));
    DECLARE code_x VARCHAR(64) DEFAULT CONCAT('X', REPLACE(UUID(), '-', ''));
    DECLARE customer_id_new INT;
    DECLARE staff_id INT;
    DECLARE issued BOOLEAN;
    DECLARE reset_status VARCHAR(20);
    DECLARE EXIT HANDLER FOR SQLEXCEPTION
    BEGIN
        ROLLBACK;
        CALL auth_test_cleanup();
        SET @brightbuy_actor = NULL;
        RESIGNAL;
    END;
    SET @auth_test_count = 0;
    SET @brightbuy_actor = 'test:auth';
    CALL auth_test_cleanup();

    -- Registration
    CALL sp_register_customer('Auth', 'Tester', customer_email, old_hash, '555-0300', '1 Main St', 1, customer_id_new);
    CALL auth_test_assert(customer_id_new IS NOT NULL AND (SELECT password_hash FROM customer
        WHERE customer_id = customer_id_new) = old_hash, 'customer registration stores the supplied hash');
    CALL auth_test_assert((SELECT COUNT(*) FROM email_outbox WHERE recipient = customer_email
        AND category = 'registration' AND related_id = customer_id_new AND status = 'Pending') = 1,
        'registration confirmation is queued');
    CALL auth_test_reject(CONCAT('CALL sp_register_customer(''Auth'', ''Again'', ''', customer_email,
        ''', ''x'', NULL, NULL, 1, @auth_ignored)'), '45000', 'duplicate customer email rejected');
    CALL auth_test_reject('CALL sp_register_customer(''Bad'', ''Email'', ''not-an-email'', ''x'', NULL, NULL, 1, @auth_ignored)',
        'HY000', 'malformed email rejected by the CHECK constraint');
    CALL auth_test_reject('CALL sp_register_customer(''Bad'', ''City'', ''auth-test-city@example.invalid'', ''x'', NULL, NULL, 2147483647, @auth_ignored)',
        '23000', 'unknown city rejected by the foreign key');

    -- Employees and roles
    CALL sp_create_employee('Auth', 'Staff', staff_email, old_hash, '555-0301', 'WarehouseStaff', staff_id);
    CALL auth_test_assert(staff_id IS NOT NULL, 'employee account created');
    CALL auth_test_reject('CALL sp_create_employee(''Bad'', ''Role'', ''auth-test-role@example.invalid'', ''x'', NULL, ''Cashier'', @auth_ignored)',
        'HY000', 'unknown employee role rejected by the CHECK constraint');
    CALL auth_test_reject(CONCAT('CALL sp_create_employee(''Auth'', ''Again'', ''', staff_email,
        ''', ''x'', NULL, ''Admin'', @auth_ignored)'), '45000', 'duplicate employee email rejected');
    CALL auth_test_assert(fn_employee_has_role(staff_id, 'WarehouseStaff') = TRUE
        AND fn_employee_has_role(staff_id, 'Management') = FALSE, 'role check matches the stored role only');
    CALL auth_test_assert((SELECT COUNT(*) FROM audit_log WHERE entity_type = 'employee' AND entity_id = staff_id
        AND action = 'INSERT' AND actor = 'test:auth' AND JSON_EXTRACT(new_values, '$.password_hash') IS NULL) = 1,
        'employee creation is audited without the password hash');

    -- Sign-in rate limit (SEC-8)
    CALL sp_log_login(customer_email, 'customer', TRUE);
    CALL sp_log_login(customer_email, 'customer', FALSE);
    CALL sp_log_login(customer_email, 'customer', FALSE);
    CALL sp_log_login(customer_email, 'customer', FALSE);
    CALL sp_log_login(customer_email, 'customer', FALSE);
    CALL auth_test_assert(fn_recent_failures(customer_email) = 4, 'only failed attempts are counted');
    CALL sp_log_login(customer_email, 'customer', FALSE);
    CALL auth_test_assert(fn_recent_failures(customer_email) = 5, 'fifth failure reaches the lock threshold');
    UPDATE login_attempts SET attempted_at = UTC_TIMESTAMP() - INTERVAL 16 MINUTE WHERE email = customer_email;
    CALL auth_test_assert(fn_recent_failures(customer_email) = 0, 'failures older than 15 minutes no longer count');

    -- Password reset (UI-7)
    CALL sp_password_reset_request('auth-test-nobody@example.invalid', 'customer', code_x, issued);
    CALL auth_test_assert(issued = FALSE AND (SELECT COUNT(*) FROM email_outbox
        WHERE recipient = 'auth-test-nobody@example.invalid') = 0, 'unknown email gets no code and no message');
    CALL auth_test_reject(CONCAT('CALL sp_password_reset_request(''', customer_email, ''', ''customer'', ''short'', @auth_ignored)'),
        '45000', 'short reset code rejected');
    CALL auth_test_reject(CONCAT('CALL sp_password_reset_request(''', customer_email, ''', ''manager'', ''', code_x, ''', @auth_ignored)'),
        '45000', 'unknown account type rejected');

    CALL sp_password_reset_request(customer_email, 'customer', code_a, issued);
    CALL auth_test_assert(issued = TRUE AND (SELECT COUNT(*) FROM password_reset_token
        WHERE customer_id = customer_id_new AND token_hash = SHA2(code_a, 256) AND used_at IS NULL
          AND expires_at BETWEEN UTC_TIMESTAMP() + INTERVAL 29 MINUTE AND UTC_TIMESTAMP() + INTERVAL 31 MINUTE) = 1,
        'reset code is stored as a hash and expires in 30 minutes');
    CALL auth_test_assert((SELECT COUNT(*) FROM password_reset_token WHERE token_hash = code_a) = 0
        AND (SELECT COUNT(*) FROM email_outbox WHERE recipient = customer_email AND category = 'password_reset'
             AND LOCATE(code_a, body) > 0) = 1, 'the code itself is only in the queued message');
    CALL sp_password_reset_request(customer_email, 'customer', code_b, issued);
    CALL auth_test_assert(issued = TRUE AND (SELECT used_at FROM password_reset_token
        WHERE token_hash = SHA2(code_a, 256)) IS NOT NULL, 'a new request cancels the earlier code');
    CALL sp_password_reset_request(customer_email, 'customer', code_c, issued);
    CALL sp_password_reset_request(customer_email, 'customer', code_d, issued);
    CALL auth_test_assert(issued = FALSE AND (SELECT COUNT(*) FROM password_reset_token
        WHERE customer_id = customer_id_new) = 3, 'fourth request in 15 minutes is ignored');

    CALL sp_password_reset_confirm(code_a, new_hash, reset_status);
    CALL auth_test_assert(reset_status = 'INVALID_OR_EXPIRED', 'cancelled code is refused');
    CALL sp_password_reset_confirm(code_x, new_hash, reset_status);
    CALL auth_test_assert(reset_status = 'INVALID_OR_EXPIRED' AND (SELECT password_hash FROM customer
        WHERE customer_id = customer_id_new) = old_hash, 'unknown code is refused and the password is unchanged');
    CALL sp_password_reset_confirm(code_c, new_hash, reset_status);
    CALL auth_test_assert(reset_status = 'SUCCESS' AND (SELECT password_hash FROM customer
        WHERE customer_id = customer_id_new) = new_hash, 'valid code sets the new password hash');
    CALL auth_test_assert((SELECT used_at FROM password_reset_token WHERE token_hash = SHA2(code_c, 256)) IS NOT NULL
        AND (SELECT COUNT(*) FROM email_outbox WHERE LOCATE(code_c, body) > 0) = 0,
        'used code is closed and removed from the queued message');
    CALL sp_password_reset_confirm(code_c, old_hash, reset_status);
    CALL auth_test_assert(reset_status = 'INVALID_OR_EXPIRED' AND (SELECT password_hash FROM customer
        WHERE customer_id = customer_id_new) = new_hash, 'a code works only once');

    UPDATE password_reset_token SET created_at = UTC_TIMESTAMP() - INTERVAL 1 HOUR WHERE customer_id = customer_id_new;
    CALL sp_password_reset_request(customer_email, 'customer', code_e, issued);
    UPDATE password_reset_token SET expires_at = UTC_TIMESTAMP() - INTERVAL 1 MINUTE WHERE token_hash = SHA2(code_e, 256);
    CALL sp_password_reset_confirm(code_e, old_hash, reset_status);
    CALL auth_test_assert(issued = TRUE AND reset_status = 'INVALID_OR_EXPIRED', 'expired code is refused');

    -- Employees: only active accounts can reset
    UPDATE employee SET is_active = FALSE WHERE employee_id = staff_id;
    CALL sp_password_reset_request(staff_email, 'employee', code_x, issued);
    CALL auth_test_assert(issued = FALSE, 'disabled employee gets no reset code');
    CALL auth_test_assert(fn_employee_has_role(staff_id, 'WarehouseStaff') = FALSE, 'disabled employee holds no role');
    UPDATE employee SET is_active = TRUE WHERE employee_id = staff_id;
    CALL sp_password_reset_request(staff_email, 'employee', code_x, issued);
    CALL sp_password_reset_confirm(code_x, new_hash, reset_status);
    CALL auth_test_assert(issued = TRUE AND reset_status = 'SUCCESS' AND (SELECT password_hash FROM employee
        WHERE employee_id = staff_id) = new_hash, 'active employee resets through the same procedure');
    CALL auth_test_assert((SELECT COUNT(*) FROM audit_log WHERE entity_type = 'employee' AND entity_id = staff_id
        AND action = 'UPDATE' AND JSON_UNQUOTE(JSON_EXTRACT(new_values, '$.password_changed')) = 'true') = 1,
        'employee password change is audited as a flag only');

    CALL auth_test_cleanup();
    SET @brightbuy_actor = NULL;
    CALL auth_test_assert((SELECT COUNT(*) FROM customer WHERE email LIKE 'auth-test-%') = 0
        AND (SELECT COUNT(*) FROM employee WHERE email LIKE 'auth-test-%') = 0, 'cleanup removed the test accounts');
    SELECT CONCAT('PASS: all ', @auth_test_count, ' auth assertions') AS result;
END$$

DELIMITER ;

CALL auth_tests();
DROP PROCEDURE auth_tests;
DROP PROCEDURE auth_test_cleanup;
DROP PROCEDURE auth_test_reject;
DROP PROCEDURE auth_test_assert;
SET @auth_test_sql = NULL;
SET @auth_test_count = NULL;
