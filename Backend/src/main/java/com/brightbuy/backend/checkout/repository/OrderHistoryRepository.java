package com.brightbuy.backend.checkout.repository;

import com.brightbuy.backend.checkout.dto.OrderHistoryDto;
import com.brightbuy.backend.checkout.dto.OrderHistoryItemDto;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Repository;

import java.math.BigDecimal;
import java.sql.Date;
import java.sql.SQLException;
import java.sql.Timestamp;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

@Repository
public class OrderHistoryRepository {
    private final JdbcTemplate jdbcTemplate;

    public OrderHistoryRepository(JdbcTemplate jdbcTemplate) {
        this.jdbcTemplate = jdbcTemplate;
    }

    public List<OrderHistoryDto> getCustomerOrders(Integer customerId) {
        String sql = """
            SELECT
                o.order_id, o.order_date, o.order_status, o.total_amount,
                d.delivery_mode, d.est_delivery_date, d.delivery_status,
                p.payment_method, p.payment_status,
                oi.quantity, oi.unit_price,
                v.variant_name, v.colour, v.memory_size,
                pr.name AS product_name, pr.sku AS product_sku
            FROM orders o
            LEFT JOIN delivery d ON o.order_id = d.order_id
            LEFT JOIN payment p ON o.order_id = p.order_id
            JOIN order_item oi ON o.order_id = oi.order_id
            JOIN variant v ON oi.variant_id = v.variant_id
            JOIN product pr ON v.product_id = pr.product_id
            WHERE o.customer_id = ?
            ORDER BY o.order_date DESC, o.order_id DESC
        """;

        return jdbcTemplate.query(sql, rs -> {
            Map<Integer, OrderHistoryDtoBuilder> orderMap = new LinkedHashMap<>();
            
            while (rs.next()) {
                int orderId = rs.getInt("order_id");
                
                OrderHistoryDtoBuilder builder = orderMap.computeIfAbsent(orderId, id -> {
                    try {
                        Timestamp orderDateTs = rs.getTimestamp("order_date");
                        LocalDateTime orderDate = orderDateTs != null ? orderDateTs.toLocalDateTime() : null;
                        
                        Date estDeliveryDateSql = rs.getDate("est_delivery_date");
                        LocalDate estDeliveryDate = estDeliveryDateSql != null ? estDeliveryDateSql.toLocalDate() : null;
                        
                        return new OrderHistoryDtoBuilder(
                            id,
                            orderDate,
                            rs.getString("order_status"),
                            rs.getBigDecimal("total_amount"),
                            rs.getString("delivery_mode"),
                            estDeliveryDate,
                            rs.getString("delivery_status"),
                            rs.getString("payment_method"),
                            rs.getString("payment_status")
                        );
                    } catch (SQLException e) {
                        throw new RuntimeException(e);
                    }
                });

                OrderHistoryItemDto item = new OrderHistoryItemDto(
                    rs.getString("product_name"),
                    rs.getString("product_sku"),
                    rs.getString("variant_name"),
                    rs.getString("colour"),
                    rs.getString("memory_size"),
                    rs.getInt("quantity"),
                    rs.getBigDecimal("unit_price")
                );
                builder.items.add(item);
            }
            
            List<OrderHistoryDto> result = new ArrayList<>();
            for (OrderHistoryDtoBuilder builder : orderMap.values()) {
                result.add(builder.build());
            }
            return result;
        }, customerId);
    }
    
    private static class OrderHistoryDtoBuilder {
        Integer orderId;
        LocalDateTime orderDate;
        String orderStatus;
        BigDecimal totalAmount;
        String deliveryMode;
        LocalDate estDeliveryDate;
        String deliveryStatus;
        String paymentMethod;
        String paymentStatus;
        List<OrderHistoryItemDto> items = new ArrayList<>();
        
        OrderHistoryDtoBuilder(Integer orderId, LocalDateTime orderDate, String orderStatus, BigDecimal totalAmount, 
                               String deliveryMode, LocalDate estDeliveryDate, String deliveryStatus, 
                               String paymentMethod, String paymentStatus) {
            this.orderId = orderId;
            this.orderDate = orderDate;
            this.orderStatus = orderStatus;
            this.totalAmount = totalAmount;
            this.deliveryMode = deliveryMode;
            this.estDeliveryDate = estDeliveryDate;
            this.deliveryStatus = deliveryStatus;
            this.paymentMethod = paymentMethod;
            this.paymentStatus = paymentStatus;
        }
        
        OrderHistoryDto build() {
            return new OrderHistoryDto(orderId, orderDate, orderStatus, totalAmount, deliveryMode, estDeliveryDate, deliveryStatus, paymentMethod, paymentStatus, items);
        }
    }
}

