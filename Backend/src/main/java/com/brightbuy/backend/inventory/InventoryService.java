package com.brightbuy.backend.inventory;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;

import java.util.List;
import java.util.Optional;

@Service
public class InventoryService {

    @Autowired
    private VariantRepository variantRepository;

    // 1. Get all variants and their stock
    public List<Variant> getAllVariants() {
        return variantRepository.findAll();
    }

    // 2. Identify variants below a low-stock threshold (e.g., less than 10)
    public List<Variant> getLowStockVariants(Integer threshold) {
        return variantRepository.findByStockQuantityLessThan(threshold);
    }

    // 3. Update stock quantity for a specific variant
    public Variant updateStockQuantity(Integer variantId, Integer newQuantity) {
        Optional<Variant> optionalVariant = variantRepository.findById(variantId);

        if (optionalVariant.isPresent()) {
            Variant variant = optionalVariant.get();
            variant.setStockQuantity(newQuantity);
            // This will save the new quantity.
            // Because of your SQL Trigger, the database will automatically log this in
            // variant_audit!
            return variantRepository.save(variant);
        } else {
            throw new RuntimeException("Variant with ID " + variantId + " not found.");
        }
    }
}
