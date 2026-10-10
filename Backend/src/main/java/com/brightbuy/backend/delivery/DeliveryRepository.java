package com.brightbuy.backend.delivery;

import java.sql.Date;
import java.time.LocalDate;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Repository;
import tools.jackson.databind.ObjectMapper;

@Repository
public class DeliveryRepository {
    private final JdbcTemplate jdbc;
    private final ObjectMapper mapper;

    public DeliveryRepository(JdbcTemplate jdbc, ObjectMapper mapper) {
        this.jdbc = jdbc;
        this.mapper = mapper;
    }

    public List<City> cities() {
        return jdbc.query("SELECT city_id, name, is_main_city FROM city ORDER BY name",
                (row, index) -> new City(row.getInt("city_id"), row.getString("name"),
                        row.getBoolean("is_main_city")));
    }

    /**
     * The estimate shown before ordering, from the database function that owns the rule (BR-8):
     * the city plus the current stock of the given variants. Empty for an unknown city.
     */
    public Optional<LocalDate> previewDate(int cityId, List<Integer> variantIds) {
        Date date = jdbc.queryForObject("SELECT fn_delivery_preview_date(?, ?)", Date.class,
                cityId, mapper.writeValueAsString(variantIds));
        return Optional.ofNullable(date).map(Date::toLocalDate);
    }

    public boolean orderBelongsTo(int orderId, int customerId) {
        Integer count = jdbc.queryForObject("SELECT COUNT(*) FROM orders WHERE order_id = ? AND customer_id = ?",
                Integer.class, orderId, customerId);
        return count != null && count == 1;
    }

    /** The delivery recorded when the order was placed: est_delivery_date, delivery_mode, city_id. */
    public Optional<Map<String, Object>> deliveryOf(int orderId) {
        return jdbc.queryForList(
                "SELECT est_delivery_date, delivery_mode, delivery_status, city_id FROM delivery WHERE order_id = ?",
                orderId).stream().findFirst();
    }
}
