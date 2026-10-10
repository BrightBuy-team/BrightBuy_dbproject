package com.brightbuy.backend.checkout;

import com.brightbuy.backend.checkout.PaymentGateway.Authorisation;
import java.util.Set;
import org.springframework.stereotype.Service;

/**
 * Coordinates the payment gateway with the checkout procedure.
 *
 * <p>Cash on delivery goes straight to the procedure and is confirmed with a pending payment.
 * A card must be authorised before the order is confirmed (AS-8, BR-12), so the database is
 * first asked for the exact total, the gateway authorises that amount, and only then is the
 * order placed. If the order cannot be completed after all, the authorisation is released.
 * The gateway call happens outside the database transaction, so no stock rows stay locked
 * while waiting for it (PER-4).
 */
@Service
public class CheckoutService {
    private static final String CURRENCY = "USD";
    private static final Set<String> STOCK_CONFLICTS = Set.of("INSUFFICIENT_STOCK", "ITEM_UNAVAILABLE");

    private final CheckoutRepository repository;
    private final PaymentGateway gateway;

    public CheckoutService(CheckoutRepository repository, PaymentGateway gateway) {
        this.repository = repository;
        this.gateway = gateway;
    }

    public CheckoutResult checkout(int customerId, CheckoutRequest request) {
        CheckoutResult result = "card".equals(request.paymentMethod())
                ? payByCard(customerId, request)
                : repository.placeOrder(customerId, request, null, null);
        if (STOCK_CONFLICTS.contains(result.status())) {
            return new CheckoutResult(result.status(), null, repository.unavailableVariants(request.cartItems()));
        }
        return result;
    }

    private CheckoutResult payByCard(int customerId, CheckoutRequest request) {
        if (!gateway.available()) {
            return CheckoutResult.refused("PAYMENT_GATEWAY_UNAVAILABLE");
        }
        if (request.card() == null) {
            return CheckoutResult.refused("INVALID_PAYMENT_DETAILS");
        }
        // Checked before the card is touched; the procedure checks it again.
        if ("delivery".equals(request.deliveryMode()) && (request.cityId() == null
                || request.addressLine() == null || request.addressLine().trim().length() < 5)) {
            return CheckoutResult.refused("INVALID_DELIVERY_ADDRESS");
        }
        CheckoutRepository.Quote quote = repository.quote(request.cartItems());
        if (!"OK".equals(quote.status())) {
            return CheckoutResult.refused(quote.status());
        }
        Authorisation authorisation = gateway.authorise(quote.total(), CURRENCY, request.card());
        if (!authorisation.approved()) {
            return CheckoutResult.refused(authorisation.failure());
        }
        CheckoutResult result;
        try {
            result = repository.placeOrder(customerId, request, authorisation, quote.total());
        } catch (RuntimeException exception) {
            gateway.cancel(authorisation.reference());
            throw exception;
        }
        if (!result.succeeded()) {
            gateway.cancel(authorisation.reference());
        }
        return result;
    }
}
