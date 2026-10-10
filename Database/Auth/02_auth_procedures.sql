-- =========================================================
-- BrightBuy | User & Auth | 02 Procedures and functions
-- Module owner: Atapattu D.M.
-- Run after Auth/01 and Shared/01 (messages are queued in email_outbox).
-- Safe to reinstall: replaces seven procedures and two functions.
-- Passwords are hashed by the application with BCrypt (SEC-1); the database
-- stores and returns hashes only and never sees a plain password.
-- =========================================================
USE brightbuy;

DROP PROCEDURE IF EXISTS sp_register_customer;
DROP PROCEDURE IF EXISTS sp_create_employee;
DROP PROCEDURE IF EXISTS sp_get_customer_login;
DROP PROCEDURE IF EXISTS sp_get_employee_login;
DROP PROCEDURE IF EXISTS sp_log_login;
DROP PROCEDURE IF EXISTS sp_password_reset_request;
DROP PROCEDURE IF EXISTS sp_password_reset_confirm;
DROP FUNCTION IF EXISTS fn_recent_failures;
DROP FUNCTION IF EXISTS fn_employee_has_role;

DELIMITER //

-- Register a customer (app passes the BCrypt hash)
CREATE PROCEDURE sp_register_customer(
    IN  p_first_name    VARCHAR(100),
    IN  p_last_name     VARCHAR(100),
    IN  p_email         VARCHAR(150),
    IN  p_password_hash VARCHAR(255),
    IN  p_phone         VARCHAR(20),
    IN  p_address_line  VARCHAR(255),
    IN  p_city_id       INT,
    OUT p_customer_id   INT
)
BEGIN
    DECLARE EXIT HANDLER FOR 1062
    BEGIN
        SET p_customer_id = NULL;
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Email already registered';
    END;

    INSERT INTO customer (first_name, last_name, email, password_hash, phone, address_line, city_id)
    VALUES (p_first_name, p_last_name, p_email, p_password_hash, p_phone, p_address_line, p_city_id);

    SET p_customer_id = LAST_INSERT_ID();

    -- Registration confirmation. A queuing problem must not undo the account.
    BEGIN
        DECLARE CONTINUE HANDLER FOR SQLEXCEPTION BEGIN END;
        CALL sp_email_enqueue(p_email, 'registration', 'Welcome to BrightBuy',
            CONCAT('Hello ', p_first_name, ', your BrightBuy account is ready. You can now sign in and place orders.'),
            p_customer_id);
    END;
END //

-- Admin creates an employee account
CREATE PROCEDURE sp_create_employee(
    IN  p_first_name    VARCHAR(100),
    IN  p_last_name     VARCHAR(100),
    IN  p_email         VARCHAR(150),
    IN  p_password_hash VARCHAR(255),
    IN  p_contact_no    VARCHAR(20),
    IN  p_role          VARCHAR(30),
    OUT p_employee_id   INT
)
BEGIN
    DECLARE EXIT HANDLER FOR 1062
    BEGIN
        SET p_employee_id = NULL;
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Email already registered';
    END;

    INSERT INTO employee (first_name, last_name, email, password_hash, contact_no, role)
    VALUES (p_first_name, p_last_name, p_email, p_password_hash, p_contact_no, p_role);

    SET p_employee_id = LAST_INSERT_ID();
END //

-- Login lookups (BCrypt comparison is done in the app)
CREATE PROCEDURE sp_get_customer_login(IN p_email VARCHAR(150))
BEGIN
    SELECT customer_id, password_hash FROM customer WHERE email = p_email;
END //

CREATE PROCEDURE sp_get_employee_login(IN p_email VARCHAR(150))
BEGIN
    SELECT employee_id, password_hash, role
    FROM employee WHERE email = p_email AND is_active = TRUE;
END //

-- Log an attempt
CREATE PROCEDURE sp_log_login(IN p_email VARCHAR(150), IN p_type VARCHAR(10), IN p_success BOOLEAN)
BEGIN
    INSERT INTO login_attempts (email, user_type, was_success) VALUES (p_email, p_type, p_success);
END //

-- Password recovery, step 1 (UI-7). The app generates the one-time code and
-- passes it here. If the account exists (and, for an employee, is active) the
-- code's hash is stored, earlier unused codes are cancelled and the code is
-- emailed. Unknown addresses and more than three requests in 15 minutes do
-- nothing; the app answers every request identically so that an email
-- address cannot be probed.
CREATE PROCEDURE sp_password_reset_request(
    IN  p_email        VARCHAR(150),
    IN  p_account_type VARCHAR(10),
    IN  p_code         VARCHAR(128),
    OUT p_issued       BOOLEAN
)
request: BEGIN
    DECLARE v_customer_id INT DEFAULT NULL;
    DECLARE v_employee_id INT DEFAULT NULL;
    DECLARE v_recent INT DEFAULT 0;
    DECLARE EXIT HANDLER FOR SQLEXCEPTION
    BEGIN
        ROLLBACK;
        SET p_issued = FALSE;
        RESIGNAL;
    END;

    SET p_issued = FALSE;
    IF p_code IS NULL OR CHAR_LENGTH(p_code) < 32
       OR p_account_type IS NULL OR p_account_type NOT IN ('customer','employee') THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Invalid password reset request';
    END IF;

    IF p_account_type = 'customer' THEN
        SELECT customer_id INTO v_customer_id FROM customer WHERE email = p_email;
    ELSE
        SELECT employee_id INTO v_employee_id FROM employee WHERE email = p_email AND is_active = TRUE;
    END IF;
    IF v_customer_id IS NULL AND v_employee_id IS NULL THEN
        LEAVE request;
    END IF;

    SELECT COUNT(*) INTO v_recent FROM password_reset_token
    WHERE (customer_id <=> v_customer_id) AND (employee_id <=> v_employee_id)
      AND created_at > UTC_TIMESTAMP() - INTERVAL 15 MINUTE;
    IF v_recent >= 3 THEN
        LEAVE request;
    END IF;

    START TRANSACTION;
    UPDATE password_reset_token SET used_at = UTC_TIMESTAMP()
    WHERE (customer_id <=> v_customer_id) AND (employee_id <=> v_employee_id) AND used_at IS NULL;

    INSERT INTO password_reset_token (customer_id, employee_id, token_hash, expires_at)
    VALUES (v_customer_id, v_employee_id, SHA2(p_code, 256), UTC_TIMESTAMP() + INTERVAL 30 MINUTE);

    CALL sp_email_enqueue(p_email, 'password_reset', 'Reset your BrightBuy password',
        CONCAT('Use this one-time code to choose a new password: ', p_code,
               '. It expires in 30 minutes. If you did not ask for it, ignore this message.'),
        COALESCE(v_customer_id, v_employee_id));
    COMMIT;
    SET p_issued = TRUE;
END //

-- Password recovery, step 2. Exchanges a valid, unused, unexpired code for a
-- new password hash. p_status: SUCCESS or INVALID_OR_EXPIRED.
CREATE PROCEDURE sp_password_reset_confirm(
    IN  p_code              VARCHAR(128),
    IN  p_new_password_hash VARCHAR(255),
    OUT p_status            VARCHAR(20)
)
confirm: BEGIN
    DECLARE v_token_id BIGINT DEFAULT NULL;
    DECLARE v_customer_id INT DEFAULT NULL;
    DECLARE v_employee_id INT DEFAULT NULL;
    DECLARE EXIT HANDLER FOR SQLEXCEPTION
    BEGIN
        ROLLBACK;
        SET p_status = 'INVALID_OR_EXPIRED';
        RESIGNAL;
    END;

    SET p_status = 'INVALID_OR_EXPIRED';
    IF p_code IS NULL OR p_new_password_hash IS NULL OR CHAR_LENGTH(p_new_password_hash) < 20 THEN
        LEAVE confirm;
    END IF;

    START TRANSACTION;
    BEGIN
        DECLARE CONTINUE HANDLER FOR NOT FOUND SET v_token_id = NULL;
        SELECT token_id, customer_id, employee_id INTO v_token_id, v_customer_id, v_employee_id
        FROM password_reset_token
        WHERE token_hash = SHA2(p_code, 256) AND used_at IS NULL AND expires_at > UTC_TIMESTAMP()
        FOR UPDATE;
    END;
    IF v_token_id IS NULL
       OR (v_employee_id IS NOT NULL AND NOT EXISTS (
            SELECT 1 FROM employee WHERE employee_id = v_employee_id AND is_active = TRUE)) THEN
        ROLLBACK;
        LEAVE confirm;
    END IF;

    IF v_customer_id IS NOT NULL THEN
        UPDATE customer SET password_hash = p_new_password_hash WHERE customer_id = v_customer_id;
    ELSE
        UPDATE employee SET password_hash = p_new_password_hash WHERE employee_id = v_employee_id;
    END IF;
    UPDATE password_reset_token SET used_at = UTC_TIMESTAMP() WHERE token_id = v_token_id;
    -- The used code no longer needs to stay readable in the queued message.
    UPDATE email_outbox SET body = 'Password reset code (used).'
    WHERE category = 'password_reset' AND related_id = COALESCE(v_customer_id, v_employee_id)
      AND LOCATE(p_code, body) > 0;
    COMMIT;
    SET p_status = 'SUCCESS';
END //

-- Failed attempts in the last 15 minutes; app blocks login if >= 5
CREATE FUNCTION fn_recent_failures(p_email VARCHAR(150)) RETURNS INT
READS SQL DATA
BEGIN
    RETURN (SELECT COUNT(*) FROM login_attempts
            WHERE email = p_email AND was_success = FALSE
              AND attempted_at > UTC_TIMESTAMP() - INTERVAL 15 MINUTE);
END //

-- Role check helper, reusable by other modules (BR-14, BR-15)
CREATE FUNCTION fn_employee_has_role(p_employee_id INT, p_role VARCHAR(30)) RETURNS BOOLEAN
READS SQL DATA
BEGIN
    RETURN EXISTS (SELECT 1 FROM employee
                   WHERE employee_id = p_employee_id AND role = p_role AND is_active = TRUE);
END //

DELIMITER ;
