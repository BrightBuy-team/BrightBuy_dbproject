package com.brightbuy.backend.checkout.dto;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.List;

public record OrderHistoryDto(
    Integer orderId,
    LocalDateTime orderDate,
    String orderStatus,
    BigDecimal totalAmount,
    String deliveryMode,
    LocalDate estDeliveryDate,
    String deliveryStatus,
    String paymentMethod,
    String paymentStatus,
    List<OrderHistoryItemDto> items
) {}

