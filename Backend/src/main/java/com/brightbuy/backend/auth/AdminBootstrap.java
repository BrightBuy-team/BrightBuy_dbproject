package com.brightbuy.backend.auth;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.dao.DataAccessException;
import org.springframework.stereotype.Component;

/**
 * Creates the first administrator of an empty system.
 *
 * <p>The seed data holds no usable passwords and employees cannot register themselves, so the
 * first administrator comes from two private settings, {@code BRIGHTBUY_BOOTSTRAP_ADMIN_EMAIL}
 * and {@code BRIGHTBUY_BOOTSTRAP_ADMIN_PASSWORD}. With both set, the account is created once at
 * start-up (nothing happens if that email already exists). Remove the settings afterwards; the
 * administrator then creates the other employees through {@code POST /api/auth/employees}.
 */
@Component
public class AdminBootstrap implements ApplicationRunner {
    private static final Logger log = LoggerFactory.getLogger(AdminBootstrap.class);
    private static final int MINIMUM_PASSWORD_LENGTH = 12;

    private final AuthService authService;
    private final AuthRepository repository;
    private final String email;
    private final String password;

    public AdminBootstrap(AuthService authService, AuthRepository repository,
            @Value("${brightbuy.bootstrap-admin.email:}") String email,
            @Value("${brightbuy.bootstrap-admin.password:}") String password) {
        this.authService = authService;
        this.repository = repository;
        this.email = email == null ? "" : email.trim().toLowerCase();
        this.password = password == null ? "" : password;
    }

    @Override
    public void run(ApplicationArguments arguments) {
        if (email.isEmpty() && password.isEmpty()) {
            return;
        }
        if (email.isEmpty() || password.length() < MINIMUM_PASSWORD_LENGTH || password.length() > 72) {
            log.warn("Bootstrap administrator not created: set an email and a password of {} to 72 characters.",
                    MINIMUM_PASSWORD_LENGTH);
            return;
        }
        try {
            if (repository.findEmployeeForLogin(email) != null) {
                log.info("Bootstrap administrator already exists; remove the bootstrap settings.");
                return;
            }
            authService.createEmployee("bootstrap", new AuthService.CreateEmployeeRequest(
                    "System", "Administrator", email, password, null, EmployeeRole.ADMIN));
            log.info("Bootstrap administrator created; remove the bootstrap settings now.");
        } catch (DataAccessException | AuthException exception) {
            // Never log the password, and never stop the application over this.
            log.warn("Bootstrap administrator could not be created: {}", exception.getClass().getSimpleName());
        }
    }
}
