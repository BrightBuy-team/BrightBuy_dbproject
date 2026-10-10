package com.brightbuy.backend.auth;

import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Repository;

@Repository
public class AddressRepository {

    private final JdbcTemplate jdbcTemplate;

    public AddressRepository(JdbcTemplate jdbcTemplate) {
        this.jdbcTemplate = jdbcTemplate;
    }

    public AddressController.AddressResponse getAddress(Integer customerId) {
        String sql = """
            SELECT c.address_line, c.city_id, ci.name as city_name
            FROM customer c
            LEFT JOIN city ci ON c.city_id = ci.city_id
            WHERE c.customer_id = ?
        """;

        return jdbcTemplate.query(sql, rs -> {
            if (rs.next()) {
                return new AddressController.AddressResponse(
                    rs.getString("address_line"),
                    rs.getObject("city_id") != null ? rs.getInt("city_id") : null,
                    rs.getString("city_name")
                );
            }
            return null;
        }, customerId);
    }

    public void updateAddress(Integer customerId, String addressLine, Integer cityId) {
        if (jdbcTemplate.queryForObject("SELECT COUNT(*) FROM city WHERE city_id=?", Integer.class, cityId) != 1) {
            throw new org.springframework.web.server.ResponseStatusException(org.springframework.http.HttpStatus.BAD_REQUEST, "Unknown city");
        }
        String sql = "UPDATE customer SET address_line = ?, city_id = ? WHERE customer_id = ?";
        if (jdbcTemplate.update(sql, addressLine, cityId, customerId) != 1) {
            throw new org.springframework.web.server.ResponseStatusException(org.springframework.http.HttpStatus.NOT_FOUND);
        }
    }
}

