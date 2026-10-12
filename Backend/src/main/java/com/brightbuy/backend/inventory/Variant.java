package com.brightbuy.backend.inventory;

import java.math.BigDecimal;

/** A variant as warehouse staff see it: its product, its price and its stock. */
public record Variant(
        Integer variantId,
        Integer productId,
        String productName,
        String sku,
        Integer warehouseId,
        String variantName,
        String colour,
        String memorySize,
        BigDecimal price,
        Integer stockQuantity) {
}
