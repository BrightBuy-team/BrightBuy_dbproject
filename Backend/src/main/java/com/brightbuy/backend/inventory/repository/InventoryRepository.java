package com.brightbuy.backend.inventory.repository;

import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Repository;
import org.springframework.transaction.annotation.Transactional;

@Repository
public class InventoryRepository {
    
    private final JdbcTemplate jdbcTemplate;

    public InventoryRepository(JdbcTemplate jdbcTemplate) {
        this.jdbcTemplate = jdbcTemplate;
    }

    @Transactional
    public void updateStock(Integer variantId, Integer newStockQuantity, String changedBy) {
        // Fetch old stock for audit log
        String getOldStockSql = "SELECT stock_quantity FROM variant WHERE variant_id = ? FOR UPDATE";
        Integer oldStock;
        try {
            oldStock = jdbcTemplate.queryForObject(getOldStockSql, Integer.class, variantId);
        } catch (org.springframework.dao.EmptyResultDataAccessException e) {
            throw new RuntimeException("Variant not found");
        }

        // Update the stock (SAF-2 / BR-10: Never fall below zero, checked at DB level)
        String updateStockSql = "UPDATE variant SET stock_quantity = ? WHERE variant_id = ?";
        jdbcTemplate.update(updateStockSql, newStockQuantity, variantId);

        // Insert into audit table (SAF-7: All changes to variant stock shall be written to an audit table)
        String auditSql = "INSERT INTO variant_audit (variant_id, old_stock_quantity, new_stock_quantity, changed_by) VALUES (?, ?, ?, ?)";
        jdbcTemplate.update(auditSql, variantId, oldStock, newStockQuantity, changedBy);
    }
}

