package com.brightbuy.backend.config;

import java.sql.SQLException;
import org.springframework.dao.DataAccessException;
import org.springframework.http.HttpStatus;
import org.springframework.web.server.ResponseStatusException;

/**
 * Turns the errors raised by the maintenance procedures into HTTP answers without exposing SQL.
 *
 * <p>The procedures use SQLSTATE 45000 for invalid input or a broken business rule and 45004 for
 * a missing row; MySQL itself uses class 23 for duplicates and broken references.
 */
public final class DatabaseErrors {
    private DatabaseErrors() {
    }

    public static ResponseStatusException toHttp(DataAccessException exception) {
        String state = exception.getMostSpecificCause() instanceof SQLException sql ? sql.getSQLState() : null;
        if ("45004".equals(state)) {
            return new ResponseStatusException(HttpStatus.NOT_FOUND, "Record not found");
        }
        if ("45000".equals(state)) {
            return new ResponseStatusException(HttpStatus.BAD_REQUEST, "Invalid value or business rule");
        }
        if (state != null && state.startsWith("23")) {
            return new ResponseStatusException(HttpStatus.CONFLICT, "Duplicate or still referenced");
        }
        return new ResponseStatusException(HttpStatus.INTERNAL_SERVER_ERROR, "Update failed");
    }
}
