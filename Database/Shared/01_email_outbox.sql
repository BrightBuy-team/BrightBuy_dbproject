-- =========================================================
-- BrightBuy | Shared | 01 Email outbox (SRS 3.3.3, DEP-2, SAF-8)
-- Tables: email_outbox
-- Run before Auth/02 and Checkout/02, which queue messages here.
-- Safe to rerun: the table is kept, the routines are replaced.
--
-- No email provider is selected for this phase (TBD-4), so the email service
-- is simulated: registration, order-confirmation and password-reset messages
-- are queued here and the backend's dispatcher marks them as sent.
-- Queuing never blocks or rolls back the business action that caused it.
-- =========================================================
USE brightbuy;

CREATE TABLE IF NOT EXISTS email_outbox (
    email_id   BIGINT AUTO_INCREMENT PRIMARY KEY,
    recipient  VARCHAR(150) NOT NULL,
    category   VARCHAR(30)  NOT NULL,
    subject    VARCHAR(200) NOT NULL,
    body       TEXT         NOT NULL,
    related_id INT          NULL,        -- order_id, customer_id or employee_id
    status     VARCHAR(10)  NOT NULL DEFAULT 'Pending',
    created_at DATETIME     NOT NULL DEFAULT (UTC_TIMESTAMP()),
    sent_at    DATETIME     NULL,
    CONSTRAINT chk_email_category CHECK (category IN ('registration','order_confirmation','password_reset')),
    CONSTRAINT chk_email_status   CHECK (status IN ('Pending','Sent','Failed')),
    INDEX idx_email_status_created (status, created_at),
    INDEX idx_email_recipient (recipient)
) ENGINE=InnoDB;

DROP PROCEDURE IF EXISTS sp_email_enqueue;
DROP PROCEDURE IF EXISTS sp_email_pending;
DROP PROCEDURE IF EXISTS sp_email_mark;

DELIMITER //

CREATE PROCEDURE sp_email_enqueue(
    IN p_recipient  VARCHAR(150),
    IN p_category   VARCHAR(30),
    IN p_subject    VARCHAR(200),
    IN p_body       TEXT,
    IN p_related_id INT
)
MODIFIES SQL DATA
BEGIN
    INSERT INTO email_outbox (recipient, category, subject, body, related_id)
    VALUES (p_recipient, p_category, p_subject, p_body, p_related_id);
END //

-- Oldest unsent messages for the dispatcher.
CREATE PROCEDURE sp_email_pending(IN p_limit INT)
READS SQL DATA
BEGIN
    SELECT email_id, recipient, category, subject
    FROM email_outbox
    WHERE status = 'Pending'
    ORDER BY created_at, email_id
    LIMIT p_limit;
END //

-- Records the delivery result. Only a pending message can change state.
CREATE PROCEDURE sp_email_mark(IN p_email_id BIGINT, IN p_sent BOOLEAN)
MODIFIES SQL DATA
BEGIN
    UPDATE email_outbox
    SET status = IF(p_sent, 'Sent', 'Failed'),
        sent_at = IF(p_sent, UTC_TIMESTAMP(), NULL)
    WHERE email_id = p_email_id AND status = 'Pending';
END //

DELIMITER ;
