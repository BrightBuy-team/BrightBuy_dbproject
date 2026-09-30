package com.brightbuy.backend.inventory;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/inventory")
@CrossOrigin(origins = "*") // Allows your React frontend to communicate with this backend
public class InventoryController {

    @Autowired
    private InventoryService inventoryService;

    // GET /api/inventory/variants
    // Fetches all variants for the Warehouse Staff dashboard
    @GetMapping("/variants")
    public ResponseEntity<List<Variant>> getAllVariants() {
        List<Variant> variants = inventoryService.getAllVariants();
        return ResponseEntity.ok(variants);
    }

    // GET /api/inventory/low-stock?threshold=10
    // Fetches items that are running low on stock
    @GetMapping("/low-stock")
    public ResponseEntity<List<Variant>> getLowStockVariants(@RequestParam(defaultValue = "10") Integer threshold) {
        List<Variant> lowStockItems = inventoryService.getLowStockVariants(threshold);
        return ResponseEntity.ok(lowStockItems);
    }

    // PUT /api/inventory/variants/1/stock?quantity=50
    // Updates the stock when warehouse staff receive a new shipment
    @PutMapping("/variants/{variantId}/stock")
    public ResponseEntity<Variant> updateStock(
            @PathVariable Integer variantId,
            @RequestParam Integer quantity) {

        try {
            Variant updatedVariant = inventoryService.updateStockQuantity(variantId, quantity);
            return ResponseEntity.ok(updatedVariant);
        } catch (RuntimeException e) {
            return ResponseEntity.badRequest().build();
        }
    }
}
