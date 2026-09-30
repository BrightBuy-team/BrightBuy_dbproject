package com.brightbuy.backend.reporting;

public record CategoryOrderCount(
    int categoryId,
    String name,
    int totalOrders
) {}