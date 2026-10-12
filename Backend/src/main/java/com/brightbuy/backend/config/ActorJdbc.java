package com.brightbuy.backend.config;

import java.sql.CallableStatement;
import java.sql.PreparedStatement;
import java.sql.Statement;
import java.sql.Types;
import org.springframework.jdbc.core.ConnectionCallback;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Component;

/**
 * Runs database work on behalf of a signed-in user.
 *
 * <p>The audit triggers (stock audit and audit log) record the session variable
 * {@code @brightbuy_actor}. This class sets it, runs the work on the same connection and always
 * clears it again, so a pooled connection can never carry one user's identity into another request.
 */
@Component
public class ActorJdbc {
    private final JdbcTemplate jdbc;

    public ActorJdbc(JdbcTemplate jdbc) {
        this.jdbc = jdbc;
    }

    /** Actor label for an employee, as stored in the audit tables. */
    public static String employee(int employeeId) {
        return "employee:" + employeeId;
    }

    /** Actor label for a customer, as stored in the audit tables. */
    public static String customer(int customerId) {
        return "customer:" + customerId;
    }

    public <T> T execute(String actor, ConnectionCallback<T> work) {
        return jdbc.execute((ConnectionCallback<T>) connection -> {
            try (PreparedStatement set = connection.prepareStatement("SET @brightbuy_actor = ?")) {
                set.setString(1, actor);
                set.execute();
            }
            try {
                return work.doInConnection(connection);
            } finally {
                try (Statement reset = connection.createStatement()) {
                    reset.execute("SET @brightbuy_actor = NULL");
                }
            }
        });
    }

    /** Calls a procedure that returns nothing, for example {@code CALL sp_inventory_set_stock(?, ?)}. */
    public void call(String actor, String sql, Object... arguments) {
        execute(actor, connection -> {
            try (PreparedStatement statement = connection.prepareStatement(sql)) {
                for (int index = 0; index < arguments.length; index++) {
                    statement.setObject(index + 1, arguments[index]);
                }
                statement.execute();
                return null;
            }
        });
    }

    /**
     * Calls a procedure whose last parameter is an INT OUT value holding a new row's ID. The SQL
     * lists every parameter, for example {@code {call sp_inventory_create_variant(?,?,?,?,?,?,?,?)}}.
     */
    public Integer callReturningId(String actor, String sql, Object... arguments) {
        return execute(actor, connection -> {
            try (CallableStatement statement = connection.prepareCall(sql)) {
                for (int index = 0; index < arguments.length; index++) {
                    statement.setObject(index + 1, arguments[index]);
                }
                statement.registerOutParameter(arguments.length + 1, Types.INTEGER);
                statement.execute();
                int id = statement.getInt(arguments.length + 1);
                return statement.wasNull() ? null : id;
            }
        });
    }
}
