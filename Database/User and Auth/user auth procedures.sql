-- BrightBuy | User & Auth | 02 Procedures and functions
DELIMITER //

-- Register a customer (app passes bcrypt hash)
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

-- Login lookups (bcrypt comparison is done in the app)
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
