package com.brightbuy.backend.checkout;

import java.util.List;

/**
 * @param status                SUCCESS, or the reason the order was refused
 * @param orderId               the new order, on success
 * @param unavailableVariantIds for a stock conflict, the cart lines that cannot be supplied
 */
public record CheckoutResult(String status, Integer orderId, List<Integer> unavailableVariantIds) {
    public static CheckoutResult refused(String status) {
        return new CheckoutResult(status, null, List.of());
    }

    public boolean succeeded() {
        return "SUCCESS".equals(status);
    }
}
