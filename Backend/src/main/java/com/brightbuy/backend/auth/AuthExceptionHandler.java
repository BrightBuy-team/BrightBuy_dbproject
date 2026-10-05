package com.brightbuy.backend.auth;

import java.util.Map;
import org.springframework.dao.DataAccessException;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;
import org.springframework.web.bind.MethodArgumentNotValidException;

@RestControllerAdvice(assignableTypes = AuthController.class)
public class AuthExceptionHandler {
    @ExceptionHandler(AuthException.class)
    ResponseEntity<Map<String, String>> handleAuth(AuthException exception) {
        return ResponseEntity.status(exception.status())
                .body(Map.of("code", exception.code(), "message", exception.getMessage()));
    }

    @ExceptionHandler(MethodArgumentNotValidException.class)
    ResponseEntity<Map<String, String>> handleInvalidRequest() {
        return ResponseEntity.badRequest()
                .body(Map.of("code", "INVALID_REQUEST", "message", "Check the submitted account details."));
    }

    @ExceptionHandler(DataAccessException.class)
    ResponseEntity<Map<String, String>> handleDatabaseUnavailable() {
        return ResponseEntity.internalServerError()
                .body(Map.of("code", "AUTH_UNAVAILABLE", "message", "Authentication is temporarily unavailable."));
    }
}