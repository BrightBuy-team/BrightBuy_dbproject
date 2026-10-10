package com.brightbuy.backend.checkout;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.List;

/** One of a customer's own orders, with its delivery, payment and lines (UI-10). */
public record OrderSummary(
        Integer orderId,
        LocalDateTime orderDate,
        String orderStatus,
        BigDecimal totalAmount,
        String deliveryMode,
        String deliveryCity,
        String deliveryAddress,
        LocalDate estDeliveryDate,
        String deliveryStatus,
        String paymentMethod,
        String paymentStatus,
        String cardType,
        String cardLastFour,
        List<Line> items) {

    /**
     * The unit price is the price paid at purchase time (BR-13). {@code backorderedQuantity} is
     * the part of the line that was out of stock when the order was placed and follows later.
     */
    public record Line(
            String productName,
            String productSku,
            String variantName,
            String colour,
            String memorySize,
            Integer quantity,
            Integer backorderedQuantity,
            BigDecimal unitPrice) {
    }
}
