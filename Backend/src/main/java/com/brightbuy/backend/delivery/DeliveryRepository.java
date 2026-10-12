package com.brightbuy.backend.delivery;

import com.brightbuy.backend.config.ActorJdbc;
import java.sql.Date;
import java.time.LocalDate;
import java.util.ArrayList;
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
    private final ActorJdbc actorJdbc;

    public DeliveryRepository(JdbcTemplate jdbc, ObjectMapper mapper, ActorJdbc actorJdbc) {
        this.jdbc = jdbc;
        this.mapper = mapper;
        this.actorJdbc = actorJdbc;
    }

    public List<City> cities() {
        return jdbc.query("SELECT city_id, name, is_main_city FROM city ORDER BY name",
                (row, index) -> new City(row.getInt("city_id"), row.getString("name"),
                        row.getBoolean("is_main_city")));
    }

    /**
     * The estimate shown before ordering, from the database function that owns the rule (BR-8):
     * the city, plus three days when a line asks for more than is in stock. Empty for an unknown
     * city.
     *
     * @param quantities the wanted quantity of each variant, in the same order
     */
    public Optional<LocalDate> previewDate(int cityId, List<Integer> variantIds, List<Integer> quantities) {
        List<Map<String, Integer>> cart = new ArrayList<>();
        for (int index = 0; index < variantIds.size(); index++) {
            cart.add(Map.of("variantId", variantIds.get(index), "quantity", quantities.get(index)));
        }
        Date date = jdbc.queryForObject("SELECT fn_delivery_preview_date(?, ?)", Date.class,
                cityId, mapper.writeValueAsString(cart));
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

    public List<StaffDelivery> pendingDeliveries(Integer assignedEmployeeId) {
        String assignedFilter = assignedEmployeeId == null ? "" : " AND d.assigned_employee_id = ?";
        String sql = """
                SELECT d.delivery_id, d.order_id, d.address_line, c.name AS city_name,
                      d.est_delivery_date, d.assigned_employee_id
                 FROM delivery d
                 JOIN orders o ON o.order_id = d.order_id
                 LEFT JOIN city c ON c.city_id = d.city_id
                 WHERE d.delivery_status = 'Pending' AND d.delivery_mode = 'delivery'
                  AND o.order_status <> 'Cancelled'
                """ + assignedFilter + """
                 ORDER BY d.est_delivery_date, d.delivery_id
                """;
        org.springframework.jdbc.core.RowMapper<StaffDelivery> mapper = (row, index) -> new StaffDelivery(row.getInt("delivery_id"),
                row.getInt("order_id"), row.getString("address_line"), row.getString("city_name"),
                row.getDate("est_delivery_date") == null ? null : row.getDate("est_delivery_date").toLocalDate(),
                (Integer) row.getObject("assigned_employee_id"));
        return assignedEmployeeId == null
                ? jdbc.query(sql, mapper)
                : jdbc.query(sql, mapper, assignedEmployeeId);
    }

    public List<DeliveryDriver> activeDrivers() {
        return jdbc.query("CALL sp_delivery_active_drivers()",
                (row, index) -> new DeliveryDriver(row.getInt("employee_id"), row.getString("name")));
    }

    public void assign(String actor, int deliveryId, Integer employeeId) {
        actorJdbc.call(actor, "CALL sp_delivery_assign(?, ?)", deliveryId, employeeId);
    }

    public void markDelivered(String actor, int deliveryId, int employeeId) {
        actorJdbc.call(actor, "CALL sp_delivery_mark_delivered(?, ?)", deliveryId, employeeId);
    }

    public record StaffDelivery(int deliveryId, int orderId, String addressLine, String cityName,
            LocalDate estimatedDate, Integer assignedEmployeeId) {
    }

    public record DeliveryDriver(int employeeId, String name) {
    }
}
