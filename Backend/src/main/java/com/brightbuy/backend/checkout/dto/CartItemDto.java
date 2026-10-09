package com.brightbuy.backend.checkout.dto;
import jakarta.validation.constraints.*;
public record CartItemDto(@NotNull @Positive Integer variantId,
 @NotNull @Min(1) @Max(100000) Integer quantity) {}

