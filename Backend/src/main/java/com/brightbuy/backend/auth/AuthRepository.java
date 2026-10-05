package com.brightbuy.backend.auth;

import java.sql.CallableStatement;
import java.sql.Types;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Repository;

@Repository
public class AuthRepository {
    private final JdbcTemplate jdbcTemplate;

    public AuthRepository(JdbcTemplate jdbcTemplate) {
        this.jdbcTemplate = jdbcTemplate;
    }

    public Integer registerCustomer(String firstName, String lastName, String email, String passwordHash,
            String phone, String addressLine, Integer cityId) {
        return jdbcTemplate.execute(connection -> {
            CallableStatement statement = connection.prepareCall("{call sp_register_customer(?,?,?,?,?,?,?,?)}");
            statement.setString(1, firstName);
            statement.setString(2, lastName);
            statement.setString(3, email);
            statement.setString(4, passwordHash);
            statement.setString(5, phone);
            statement.setString(6, addressLine);
            if (cityId == null) {
                statement.setNull(7, Types.INTEGER);
            } else {
                statement.setInt(7, cityId);
            }
            statement.registerOutParameter(8, Types.INTEGER);
            return statement;
        }, statement -> {
            statement.execute();
            int customerId = statement.getInt(8);
            return statement.wasNull() ? null : customerId;
        });
    }

    public LoginAccount findCustomerForLogin(String email) {
        return jdbcTemplate.query("CALL sp_get_customer_login(?)", statement -> statement.setString(1, email), result ->
                result.next() ? new LoginAccount(result.getInt("customer_id"), result.getString("password_hash"), null)
                        : null);
    }

    public LoginAccount findEmployeeForLogin(String email) {
        return jdbcTemplate.query("CALL sp_get_employee_login(?)", statement -> statement.setString(1, email), result ->
                result.next() ? new LoginAccount(result.getInt("employee_id"), result.getString("password_hash"),
                        result.getString("role")) : null);
    }

    public int recentFailures(String email) {
        Integer count = jdbcTemplate.queryForObject("SELECT fn_recent_failures(?)", Integer.class, email);
        return count == null ? 0 : count;
    }

    public void logLogin(String email, AccountType accountType, boolean success) {
        jdbcTemplate.update("CALL sp_log_login(?,?,?)", email, accountType.name().toLowerCase(), success);
    }

    public record LoginAccount(Integer id, String passwordHash, String role) {
    }
}