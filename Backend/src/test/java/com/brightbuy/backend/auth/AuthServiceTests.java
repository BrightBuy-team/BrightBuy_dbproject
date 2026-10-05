package com.brightbuy.backend.auth;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.Mockito.*;

import org.junit.jupiter.api.Test;
import org.springframework.http.HttpStatus;
import org.springframework.security.crypto.password.PasswordEncoder;

class AuthServiceTests {
    private final AuthRepository repository = mock(AuthRepository.class);
    private final PasswordEncoder passwordEncoder = mock(PasswordEncoder.class);
    private final AuthService service = new AuthService(repository, passwordEncoder);

    @Test
    void successfulEmployeeLoginReturnsDatabaseRoleAndLogsSuccess() {
        when(repository.recentFailures("manager@example.com")).thenReturn(0);
        when(repository.findEmployeeForLogin("manager@example.com"))
                .thenReturn(new AuthRepository.LoginAccount(7, "bcrypt-hash", "Management"));
        when(passwordEncoder.matches("valid-password", "bcrypt-hash")).thenReturn(true);

        AuthenticatedUser user = service.login(
                new AuthService.LoginRequest("Manager@Example.com", "valid-password", AccountType.EMPLOYEE));

        assertThat(user).isEqualTo(new AuthenticatedUser(7, "manager@example.com", AccountType.EMPLOYEE, "Management"));
        verify(repository).logLogin("manager@example.com", AccountType.EMPLOYEE, true);
    }

    @Test
    void unknownAndWrongPasswordsUseTheSameGenericFailure() {
        when(repository.recentFailures("unknown@example.com")).thenReturn(0);
        when(repository.findCustomerForLogin("unknown@example.com")).thenReturn(null);

        assertThatThrownBy(() -> service.login(
                new AuthService.LoginRequest("unknown@example.com", "bad-password", AccountType.CUSTOMER)))
                .isInstanceOfSatisfying(AuthException.class, exception -> {
                    assertThat(exception.status()).isEqualTo(HttpStatus.UNAUTHORIZED);
                    assertThat(exception.getMessage()).isEqualTo("Invalid email or password.");
                });
        verify(repository).logLogin("unknown@example.com", AccountType.CUSTOMER, false);
        verifyNoInteractions(passwordEncoder);
    }

    @Test
    void fifthRecentFailureBlocksPasswordLookup() {
        when(repository.recentFailures("customer@example.com")).thenReturn(5);

        assertThatThrownBy(() -> service.login(
                new AuthService.LoginRequest("customer@example.com", "password", AccountType.CUSTOMER)))
                .isInstanceOfSatisfying(AuthException.class,
                        exception -> assertThat(exception.status()).isEqualTo(HttpStatus.TOO_MANY_REQUESTS));
        verify(repository).logLogin("customer@example.com", AccountType.CUSTOMER, false);
        verify(repository, never()).findCustomerForLogin(anyString());
        verifyNoInteractions(passwordEncoder);
    }

    @Test
    void malformedSeedHashIsTreatedAsInvalidCredentials() {
        when(repository.recentFailures("admin@example.com")).thenReturn(0);
        when(repository.findEmployeeForLogin("admin@example.com"))
                .thenReturn(new AuthRepository.LoginAccount(1, "$2b$10$PLACEHOLDER_HASH", "Admin"));
        when(passwordEncoder.matches("password", "$2b$10$PLACEHOLDER_HASH"))
                .thenThrow(new IllegalArgumentException("Malformed BCrypt hash"));

        assertThatThrownBy(() -> service.login(
                new AuthService.LoginRequest("admin@example.com", "password", AccountType.EMPLOYEE)))
                .isInstanceOfSatisfying(AuthException.class, exception -> {
                    assertThat(exception.status()).isEqualTo(HttpStatus.UNAUTHORIZED);
                    assertThat(exception.getMessage()).isEqualTo("Invalid email or password.");
                });
        verify(repository).logLogin("admin@example.com", AccountType.EMPLOYEE, false);
    }

    @Test
    void registrationNormalizesEmailAndStoresOnlyEncodedPassword() {
        when(passwordEncoder.encode("long-password")).thenReturn("bcrypt-hash");
        when(repository.registerCustomer("Alex", "Smith", "alex@example.com", "bcrypt-hash", null, null, 2))
                .thenReturn(42);

        Integer customerId = service.registerCustomer(new AuthService.RegisterCustomerRequest(" Alex ", " Smith ",
                "Alex@Example.com", "long-password", null, null, 2));

        assertThat(customerId).isEqualTo(42);
        verify(repository).registerCustomer("Alex", "Smith", "alex@example.com", "bcrypt-hash", null, null, 2);
    }
}