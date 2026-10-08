package com.brightbuy.backend.auth;

import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import jakarta.servlet.http.HttpSession;
import jakarta.validation.Valid;
import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import java.util.List;
import java.util.Locale;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.context.SecurityContext;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.web.context.SecurityContextRepository;
import org.springframework.security.web.csrf.CsrfToken;
import org.springframework.security.web.csrf.CookieCsrfTokenRepository;
import org.springframework.validation.annotation.Validated;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@Validated
@RestController
@RequestMapping("/api/auth")
public class AuthController {
    private final AuthService authService;
    private final SecurityContextRepository securityContextRepository;
    private final CookieCsrfTokenRepository csrfTokenRepository;

    public AuthController(AuthService authService, SecurityContextRepository securityContextRepository,
            CookieCsrfTokenRepository csrfTokenRepository) {
        this.authService = authService;
        this.securityContextRepository = securityContextRepository;
        this.csrfTokenRepository = csrfTokenRepository;
    }

    @GetMapping("/csrf")
    public CsrfResponse csrf(CsrfToken token) {
        return new CsrfResponse(token.getToken());
    }

    @PostMapping("/register")
    public RegisterResponse register(@Valid @RequestBody RegisterRequest request) {
        Integer customerId = authService.registerCustomer(new AuthService.RegisterCustomerRequest(
                request.firstName(), request.lastName(), request.email(), request.password(), request.phone(),
                request.addressLine(), request.cityId()));
        return new RegisterResponse(customerId, request.email().trim().toLowerCase(Locale.ROOT));
    }

    @PostMapping("/employees")
    public ResponseEntity<EmployeeResponse> createEmployee(@Valid @RequestBody CreateEmployeeRequest request) {
        Integer employeeId = authService.createEmployee(new AuthService.CreateEmployeeRequest(
                request.firstName(), request.lastName(), request.email(), request.password(), request.contactNo(),
                request.role()));
        return ResponseEntity.status(HttpStatus.CREATED)
                .body(new EmployeeResponse(employeeId, request.email().trim().toLowerCase(Locale.ROOT),
                        request.role().databaseValue()));
    }

    @PostMapping("/login")
    public AuthResponse login(@Valid @RequestBody LoginRequest request, HttpServletRequest servletRequest,
            HttpServletResponse servletResponse) {
        AuthenticatedUser user = authService.login(new AuthService.LoginRequest(
                request.email(), request.password(), request.accountType()));
        if (servletRequest.getSession(false) != null) {
            servletRequest.changeSessionId();
        }
        var authorities = List.of(new SimpleGrantedAuthority("ROLE_" + user.role().toUpperCase(Locale.ROOT)));
        var authentication = UsernamePasswordAuthenticationToken.authenticated(user, null, authorities);
        SecurityContext context = SecurityContextHolder.createEmptyContext();
        context.setAuthentication(authentication);
        SecurityContextHolder.setContext(context);
        securityContextRepository.saveContext(context, servletRequest, servletResponse);
        return new AuthResponse(user);
    }

    @GetMapping("/me")
    public AuthResponse me(@org.springframework.security.core.annotation.AuthenticationPrincipal AuthenticatedUser user) {
        return new AuthResponse(user);
    }

    @PostMapping("/logout")
    public org.springframework.http.ResponseEntity<Void> logout(HttpServletRequest request,
            HttpServletResponse response) {
        SecurityContextHolder.clearContext();
        HttpSession session = request.getSession(false);
        if (session != null) {
            session.invalidate();
        }
        csrfTokenRepository.saveToken(null, request, response);
        return org.springframework.http.ResponseEntity.status(HttpStatus.NO_CONTENT).build();
    }

    public record RegisterRequest(@NotBlank @Size(max = 100) String firstName,
            @NotBlank @Size(max = 100) String lastName, @NotBlank @Email @Size(max = 150) String email,
            @NotBlank @Size(min = 8, max = 72) String password, @Size(max = 20) String phone,
            @Size(max = 255) String addressLine, Integer cityId) {
    }

    public record LoginRequest(@NotBlank @Email @Size(max = 150) String email,
            @NotBlank @Size(max = 72) String password, @NotNull AccountType accountType) {
    }

    public record CreateEmployeeRequest(@NotBlank @Size(max = 100) String firstName,
            @NotBlank @Size(max = 100) String lastName, @NotBlank @Email @Size(max = 150) String email,
            @NotBlank @Size(min = 8, max = 72) String password, @Size(max = 20) String contactNo,
            @NotNull EmployeeRole role) {
        }

    public record RegisterResponse(Integer customerId, String email) {
    }

    public record EmployeeResponse(Integer employeeId, String email, String role) {
    }

    public record AuthResponse(AuthenticatedUser user) {
    }

    public record CsrfResponse(String token) {
    }
}