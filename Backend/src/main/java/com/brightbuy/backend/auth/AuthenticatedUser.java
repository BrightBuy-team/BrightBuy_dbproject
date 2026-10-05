package com.brightbuy.backend.auth;

public record AuthenticatedUser(Integer id, String email, AccountType accountType, String role) {
}