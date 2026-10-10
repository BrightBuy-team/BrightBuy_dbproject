package com.brightbuy.backend.checkout;

import java.sql.Date;
import java.sql.Timestamp;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Repository;

@Repository
public class OrderHistoryRepository {
    private static final String ORDERS_OF_CUSTOMER = """
            SELECT o.order_id, o.order_date, o.order_status, o.total_amount,
                   d.delivery_mode, c.name AS delivery_city, d.address_line, d.est_delivery_date, d.delivery_status,
                   p.payment_method, p.payment_status, p.card_type, p.card_last_four,
                   oi.quantity, oi.unit_price,
                   v.variant_name, v.colour, v.memory_size,
                   pr.name AS product_name, pr.sku AS product_sku
            FROM orders o
            LEFT JOIN delivery d ON d.order_id = o.order_id
            LEFT JOIN city c ON c.city_id = d.city_id
            LEFT JOIN payment p ON p.order_id = o.order_id
            JOIN order_item oi ON oi.order_id = o.order_id
            JOIN variant v ON v.variant_id = oi.variant_id
            JOIN product pr ON pr.product_id = v.product_id
            WHERE o.customer_id = ?
            ORDER BY o.order_date DESC, o.order_id DESC, oi.variant_id
            """;

    private final JdbcTemplate jdbc;

    public OrderHistoryRepository(JdbcTemplate jdbc) {
        this.jdbc = jdbc;
    }

    /** Newest first. Only this customer's orders are read (SEC-6, BR-16). */
    public List<OrderSummary> ordersOf(int customerId) {
        return jdbc.query(ORDERS_OF_CUSTOMER, rows -> {
            Map<Integer, OrderSummary> orders = new LinkedHashMap<>();
            while (rows.next()) {
                int orderId = rows.getInt("order_id");
                OrderSummary order = orders.get(orderId);
                if (order == null) {
                    Timestamp orderDate = rows.getTimestamp("order_date");
                    Date estimate = rows.getDate("est_delivery_date");
                    order = new OrderSummary(orderId,
                            orderDate == null ? null : orderDate.toLocalDateTime(),
                            rows.getString("order_status"), rows.getBigDecimal("total_amount"),
                            rows.getString("delivery_mode"), rows.getString("delivery_city"),
                            rows.getString("address_line"),
                            estimate == null ? null : estimate.toLocalDate(),
                            rows.getString("delivery_status"), rows.getString("payment_method"),
                            rows.getString("payment_status"), rows.getString("card_type"),
                            rows.getString("card_last_four"), new ArrayList<>());
                    orders.put(orderId, order);
                }
                order.items().add(new OrderSummary.Line(rows.getString("product_name"),
                        rows.getString("product_sku"), rows.getString("variant_name"), rows.getString("colour"),
                        rows.getString("memory_size"), rows.getInt("quantity"), rows.getBigDecimal("unit_price")));
            }
            return List.copyOf(orders.values());
        }, customerId);
    }
}
