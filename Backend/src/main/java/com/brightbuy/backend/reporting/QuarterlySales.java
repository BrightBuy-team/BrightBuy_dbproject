package com.brightbuy.backend.reporting;

import java.math.BigDecimal;

public record QuarterlySales(
    int quarter,
    int orderCount,
    BigDecimal totalRevenue
) {}