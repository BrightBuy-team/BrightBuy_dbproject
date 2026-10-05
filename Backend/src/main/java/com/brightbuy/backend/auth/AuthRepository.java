package com.brightbuy.backend.auth;

import java.sql.CallableStatement;
import java.sql.Types;
import org.springframework.jdbc.core.CallableStatementCallback;
import org.springframework.jdbc.core.CallableStatementCreator;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.core.PreparedStatementSetter;
import org.springframework.jdbc.core.ResultSetExtractor;
import org.springframework.stereotype.Repository;

@Repository
public class AuthRepository {
    private final JdbcTemplate jdbcTemplate;

    public AuthRepository(JdbcTemplate jdbcTemplate) {
        this.jdbcTemplate = jdbcTemplate;
    }

    public Integer registerCustomer(String firstName, String lastName, String email, String passwordHash,
            String phone, String addressLine, Integer cityId) {
        CallableStatementCreator statementCreator = connection -> {
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
        };
        CallableStatementCallback<Integer> callback = statement -> {
            statement.execute();
            int customerId = statement.getInt(8);
            return statement.wasNull() ? null : customerId;
        };
        return jdbcTemplate.execute(statementCreator, callback);
    }

    public LoginAccount findCustomerForLogin(String email) {
        PreparedStatementSetter parameters = statement -> statement.setString(1, email);
        ResultSetExtractor<LoginAccount> extractor = result -> result.next()
                ? new LoginAccount(result.getInt("customer_id"), result.getString("password_hash"), null)
                : null;
        return jdbcTemplate.query("CALL sp_get_customer_login(?)", parameters, extractor);
    }

    public LoginAccount findEmployeeForLogin(String email) {
        PreparedStatementSetter parameters = statement -> statement.setString(1, email);
        ResultSetExtractor<LoginAccount> extractor = result -> result.next()
                ? new LoginAccount(result.getInt("employee_id"), result.getString("password_hash"),
                        result.getString("role"))
                : null;
        return jdbcTemplate.query("CALL sp_get_employee_login(?)", parameters, extractor);
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