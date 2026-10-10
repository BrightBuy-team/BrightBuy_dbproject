package com.brightbuy.backend.checkout;

import jakarta.validation.Valid;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Positive;
import jakarta.validation.constraints.Size;
import java.util.List;

/**
 * What the browser sends to place an order. The customer is taken from the session and every
 * price from the database, so neither is part of the request.
 *
 * @param cityId      required for delivery
 * @param addressLine required for delivery
 * @param card        required when {@code paymentMethod} is "card"
 */
public record CheckoutRequest(
        @NotEmpty @Size(max = 100) List<@Valid CartItem> cartItems,
        @NotNull @Pattern(regexp = "delivery|pickup") String deliveryMode,
        @NotNull @Pattern(regexp = "cod|card") String paymentMethod,
        @Positive Integer cityId,
        @Size(max = 255) String addressLine,
        CardDetails card) {

    public record CartItem(
            @NotNull @Positive Integer variantId,
            @NotNull @Min(1) @Max(100000) Integer quantity) {
    }

    /**
     * Card details pass through memory to the payment gateway and nowhere else: they are never
     * stored, and never logged (CON-5, SEC-2). The fields carry no validation annotations on
     * purpose, because a failed annotation would write the rejected value to the log; the
     * gateway validates them instead.
     */
    public record CardDetails(String number, Integer expiryMonth, Integer expiryYear, String cvv,
            String holderName) {
        @Override
        public String toString() {
            return "CardDetails[hidden]";
        }
    }
}
