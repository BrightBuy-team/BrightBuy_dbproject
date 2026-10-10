package com.brightbuy.backend.email;

import java.util.List;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.dao.DataAccessException;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

/**
 * Hands queued emails to the email service, a few at a time.
 *
 * <p>Registration, order and password-reset messages are queued by the database while the
 * business action happens. They are sent here, afterwards and separately, so an email problem
 * can never delay or undo an order (DEP-2, SAF-8).
 */
@Component
@ConditionalOnProperty(name = "brightbuy.email.dispatch-enabled", havingValue = "true", matchIfMissing = true)
public class EmailDispatchJob {
    private static final Logger log = LoggerFactory.getLogger(EmailDispatchJob.class);
    private static final int BATCH_SIZE = 20;

    private final JdbcTemplate jdbc;
    private final EmailSender sender;

    public EmailDispatchJob(JdbcTemplate jdbc, EmailSender sender) {
        this.jdbc = jdbc;
        this.sender = sender;
    }

    @Scheduled(initialDelayString = "${brightbuy.email.dispatch-interval-ms:30000}",
            fixedDelayString = "${brightbuy.email.dispatch-interval-ms:30000}")
    public void dispatchPending() {
        try {
            List<Pending> pending = jdbc.query("CALL sp_email_pending(?)",
                    (row, index) -> new Pending(row.getLong("email_id"), row.getString("recipient"),
                            row.getString("category"), row.getString("subject")),
                    BATCH_SIZE);
            for (Pending email : pending) {
                boolean sent = sender.send(email.id(), email.recipient(), email.category(), email.subject());
                jdbc.update("CALL sp_email_mark(?, ?)", email.id(), sent);
            }
        } catch (DataAccessException exception) {
            log.warn("Email queue is unavailable; it will be tried again: {}", exception.getClass().getSimpleName());
        }
    }

    private record Pending(long id, String recipient, String category, String subject) {
    }
}
