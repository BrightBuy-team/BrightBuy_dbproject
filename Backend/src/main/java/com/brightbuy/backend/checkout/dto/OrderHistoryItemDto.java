package com.brightbuy.backend.checkout.dto;

import java.math.BigDecimal;

public record OrderHistoryItemDto(
    String productName,
    String productSku,
    String variantName,
    String colour,
    String memorySize,
    Integer quantity,
    BigDecimal unitPrice
) {}

