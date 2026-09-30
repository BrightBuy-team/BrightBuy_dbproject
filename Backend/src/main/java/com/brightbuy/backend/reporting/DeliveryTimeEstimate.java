package com.brightbuy.backend.reporting;

import java.time.LocalDate;

public record DeliveryTimeEstimate(
    int orderId,
    String firstName,
    String lastName,
    String deliveryMode,
    String destinationCity,
    LocalDate estDeliveryDate,
    String deliveryStatus
) {}