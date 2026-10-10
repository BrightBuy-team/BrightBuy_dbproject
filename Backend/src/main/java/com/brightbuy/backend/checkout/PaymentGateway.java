package com.brightbuy.backend.checkout;

import com.brightbuy.backend.checkout.CheckoutRequest.CardDetails;
import java.math.BigDecimal;

/**
 * The card payment gateway (SRS 3.3.2). The application sends the amount and the card details
 * and keeps only what comes back: a token, a reference, the last four digits and the card type.
 */
public interface PaymentGateway {

    /** False when card payments are switched off; cash on delivery still works (DEP-1). */
    boolean available();

    /** Asks the gateway to authorise the amount on the card. */
    Authorisation authorise(BigDecimal amount, String currency, CardDetails card);

    /** Releases an authorisation whose order could not be completed. */
    void cancel(String reference);

    /**
     * @param failure INVALID_CARD or CARD_DECLINED when not approved, otherwise null
     */
    record Authorisation(boolean approved, String failure, String token, String reference,
            String lastFour, String cardType) {
        static Authorisation refused(String failure) {
            return new Authorisation(false, failure, null, null, null, null);
        }
    }
}
