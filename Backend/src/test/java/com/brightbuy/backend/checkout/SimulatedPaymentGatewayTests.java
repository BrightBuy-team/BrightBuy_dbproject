package com.brightbuy.backend.checkout;

import static org.assertj.core.api.Assertions.assertThat;

import com.brightbuy.backend.checkout.CheckoutRequest.CardDetails;
import java.math.BigDecimal;
import java.time.Year;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.CsvSource;

class SimulatedPaymentGatewayTests {
    private static final int NEXT_YEAR = Year.now().getValue() + 1;
    private final SimulatedPaymentGateway gateway = new SimulatedPaymentGateway("simulated");
    private final BigDecimal amount = new BigDecimal("123.45");

    private static CardDetails card(String number) {
        return new CardDetails(number, 12, NEXT_YEAR, "123", "Test Customer");
    }

    @ParameterizedTest
    @CsvSource({
        "4242424242424242, Visa, 4242",
        "4242 4242 4242 4242, Visa, 4242",
        "5555-5555-5555-4444, Mastercard, 4444",
        "378282246310005, American Express, 0005"
    })
    void testCardsAreApprovedAndOnlySafeDetailsComeBack(String number, String type, String lastFour) {
        var authorisation = gateway.authorise(amount, "USD", card(number));

        assertThat(authorisation.approved()).isTrue();
        assertThat(authorisation.cardType()).isEqualTo(type);
        assertThat(authorisation.lastFour()).isEqualTo(lastFour);
        assertThat(authorisation.token()).startsWith("tok_sim_").hasSizeLessThanOrEqualTo(64);
        assertThat(authorisation.reference()).startsWith("SIM-").hasSizeLessThanOrEqualTo(64);
        assertThat(authorisation.toString()).doesNotContain(number.replaceAll("[ -]", ""));
    }

    @Test
    void everyAuthorisationHasItsOwnTokenAndReference() {
        var first = gateway.authorise(amount, "USD", card("4242424242424242"));
        var second = gateway.authorise(amount, "USD", card("4242424242424242"));

        assertThat(first.token()).isNotEqualTo(second.token());
        assertThat(first.reference()).isNotEqualTo(second.reference());
    }

    @Test
    void aValidNumberThatIsNotATestCardIsDeclined() {
        var authorisation = gateway.authorise(amount, "USD", card("4000000000000002"));

        assertThat(authorisation.approved()).isFalse();
        assertThat(authorisation.failure()).isEqualTo("CARD_DECLINED");
        assertThat(authorisation.token()).isNull();
    }

    @ParameterizedTest
    @CsvSource(delimiter = '|', nullValues = "NULL", value = {
        "4242424242424241|12|NEXT|123|Test Customer",      // fails the checksum
        "42424242|12|NEXT|123|Test Customer",              // too short
        "4242abcd42424242|12|NEXT|123|Test Customer",      // not digits
        "NULL|12|NEXT|123|Test Customer",
        "4242424242424242|13|NEXT|123|Test Customer",      // no such month
        "4242424242424242|12|2001|123|Test Customer",      // expired
        "4242424242424242|NULL|NEXT|123|Test Customer",
        "4242424242424242|12|NEXT|12|Test Customer",       // security code too short
        "4242424242424242|12|NEXT|12a|Test Customer",
        "4242424242424242|12|NEXT|123|NULL"                // no card holder
    })
    void malformedCardDetailsAreInvalid(String number, Integer month, String year, String cvv, String holder) {
        Integer expiryYear = "NEXT".equals(year) ? Integer.valueOf(NEXT_YEAR) : Integer.valueOf(year);

        var authorisation = gateway.authorise(amount, "USD", new CardDetails(number, month, expiryYear, cvv, holder));

        assertThat(authorisation.approved()).isFalse();
        assertThat(authorisation.failure()).isEqualTo("INVALID_CARD");
    }

    @Test
    void missingCardAndNonPositiveAmountsAreRefused() {
        assertThat(gateway.authorise(amount, "USD", null).failure()).isEqualTo("INVALID_CARD");
        assertThat(gateway.authorise(BigDecimal.ZERO, "USD", card("4242424242424242")).approved()).isFalse();
        assertThat(gateway.authorise(null, "USD", card("4242424242424242")).approved()).isFalse();
    }

    @Test
    void twoDigitExpiryYearsAreUnderstood() {
        var card = new CardDetails("4242424242424242", 12, NEXT_YEAR % 100, "123", "Test Customer");

        assertThat(gateway.authorise(amount, "USD", card).approved()).isTrue();
    }

    @Test
    void aDisabledGatewayIsUnavailableAndApprovesNothing() {
        var disabled = new SimulatedPaymentGateway("disabled");

        assertThat(disabled.available()).isFalse();
        assertThat(disabled.authorise(amount, "USD", card("4242424242424242")).approved()).isFalse();
        assertThat(gateway.available()).isTrue();
    }

    @Test
    void cardDetailsNeverAppearInText() {
        assertThat(card("4242424242424242").toString()).doesNotContain("4242").doesNotContain("123");
    }
}
