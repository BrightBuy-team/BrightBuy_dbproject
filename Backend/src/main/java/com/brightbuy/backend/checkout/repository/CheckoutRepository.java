package com.brightbuy.backend.checkout.repository;

import com.brightbuy.backend.checkout.dto.CartItemDto;
import tools.jackson.core.JacksonException;
import tools.jackson.databind.ObjectMapper;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.core.namedparam.MapSqlParameterSource;
import org.springframework.jdbc.core.namedparam.SqlParameterSource;
import org.springframework.jdbc.core.simple.SimpleJdbcCall;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Map;

@Repository 

public class CheckoutRepository {
    
    private final JdbcTemplate jdbcTemplate;
    private final ObjectMapper objectMapper;

    public CheckoutRepository(JdbcTemplate jdbcTemplate, ObjectMapper objectMapper) {
        this.jdbcTemplate = jdbcTemplate;
        this.objectMapper = objectMapper;
    }

    public String callProcessCheckout(Integer customerId, List<CartItemDto> cartItems, String deliveryMode, String paymentMethod) {

        try {
            //convert list of Java cartItems to strign, to send to sql procedure
            String cartItemsJson = objectMapper.writeValueAsString(cartItems);

            // Configure the call to your exact stored procedure
            SimpleJdbcCall jdbcCall = new SimpleJdbcCall(jdbcTemplate)
                    .withProcedureName("ProcessCheckout");

            // Bind the IN parameters
            SqlParameterSource in = new MapSqlParameterSource()
                    .addValue("p_customer_id", customerId)
                    .addValue("p_cart_json", cartItemsJson)
                    .addValue("p_delivery_mode", deliveryMode)
                    .addValue("p_payment_method", paymentMethod);

            // Execute the procedure and capture the OUT parameter
            Map<String, Object> out = jdbcCall.execute(in);
            
            return (String) out.get("p_status");

        } catch (JacksonException e) {
            throw new RuntimeException("Failed to parse cart JSON", e);
        }

    }
}

