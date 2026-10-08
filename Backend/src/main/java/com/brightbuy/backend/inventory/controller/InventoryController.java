package com.brightbuy.backend.inventory.controller;

import com.brightbuy.backend.auth.AuthenticatedUser;
import com.brightbuy.backend.inventory.dto.StockUpdateDto;
import com.brightbuy.backend.inventory.repository.InventoryRepository;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.validation.annotation.Validated;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;

import jakarta.validation.Valid;

@Validated
@RestController
@RequestMapping("/api/inventory")
public class InventoryController {

    private final InventoryRepository inventoryRepository;

    public InventoryController(InventoryRepository inventoryRepository) {
        this.inventoryRepository = inventoryRepository;
    }

    @PutMapping("/variants/{variantId}/stock")
    public void updateStock(
            @PathVariable Integer variantId,
            @Valid @RequestBody StockUpdateDto request,
            @AuthenticationPrincipal AuthenticatedUser user) {

        // SEC-5: Role-based access control. Only WarehouseStaff or Admin can adjust stock.
        if (user == null || (!"WarehouseStaff".equalsIgnoreCase(user.role()) && !"Admin".equalsIgnoreCase(user.role()))) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Only warehouse staff can adjust stock levels.");
        }

        try {
            inventoryRepository.updateStock(variantId, request.newStockQuantity(), user.email());
        } catch (Exception e) {
            if (e.getMessage() != null && e.getMessage().contains("Variant not found")) {
                throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Variant not found.");
            }
            throw new ResponseStatusException(HttpStatus.INTERNAL_SERVER_ERROR, "Failed to update stock", e);
        }
    }
}

