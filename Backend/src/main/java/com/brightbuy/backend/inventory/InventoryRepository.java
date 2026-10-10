package com.brightbuy.backend.inventory;

import com.brightbuy.backend.config.ActorJdbc;
import java.math.BigDecimal;
import java.util.List;
import java.util.Optional;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.core.RowMapper;
import org.springframework.stereotype.Repository;

/** Reads variants with plain SQL and changes them through the procedures in Database/Inventory. */
@Repository
public class InventoryRepository {
    private static final String SELECT_VARIANT = """
            SELECT v.variant_id, v.product_id, p.name AS product_name, p.sku, v.warehouse_id,
                   v.variant_name, v.colour, v.memory_size, v.price, v.stock_quantity
            FROM variant v
            JOIN product p ON p.product_id = v.product_id
            """;
    private static final RowMapper<Variant> VARIANT = (row, index) -> new Variant(
            row.getInt("variant_id"), row.getInt("product_id"), row.getString("product_name"),
            row.getString("sku"), (Integer) row.getObject("warehouse_id"), row.getString("variant_name"),
            row.getString("colour"), row.getString("memory_size"), row.getBigDecimal("price"),
            row.getInt("stock_quantity"));

    private final JdbcTemplate jdbc;
    private final ActorJdbc actorJdbc;

    public InventoryRepository(JdbcTemplate jdbc, ActorJdbc actorJdbc) {
        this.jdbc = jdbc;
        this.actorJdbc = actorJdbc;
    }

    public List<Variant> allVariants() {
        return jdbc.query(SELECT_VARIANT + "ORDER BY v.variant_id", VARIANT);
    }

    public List<Variant> variantsBelow(int threshold) {
        return jdbc.query(SELECT_VARIANT + "WHERE v.stock_quantity < ? ORDER BY v.stock_quantity, v.variant_id",
                VARIANT, threshold);
    }

    public Optional<Variant> variant(int variantId) {
        return jdbc.query(SELECT_VARIANT + "WHERE v.variant_id = ?", VARIANT, variantId).stream().findFirst();
    }

    public void setStock(String actor, int variantId, int quantity) {
        actorJdbc.call(actor, "CALL sp_inventory_set_stock(?, ?)", variantId, quantity);
    }

    public Integer createVariant(String actor, int productId, Integer warehouseId, String variantName,
            String colour, String memorySize, BigDecimal price, int stock) {
        return actorJdbc.callReturningId(actor, "{call sp_inventory_create_variant(?,?,?,?,?,?,?,?)}",
                productId, warehouseId, variantName, colour, memorySize, price, stock);
    }

    public void updateVariant(String actor, int variantId, String variantName, String colour,
            String memorySize, BigDecimal price) {
        actorJdbc.call(actor, "CALL sp_inventory_update_variant(?, ?, ?, ?, ?)",
                variantId, variantName, colour, memorySize, price);
    }
}
