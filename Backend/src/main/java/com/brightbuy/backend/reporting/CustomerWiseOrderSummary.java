package com.brightbuy.backend.reporting;

import java.math.BigDecimal;

public record CustomerWiseOrderSummary(
    int customerId,
    String firstName,
    String lastName,
    BigDecimal lifeTimeSpent,
    String paymentStatus
) {}