package com.brightbuy.backend.auth;

import org.springframework.http.HttpStatus;
import org.springframework.web.server.ResponseStatusException;

/**
 * Customer IDs and employee IDs are separate number ranges, so a controller must know which
 * kind of account is signed in before it uses the ID.
 */
public final class Access {
    private Access() {
    }

    /** The signed-in customer's ID; 401 if nobody is signed in, 403 for an employee. */
    public static int customer(AuthenticatedUser user) {
        return require(user, AccountType.CUSTOMER);
    }

    /** The signed-in employee's ID; 401 if nobody is signed in, 403 for a customer. */
    public static int employee(AuthenticatedUser user) {
        return require(user, AccountType.EMPLOYEE);
    }

    private static int require(AuthenticatedUser user, AccountType type) {
        if (user == null || user.id() == null) {
            throw new ResponseStatusException(HttpStatus.UNAUTHORIZED);
        }
        if (user.accountType() != type) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN);
        }
        return user.id();
    }
}
