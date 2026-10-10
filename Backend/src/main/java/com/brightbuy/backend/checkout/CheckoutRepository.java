package com.brightbuy.backend.checkout;

import com.brightbuy.backend.checkout.CheckoutRequest.CartItem;
import com.brightbuy.backend.checkout.PaymentGateway.Authorisation;
import com.brightbuy.backend.config.ActorJdbc;
import java.math.BigDecimal;
import java.sql.CallableStatement;
import java.sql.Types;
import java.util.List;
import org.springframework.jdbc.core.CallableStatementCallback;
import org.springframework.jdbc.core.CallableStatementCreator;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Repository;
import tools.jackson.databind.ObjectMapper;

/** Calls the checkout procedures in Database/Checkout. The cart travels as a JSON array. */
@Repository
public class CheckoutRepository {
    private final JdbcTemplate jdbc;
    private final ActorJdbc actorJdbc;
    private final ObjectMapper mapper;

    public CheckoutRepository(JdbcTemplate jdbc, ActorJdbc actorJdbc, ObjectMapper mapper) {
        this.jdbc = jdbc;
        this.actorJdbc = actorJdbc;
        this.mapper = mapper;
    }

    /** The total the database would charge for this cart right now. Nothing is reserved. */
    public Quote quote(List<CartItem> cart) {
        String cartJson = mapper.writeValueAsString(cart);
        CallableStatementCreator creator = connection -> {
            CallableStatement call = connection.prepareCall("{call sp_checkout_quote(?,?,?)}");
            call.setString(1, cartJson);
            call.registerOutParameter(2, Types.VARCHAR);
            call.registerOutParameter(3, Types.DECIMAL);
            return call;
        };
        CallableStatementCallback<Quote> callback = call -> {
            call.execute();
            return new Quote(call.getString(2), call.getBigDecimal(3));
        };
        return jdbc.execute(creator, callback);
    }

    /**
     * Places the order in one database transaction. For a card payment pass the gateway's
     * authorisation and the amount it covers; for cash on delivery pass null for both.
     */
    public CheckoutResult placeOrder(int customerId, CheckoutRequest request, Authorisation card,
            BigDecimal authorisedAmount) {
        String cartJson = mapper.writeValueAsString(request.cartItems());
        return actorJdbc.execute(ActorJdbc.customer(customerId), connection -> {
            try (CallableStatement call = connection.prepareCall(
                    "{call ProcessCheckout(?,?,?,?,?,?,?,?,?,?,?,?,?)}")) {
                call.setInt(1, customerId);
                call.setString(2, cartJson);
                call.setString(3, request.deliveryMode());
                call.setString(4, request.paymentMethod());
                call.setObject(5, request.cityId(), Types.INTEGER);
                call.setString(6, request.addressLine());
                call.setString(7, card == null ? null : card.token());
                call.setString(8, card == null ? null : card.reference());
                call.setString(9, card == null ? null : card.lastFour());
                call.setString(10, card == null ? null : card.cardType());
                call.setBigDecimal(11, authorisedAmount);
                call.registerOutParameter(12, Types.VARCHAR);
                call.registerOutParameter(13, Types.INTEGER);
                call.execute();
                String status = call.getString(12);
                int orderId = call.getInt(13);
                return new CheckoutResult(status, call.wasNull() ? null : orderId, List.of());
            }
        });
    }

    /** After a stock conflict: which cart lines cannot be supplied, so the customer can be told. */
    public List<Integer> unavailableVariants(List<CartItem> cart) {
        String sql = """
                SELECT j.variant_id
                FROM JSON_TABLE(?, '$[*]'
                     COLUMNS (variant_id INT PATH '$.variantId', quantity INT PATH '$.quantity')) j
                LEFT JOIN variant v ON v.variant_id = j.variant_id
                LEFT JOIN product p ON p.product_id = v.product_id
                WHERE v.variant_id IS NULL OR p.is_active = FALSE OR v.price <= 0
                   OR j.quantity > v.stock_quantity
                ORDER BY j.variant_id
                """;
        return jdbc.queryForList(sql, Integer.class, mapper.writeValueAsString(cart));
    }

    /** @param status OK, or why the cart cannot be bought */
    public record Quote(String status, BigDecimal total) {
    }
}
