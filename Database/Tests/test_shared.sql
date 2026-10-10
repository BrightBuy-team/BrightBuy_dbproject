-- =========================================================
-- BrightBuy | Tests | Email outbox and audit log
-- Run on a disposable database after a fresh install (install_all.sh).
-- Prints PASS per assertion; a failure raises SQLSTATE 45000 and stops.
-- Row changes are rolled back on success and on failure.
-- =========================================================
USE brightbuy;
DROP PROCEDURE IF EXISTS shared_test_assert;
DROP PROCEDURE IF EXISTS shared_test_reject;
DROP PROCEDURE IF EXISTS shared_tests;
DELIMITER $$

CREATE PROCEDURE shared_test_assert(IN passed BOOLEAN, IN test_name VARCHAR(100))
BEGIN
    DECLARE failure_message VARCHAR(128);
    IF passed IS NULL OR passed = FALSE THEN
        SET failure_message = CONCAT('FAIL: ', test_name);
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = failure_message;
    END IF;
    SET @shared_test_count = @shared_test_count + 1;
    SELECT CONCAT('PASS: ', test_name) AS result;
END$$

CREATE PROCEDURE shared_test_reject(IN statement_text TEXT, IN expected_state CHAR(5), IN test_name VARCHAR(100))
BEGIN
    DECLARE actual_state CHAR(5) DEFAULT '00000';
    SET @shared_test_sql = statement_text;
    PREPARE shared_test_statement FROM @shared_test_sql;
    BEGIN
        DECLARE CONTINUE HANDLER FOR SQLEXCEPTION
            GET DIAGNOSTICS CONDITION 1 actual_state = RETURNED_SQLSTATE;
        EXECUTE shared_test_statement;
    END;
    DEALLOCATE PREPARE shared_test_statement;
    CALL shared_test_assert(actual_state = expected_state, test_name);
END$$

CREATE PROCEDURE shared_tests()
BEGIN
    DECLARE first_email BIGINT;
    DECLARE second_email BIGINT;
    DECLARE pending_before INT;
    DECLARE EXIT HANDLER FOR SQLEXCEPTION
    BEGIN
        ROLLBACK;
        SET @brightbuy_actor = NULL;
        RESIGNAL;
    END;
    SET @shared_test_count = 0;
    SET @brightbuy_actor = NULL;
    START TRANSACTION;

    -- Email outbox
    SELECT COUNT(*) INTO pending_before FROM email_outbox WHERE status = 'Pending';
    CALL sp_email_enqueue('shared-test@example.invalid', 'registration', 'First', 'First body', 7);
    SET first_email = LAST_INSERT_ID();
    CALL sp_email_enqueue('shared-test@example.invalid', 'order_confirmation', 'Second', 'Second body', 8);
    SET second_email = LAST_INSERT_ID();
    CALL shared_test_assert((SELECT COUNT(*) FROM email_outbox WHERE email_id IN (first_email, second_email)
        AND status = 'Pending' AND sent_at IS NULL) = 2, 'queued messages start as pending');
    CALL sp_email_mark(first_email, TRUE);
    CALL shared_test_assert(EXISTS (SELECT 1 FROM email_outbox WHERE email_id = first_email
        AND status = 'Sent' AND sent_at IS NOT NULL), 'a delivered message is marked sent with a time');
    CALL sp_email_mark(first_email, FALSE);
    CALL shared_test_assert((SELECT status FROM email_outbox WHERE email_id = first_email) = 'Sent',
        'a sent message cannot change state again');
    CALL sp_email_mark(second_email, FALSE);
    CALL shared_test_assert(EXISTS (SELECT 1 FROM email_outbox WHERE email_id = second_email
        AND status = 'Failed' AND sent_at IS NULL), 'a failed delivery is recorded without a sent time');
    CALL shared_test_assert((SELECT COUNT(*) FROM email_outbox WHERE status = 'Pending') = pending_before,
        'handled messages leave the pending queue');
    CALL shared_test_reject('CALL sp_email_enqueue(''shared-test@example.invalid'', ''newsletter'', ''x'', ''x'', NULL)',
        'HY000', 'unknown message category rejected by the CHECK constraint');
    CALL shared_test_reject(CONCAT('UPDATE email_outbox SET status = ''Lost'' WHERE email_id = ', second_email),
        'HY000', 'unknown message status rejected by the CHECK constraint');

    -- Audit log: direct SQL is attributed to the database account
    UPDATE product SET description = 'Audit test description' WHERE product_id = 1;
    CALL shared_test_assert((SELECT actor FROM audit_log WHERE entity_type = 'product' AND entity_id = 1
        ORDER BY audit_id DESC LIMIT 1) = USER(), 'a change without an application user records the database account');
    SET @brightbuy_actor = 'employee:42';
    UPDATE category SET description = 'Audit test description' WHERE category_id = 1;
    CALL shared_test_assert(EXISTS (SELECT 1 FROM audit_log WHERE entity_type = 'category' AND entity_id = 1
        AND actor = 'employee:42' AND action = 'UPDATE'
        AND JSON_UNQUOTE(JSON_EXTRACT(new_values, '$.description')) = 'Audit test description'
        AND changed_at IS NOT NULL), 'a change by the application records its signed-in user and the new value');
    UPDATE variant SET stock_quantity = stock_quantity + 1 WHERE variant_id = 1;
    CALL shared_test_assert((SELECT changed_by FROM variant_audit WHERE variant_id = 1 ORDER BY audit_id DESC LIMIT 1) = 'employee:42'
        AND NOT EXISTS (SELECT 1 FROM audit_log WHERE entity_type = 'variant' AND entity_id = 1),
        'stock changes go to the stock audit, not the audit log');

    ROLLBACK;
    SET @brightbuy_actor = NULL;
    SELECT CONCAT('PASS: all ', @shared_test_count, ' shared assertions; row changes rolled back') AS result;
END$$

DELIMITER ;

CALL shared_tests();
DROP PROCEDURE shared_tests;
DROP PROCEDURE shared_test_reject;
DROP PROCEDURE shared_test_assert;
SET @shared_test_sql = NULL;
SET @shared_test_count = NULL;
