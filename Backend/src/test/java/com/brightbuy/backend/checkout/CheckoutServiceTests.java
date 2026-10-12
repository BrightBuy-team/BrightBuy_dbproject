package com.brightbuy.backend.checkout;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

import com.brightbuy.backend.checkout.CheckoutRequest.CardDetails;
import com.brightbuy.backend.checkout.CheckoutRequest.CartItem;
import com.brightbuy.backend.checkout.PaymentGateway.Authorisation;
import java.math.BigDecimal;
import java.util.List;
import org.junit.jupiter.api.Test;

class CheckoutServiceTests {
    private final CheckoutRepository repository = mock(CheckoutRepository.class);
    private final PaymentGateway gateway = mock(PaymentGateway.class);
    private final CheckoutService service = new CheckoutService(repository, gateway);

    private final List<CartItem> cart = List.of(new CartItem(7, 2));
    private final CardDetails card = new CardDetails("4242424242424242", 12, 2099, "123", "Test Customer");
    private final BigDecimal total = new BigDecimal("250.00");
    private final Authorisation approved = new Authorisation(true, null, "tok_sim_1", "SIM-1", "4242", "Visa");

    private CheckoutRequest request(String payment, CardDetails cardDetails) {
        return new CheckoutRequest(cart, "pickup", payment, null, null, cardDetails);
    }

    @Test
    void cashOnDeliveryNeverTouchesTheGateway() {
        var request = request("cod", null);
        when(repository.placeOrder(5, request, null, null)).thenReturn(new CheckoutResult("SUCCESS", 91, List.of()));

        assertThat(service.checkout(5, request)).isEqualTo(new CheckoutResult("SUCCESS", 91, List.of()));
        verifyNoInteractions(gateway);
        verify(repository, never()).quote(any());
    }

    @Test
    void cardIsAuthorisedForTheDatabaseTotalBeforeTheOrderIsPlaced() {
        var request = request("card", card);
        when(gateway.available()).thenReturn(true);
        when(repository.quote(cart)).thenReturn(new CheckoutRepository.Quote("OK", total));
        when(gateway.authorise(total, "USD", card)).thenReturn(approved);
        when(repository.placeOrder(5, request, approved, total)).thenReturn(new CheckoutResult("SUCCESS", 92, List.of()));

        assertThat(service.checkout(5, request).orderId()).isEqualTo(92);
        var order = inOrder(repository, gateway);
        order.verify(repository).quote(cart);
        order.verify(gateway).authorise(total, "USD", card);
        order.verify(repository).placeOrder(5, request, approved, total);
        verify(gateway, never()).cancel(any());
    }

    @Test
    void aDeclinedCardCreatesNoOrder() {
        var request = request("card", card);
        when(gateway.available()).thenReturn(true);
        when(repository.quote(cart)).thenReturn(new CheckoutRepository.Quote("OK", total));
        when(gateway.authorise(total, "USD", card)).thenReturn(Authorisation.refused("CARD_DECLINED"));

        assertThat(service.checkout(5, request)).isEqualTo(CheckoutResult.refused("CARD_DECLINED"));
        verify(repository, never()).placeOrder(anyInt(), any(), any(), any());
    }

    @Test
    void aCartThatCannotBeBoughtIsNeverSentToTheGateway() {
        var request = request("card", card);
        when(gateway.available()).thenReturn(true);
        when(repository.quote(cart)).thenReturn(new CheckoutRepository.Quote("ITEM_UNAVAILABLE", null));
        when(repository.unavailableVariants(cart)).thenReturn(List.of(7));

        assertThat(service.checkout(5, request)).isEqualTo(new CheckoutResult("ITEM_UNAVAILABLE", null, List.of(7)));
        verify(gateway, never()).authorise(any(), any(), any());
    }

    @Test
    void anAuthorisationIsReleasedWhenTheOrderIsRefusedAfterwards() {
        var request = request("card", card);
        when(gateway.available()).thenReturn(true);
        when(repository.quote(cart)).thenReturn(new CheckoutRepository.Quote("OK", total));
        when(gateway.authorise(total, "USD", card)).thenReturn(approved);
        when(repository.placeOrder(5, request, approved, total))
                .thenReturn(CheckoutResult.refused("AUTHORISED_AMOUNT_MISMATCH"));

        assertThat(service.checkout(5, request).status()).isEqualTo("AUTHORISED_AMOUNT_MISMATCH");
        verify(gateway).cancel("SIM-1");
    }

    @Test
    void anAuthorisationIsReleasedWhenTheDatabaseFails() {
        var request = request("card", card);
        when(gateway.available()).thenReturn(true);
        when(repository.quote(cart)).thenReturn(new CheckoutRepository.Quote("OK", total));
        when(gateway.authorise(total, "USD", card)).thenReturn(approved);
        when(repository.placeOrder(5, request, approved, total)).thenThrow(new IllegalStateException("database down"));

        assertThatThrownBy(() -> service.checkout(5, request)).isInstanceOf(IllegalStateException.class);
        verify(gateway).cancel("SIM-1");
    }

    @Test
    void cardCheckoutIsRefusedWhileTheGatewayIsSwitchedOffButCashStillWorks() {
        when(gateway.available()).thenReturn(false);
        var cod = request("cod", null);
        when(repository.placeOrder(5, cod, null, null)).thenReturn(new CheckoutResult("SUCCESS", 93, List.of()));

        assertThat(service.checkout(5, request("card", card)).status()).isEqualTo("PAYMENT_GATEWAY_UNAVAILABLE");
        assertThat(service.checkout(5, cod).succeeded()).isTrue();
        verify(repository, never()).quote(any());
    }

    @Test
    void cardCheckoutNeedsCardDetailsAndADeliveryAddressBeforeAnythingIsCharged() {
        when(gateway.available()).thenReturn(true);
        var noAddress = new CheckoutRequest(cart, "delivery", "card", 1, "  ", card);

        assertThat(service.checkout(5, request("card", null)).status()).isEqualTo("INVALID_PAYMENT_DETAILS");
        assertThat(service.checkout(5, noAddress).status()).isEqualTo("INVALID_DELIVERY_ADDRESS");
        verify(gateway, never()).authorise(any(), any(), any());
        verify(repository, never()).placeOrder(anyInt(), any(), any(), any());
    }

    @Test
    void anItemNoLongerSoldNamesTheLinesToRemove() {
        var request = request("cod", null);
        when(repository.placeOrder(5, request, null, null)).thenReturn(CheckoutResult.refused("ITEM_UNAVAILABLE"));
        when(repository.unavailableVariants(cart)).thenReturn(List.of(7));

        assertThat(service.checkout(5, request).unavailableVariantIds()).containsExactly(7);
    }
}
