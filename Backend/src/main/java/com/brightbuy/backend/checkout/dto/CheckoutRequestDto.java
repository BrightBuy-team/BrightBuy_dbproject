package com.brightbuy.backend.checkout.dto;

import java.util.List;

public record CheckoutRequestDto(
    List<CartItemDto> cartItems,
    String deliveryMode,
    String paymentMethod
){}
