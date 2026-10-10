package com.brightbuy.backend.checkout;

import com.brightbuy.backend.checkout.CheckoutRequest.CardDetails;
import java.math.BigDecimal;
import java.time.YearMonth;
import java.util.Map;
import java.util.UUID;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

/**
 * Stand-in for the external gateway, which the SRS specifies as simulated for this phase
 * (3.3.2, TBD-3). No money moves and no network call is made.
 *
 * <p>It behaves like a gateway's test mode: it checks the card details, approves only the test
 * card numbers below and declines everything else, so a real card can never be "charged".
 * Set {@code BRIGHTBUY_PAYMENT_GATEWAY=disabled} to switch card payments off.
 *
 * <ul>
 *   <li>4242 4242 4242 4242 - Visa, approved</li>
 *   <li>5555 5555 5555 4444 - Mastercard, approved</li>
 *   <li>3782 822463 10005 - American Express, approved</li>
 *   <li>any other valid number, for example 4000 0000 0000 0002 - declined</li>
 * </ul>
 * Any future expiry date, any three-digit security code (four for American Express).
 */
@Component
public class SimulatedPaymentGateway implements PaymentGateway {
    private static final Logger log = LoggerFactory.getLogger(SimulatedPaymentGateway.class);
    private static final Map<String, String> APPROVED_TEST_CARDS = Map.of(
            "4242424242424242", "Visa",
            "5555555555554444", "Mastercard",
            "378282246310005", "American Express");

    private final boolean enabled;

    public SimulatedPaymentGateway(@Value("${brightbuy.payment.gateway:simulated}") String mode) {
        this.enabled = "simulated".equalsIgnoreCase(mode.trim());
    }

    @Override
    public boolean available() {
        return enabled;
    }

    @Override
    public Authorisation authorise(BigDecimal amount, String currency, CardDetails card) {
        if (!enabled || amount == null || amount.signum() <= 0) {
            return Authorisation.refused("CARD_DECLINED");
        }
        String number = card == null || card.number() == null ? "" : card.number().replaceAll("[ -]", "");
        if (!validDetails(number, card)) {
            return Authorisation.refused("INVALID_CARD");
        }
        String cardType = APPROVED_TEST_CARDS.get(number);
        if (cardType == null) {
            return Authorisation.refused("CARD_DECLINED");
        }
        String reference = "SIM-" + UUID.randomUUID();
        // Only the reference is logged: never the card number, expiry, name or security code.
        log.info("Simulated gateway authorised {} {} as {}", currency, amount, reference);
        return new Authorisation(true, null, "tok_sim_" + UUID.randomUUID().toString().replace("-", ""),
                reference, number.substring(number.length() - 4), cardType);
    }

    @Override
    public void cancel(String reference) {
        log.info("Simulated gateway released authorisation {}", reference);
    }

    private static boolean validDetails(String number, CardDetails card) {
        if (card == null || !number.matches("[0-9]{12,19}") || !passesLuhnCheck(number)) {
            return false;
        }
        if (card.holderName() == null || card.holderName().isBlank() || card.holderName().length() > 100) {
            return false;
        }
        if (card.cvv() == null || !card.cvv().matches("[0-9]{3,4}")) {
            return false;
        }
        Integer month = card.expiryMonth();
        Integer year = card.expiryYear();
        if (month == null || year == null || month < 1 || month > 12 || year < 0 || year > 2099) {
            return false;
        }
        int fullYear = year < 100 ? 2000 + year : year;
        return !YearMonth.of(fullYear, month).isBefore(YearMonth.now());
    }

    /** The checksum every real card number satisfies; it catches typing mistakes. */
    static boolean passesLuhnCheck(String digits) {
        int sum = 0;
        boolean doubleIt = false;
        for (int index = digits.length() - 1; index >= 0; index--) {
            int digit = digits.charAt(index) - '0';
            if (doubleIt) {
                digit *= 2;
                if (digit > 9) {
                    digit -= 9;
                }
            }
            sum += digit;
            doubleIt = !doubleIt;
        }
        return sum % 10 == 0;
    }
}
