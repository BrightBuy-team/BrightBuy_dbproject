package com.brightbuy.backend.email;

/** Delivers one queued message. Returns false when delivery failed. */
public interface EmailSender {
    boolean send(long emailId, String recipient, String category, String subject);
}
