package com.brightbuy.backend.inventory;

import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Table;
import jakarta.persistence.Column;

@Entity
@Table(name = "variant")
public class Variant {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "variant_id")
    private Integer variantId;

    // Foreign Key linking to Mihisara's Product table
    @Column(name = "product_id")
    private Integer productId;

    // Foreign Key linking to your Warehouse table
    @Column(name = "warehouse_id")
    private Integer warehouseId;

    @Column(name = "variant_name")
    private String variantName;

    @Column(name = "colour")
    private String colour;

    @Column(name = "memory_size")
    private String memorySize;

    @Column(name = "price")
    private Double price;

    @Column(name = "stock_quantity")
    private Integer stockQuantity;

    // Getters and Setters
    public Integer getVariantId() { return variantId; }
    public void setVariantId(Integer variantId) { this.variantId = variantId; }

    public Integer getProductId() { return productId; }
    public void setProductId(Integer productId) { this.productId = productId; }

    public Integer getWarehouseId() { return warehouseId; }
    public void setWarehouseId(Integer warehouseId) { this.warehouseId = warehouseId; }

    public String getVariantName() { return variantName; }
    public void setVariantName(String variantName) { this.variantName = variantName; }

    public String getColour() { return colour; }
    public void setColour(String colour) { this.colour = colour; }

    public String getMemorySize() { return memorySize; }
    public void setMemorySize(String memorySize) { this.memorySize = memorySize; }

    public Double getPrice() { return price; }
    public void setPrice(Double price) { this.price = price; }

    public Integer getStockQuantity() { return stockQuantity; }
    public void setStockQuantity(Integer stockQuantity) { this.stockQuantity = stockQuantity; }
}
