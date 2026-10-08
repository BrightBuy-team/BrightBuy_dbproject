package com.brightbuy.backend.inventory;

import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Table;
import jakarta.persistence.Column;
import java.time.LocalDateTime;

@Entity
@Table(name = "variant_audit")
public class VariantAudit {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "audit_id")
    private Integer auditId;

    @Column(name = "variant_id")
    private Integer variantId;

    @Column(name = "old_stock_quantity")
    private Integer oldStockQuantity;

    @Column(name = "new_stock_quantity")
    private Integer newStockQuantity;

    @Column(name = "changed_by")
    private String changedBy;

    @Column(name = "changed_at", insertable = false, updatable = false)
    private LocalDateTime changedAt;

    // Getters and Setters
    public Integer getAuditId() { return auditId; }
    public void setAuditId(Integer auditId) { this.auditId = auditId; }

    public Integer getVariantId() { return variantId; }
    public void setVariantId(Integer variantId) { this.variantId = variantId; }

    public Integer getOldStockQuantity() { return oldStockQuantity; }
    public void setOldStockQuantity(Integer oldStockQuantity) { this.oldStockQuantity = oldStockQuantity; }

    public Integer getNewStockQuantity() { return newStockQuantity; }
    public void setNewStockQuantity(Integer newStockQuantity) { this.newStockQuantity = newStockQuantity; }

    public String getChangedBy() { return changedBy; }
    public void setChangedBy(String changedBy) { this.changedBy = changedBy; }

    public LocalDateTime getChangedAt() { return changedAt; }
    public void setChangedAt(LocalDateTime changedAt) { this.changedAt = changedAt; }
}
