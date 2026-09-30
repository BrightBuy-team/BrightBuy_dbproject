package com.brightbuy.backend.reporting;

import java.math.BigDecimal;

public record TopSellingProduct(
    int productId,
    String name,
    int unitsSold,
    BigDecimal revenue
) {}