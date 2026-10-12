package com.brightbuy.backend.email;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Component;

/**
 * Stand-in for the SMTP relay, which has no chosen provider in this phase (SRS 3.3.3, TBD-4).
 * Nothing leaves the server: the message stays readable in the email_outbox table and is simply
 * marked as sent. Replace this bean with a real SMTP sender when a provider is chosen.
 */
@Component
public class SimulatedEmailSender implements EmailSender {
    private static final Logger log = LoggerFactory.getLogger(SimulatedEmailSender.class);

    @Override
    public boolean send(long emailId, String recipient, String category, String subject) {
        // The address and the content are personal data, so only the ID and kind are logged.
        log.info("Simulated email service accepted message {} ({})", emailId, category);
        return true;
    }
}
