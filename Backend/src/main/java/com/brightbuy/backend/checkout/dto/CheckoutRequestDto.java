package com.brightbuy.backend.checkout.dto;

import java.util.List;

public record CheckoutRequestDto(
    Integer customerId,
    List<CartItemDto> cartItems
){}
