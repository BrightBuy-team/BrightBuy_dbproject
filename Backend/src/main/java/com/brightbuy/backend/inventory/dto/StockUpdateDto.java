package com.brightbuy.backend.inventory.dto;

import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotNull;

public record StockUpdateDto(
    @NotNull @Min(0) Integer newStockQuantity
) {}

