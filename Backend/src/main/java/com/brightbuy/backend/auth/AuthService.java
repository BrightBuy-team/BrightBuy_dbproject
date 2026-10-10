package com.brightbuy.backend.auth;

import java.security.SecureRandom;
import java.util.Base64;
import java.util.Locale;
import org.springframework.dao.DataAccessException;
import org.springframework.http.HttpStatus;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;

@Service
public class AuthService {
    private static final int MAX_RECENT_FAILURES = 5;

    private final AuthRepository repository;
    private final PasswordEncoder passwordEncoder;
    private final SecureRandom random = new SecureRandom();

    public AuthService(AuthRepository repository, PasswordEncoder passwordEncoder) {
        this.repository = repository;
        this.passwordEncoder = passwordEncoder;
    }

    public Integer registerCustomer(RegisterCustomerRequest request) {
        try {
            return repository.registerCustomer(request.firstName().trim(), request.lastName().trim(),
                    normalizeEmail(request.email()), passwordEncoder.encode(request.password()), request.phone(),
                    request.addressLine(), request.cityId());
        } catch (DataAccessException exception) {
            if (hasMessage(exception, "email already registered")) {
                throw new AuthException(HttpStatus.CONFLICT, "EMAIL_ALREADY_REGISTERED",
                        "An account with this email already exists.");
            }
            if (hasMessage(exception, "foreign key constraint fails")) {
                throw new AuthException(HttpStatus.BAD_REQUEST, "INVALID_CITY", "The selected city is unavailable.");
            }
            throw new AuthException(HttpStatus.SERVICE_UNAVAILABLE, "AUTH_UNAVAILABLE",
                    "Account registration is temporarily unavailable.");
        }
    }

    /** {@code actor} is who is creating the account; it is written to the audit log. */
    public Integer createEmployee(String actor, CreateEmployeeRequest request) {
        try {
            return repository.createEmployee(actor, request.firstName().trim(), request.lastName().trim(),
                    normalizeEmail(request.email()), passwordEncoder.encode(request.password()), request.contactNo(),
                    request.role());
        } catch (DataAccessException exception) {
            if (hasMessage(exception, "email already registered")) {
                throw new AuthException(HttpStatus.CONFLICT, "EMAIL_ALREADY_REGISTERED",
                        "An account with this email already exists.");
            }
            throw new AuthException(HttpStatus.SERVICE_UNAVAILABLE, "AUTH_UNAVAILABLE",
                    "Employee provisioning is temporarily unavailable.");
        }
    }

    public boolean employeeHasRole(Integer employeeId, EmployeeRole role) {
        try {
            return repository.employeeHasRole(employeeId, role);
        } catch (DataAccessException exception) {
            throw new AuthException(HttpStatus.SERVICE_UNAVAILABLE, "AUTH_UNAVAILABLE",
                    "Employee permissions are temporarily unavailable.");
        }
    }

    /** True when the employee holds at least one of the roles and the account is active. */
    public boolean employeeHasAnyRole(Integer employeeId, EmployeeRole... roles) {
        for (EmployeeRole role : roles) {
            if (employeeHasRole(employeeId, role)) {
                return true;
            }
        }
        return false;
    }

    public AuthenticatedUser login(LoginRequest request) {
        String email = normalizeEmail(request.email());
        try {
            if (repository.recentFailures(email) >= MAX_RECENT_FAILURES) {
                repository.logLogin(email, request.accountType(), false);
                throw new AuthException(HttpStatus.TOO_MANY_REQUESTS, "LOGIN_RATE_LIMITED",
                        "Invalid email or password.");
            }

            AuthRepository.LoginAccount account = request.accountType() == AccountType.CUSTOMER
                    ? repository.findCustomerForLogin(email)
                    : repository.findEmployeeForLogin(email);
            boolean authenticated = account != null && passwordMatches(request.password(), account.passwordHash());
            repository.logLogin(email, request.accountType(), authenticated);
            if (!authenticated) {
                throw invalidCredentials();
            }

            String role = request.accountType() == AccountType.CUSTOMER ? "Customer" : account.role();
            return new AuthenticatedUser(account.id(), email, request.accountType(), role);
        } catch (AuthException exception) {
            throw exception;
        } catch (DataAccessException exception) {
            throw new AuthException(HttpStatus.SERVICE_UNAVAILABLE, "AUTH_UNAVAILABLE",
                    "Sign-in is temporarily unavailable.");
        }
    }

    /**
     * Starts a password reset. The answer is the same whether or not the account exists, so an
     * email address cannot be probed. The one-time code is emailed; only its hash is stored.
     */
    public void requestPasswordReset(String email, AccountType accountType) {
        byte[] bytes = new byte[32];
        random.nextBytes(bytes);
        String code = Base64.getUrlEncoder().withoutPadding().encodeToString(bytes);
        try {
            repository.requestPasswordReset(normalizeEmail(email), accountType, code);
        } catch (DataAccessException exception) {
            throw new AuthException(HttpStatus.SERVICE_UNAVAILABLE, "AUTH_UNAVAILABLE",
                    "Password reset is temporarily unavailable.");
        }
    }

    public void confirmPasswordReset(String code, String newPassword) {
        String status;
        try {
            status = repository.confirmPasswordReset(code.trim(), passwordEncoder.encode(newPassword));
        } catch (DataAccessException exception) {
            throw new AuthException(HttpStatus.SERVICE_UNAVAILABLE, "AUTH_UNAVAILABLE",
                    "Password reset is temporarily unavailable.");
        }
        if (!"SUCCESS".equals(status)) {
            throw new AuthException(HttpStatus.BAD_REQUEST, "INVALID_RESET_CODE",
                    "This reset code is invalid or has expired.");
        }
    }

    private String normalizeEmail(String email) {
        return email.trim().toLowerCase(Locale.ROOT);
    }

    private boolean passwordMatches(String rawPassword, String encodedPassword) {
        try {
            return passwordEncoder.matches(rawPassword, encodedPassword);
        } catch (IllegalArgumentException exception) {
            return false;
        }
    }

    private boolean hasMessage(Throwable throwable, String fragment) {
        for (Throwable current = throwable; current != null; current = current.getCause()) {
            if (current.getMessage() != null && current.getMessage().toLowerCase(Locale.ROOT).contains(fragment)) {
                return true;
            }
        }
        return false;
    }

    private AuthException invalidCredentials() {
        return new AuthException(HttpStatus.UNAUTHORIZED, "INVALID_CREDENTIALS", "Invalid email or password.");
    }

    public record RegisterCustomerRequest(String firstName, String lastName, String email, String password,
            String phone, String addressLine, Integer cityId) {
    }

    public record CreateEmployeeRequest(String firstName, String lastName, String email, String password,
            String contactNo, EmployeeRole role) {
    }

    public record LoginRequest(String email, String password, AccountType accountType) {
    }
}
