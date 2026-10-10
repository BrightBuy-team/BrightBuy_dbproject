package com.brightbuy.backend.config;

import jakarta.servlet.DispatcherType;
import java.util.Arrays;
import java.util.List;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.core.Ordered;
import org.springframework.core.annotation.Order;
import org.springframework.http.HttpMethod;
import org.springframework.http.HttpStatus;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.http.SessionCreationPolicy;
import org.springframework.security.core.userdetails.UserDetailsService;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.security.provisioning.InMemoryUserDetailsManager;
import org.springframework.security.web.SecurityFilterChain;
import org.springframework.security.web.authentication.HttpStatusEntryPoint;
import org.springframework.security.web.context.HttpSessionSecurityContextRepository;
import org.springframework.security.web.context.SecurityContextRepository;
import org.springframework.security.web.csrf.CookieCsrfTokenRepository;
import org.springframework.web.cors.CorsConfiguration;
import org.springframework.web.cors.CorsConfigurationSource;
import org.springframework.web.cors.UrlBasedCorsConfigurationSource;

/**
 * Every access rule of the API in one place (SEC-5).
 *
 * <p>Sign-in creates a server-side session (HTTP-only cookie). Requests that change data must
 * also send the token from {@code GET /api/auth/csrf} in the {@code X-XSRF-TOKEN} header.
 * Roles come from the signed-in account: CUSTOMER, WAREHOUSESTAFF, MANAGEMENT or ADMIN.
 * Controllers re-check employee roles in the database so a disabled account loses access at once.
 */
@Configuration(proxyBeanMethods = false)
public class SecurityConfiguration {
    private static final String ORIGINS =
            "${brightbuy.cors.allowed-origins:http://localhost:5173,http://127.0.0.1:5173}";

    /** Signed-in areas: checkout, orders, reports, inventory, delivery and catalogue maintenance. */
    @Bean
    @Order(1)
    SecurityFilterChain protectedApi(HttpSecurity http, CookieCsrfTokenRepository csrfTokenRepository,
            @Value(ORIGINS) String origins) throws Exception {
        return http
                .securityMatcher("/api/checkout/**", "/api/orders/**", "/api/reports/**",
                        "/api/inventory/**", "/api/delivery/**", "/api/catalogue/staff/**")
                .cors(config -> config.configurationSource(cors(origins, true,
                        "GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS")))
                .csrf(config -> config.csrfTokenRepository(csrfTokenRepository))
                .exceptionHandling(config -> config
                        .authenticationEntryPoint(new HttpStatusEntryPoint(HttpStatus.UNAUTHORIZED)))
                .authorizeHttpRequests(auth -> auth
                        .requestMatchers(HttpMethod.OPTIONS, "/api/**").permitAll()
                        .requestMatchers(HttpMethod.GET, "/api/delivery/cities", "/api/delivery/preview").permitAll()
                        .requestMatchers("/api/checkout/**", "/api/orders/**").hasRole("CUSTOMER")
                        .requestMatchers("/api/reports/**").hasRole("MANAGEMENT")
                        .requestMatchers("/api/inventory/**", "/api/catalogue/staff/**")
                        .hasAnyRole("WAREHOUSESTAFF", "ADMIN")
                        .requestMatchers("/api/delivery/estimate").authenticated()
                        .anyRequest().denyAll())
                .build();
    }

    /** Accounts: registration, sign-in, password reset, the session itself and a customer's address. */
    @Bean
    @Order(2)
    SecurityFilterChain accountApi(HttpSecurity http, CookieCsrfTokenRepository csrfTokenRepository,
            SecurityContextRepository securityContextRepository, @Value(ORIGINS) String origins) throws Exception {
        return http
                .securityMatcher("/api/auth/**", "/api/addresses/**")
                .cors(config -> config.configurationSource(cors(origins, true, "GET", "POST", "PUT", "OPTIONS")))
                .csrf(config -> config.csrfTokenRepository(csrfTokenRepository))
                .securityContext(config -> config.securityContextRepository(securityContextRepository))
                .sessionManagement(config -> config.sessionCreationPolicy(SessionCreationPolicy.IF_REQUIRED))
                .exceptionHandling(config -> config
                        .authenticationEntryPoint(new HttpStatusEntryPoint(HttpStatus.UNAUTHORIZED)))
                .authorizeHttpRequests(auth -> auth
                        .requestMatchers(HttpMethod.OPTIONS, "/api/auth/**", "/api/addresses/**").permitAll()
                        .requestMatchers(HttpMethod.GET, "/api/auth/csrf").permitAll()
                        .requestMatchers(HttpMethod.POST, "/api/auth/register", "/api/auth/login",
                                "/api/auth/password-reset/request", "/api/auth/password-reset/confirm").permitAll()
                        .requestMatchers(HttpMethod.POST, "/api/auth/employees").hasRole("ADMIN")
                        .requestMatchers(HttpMethod.GET, "/api/auth/me").authenticated()
                        .requestMatchers(HttpMethod.POST, "/api/auth/logout").authenticated()
                        .requestMatchers(HttpMethod.GET, "/api/addresses/me").authenticated()
                        .requestMatchers(HttpMethod.PUT, "/api/addresses/me").authenticated()
                        .anyRequest().denyAll())
                .build();
    }

    /** The public catalogue: anyone may read it, nobody may write through it, and it needs no cookies. */
    @Bean
    @Order(3)
    SecurityFilterChain publicCatalogue(HttpSecurity http, @Value(ORIGINS) String origins) throws Exception {
        return http
                .securityMatcher("/api/catalogue/**")
                .cors(config -> config.configurationSource(cors(origins, false, "GET", "OPTIONS")))
                .exceptionHandling(config -> config
                        .authenticationEntryPoint(new HttpStatusEntryPoint(HttpStatus.FORBIDDEN)))
                .authorizeHttpRequests(auth -> auth
                        .requestMatchers(HttpMethod.GET, "/api/catalogue/**").permitAll()
                        .anyRequest().denyAll())
                .build();
    }

    /** Anything not listed above is refused. */
    @Bean
    @Order(Ordered.LOWEST_PRECEDENCE)
    SecurityFilterChain everythingElse(HttpSecurity http) throws Exception {
        return http
                .exceptionHandling(config -> config
                        .authenticationEntryPoint(new HttpStatusEntryPoint(HttpStatus.UNAUTHORIZED)))
                .authorizeHttpRequests(auth -> auth
                        .dispatcherTypeMatchers(DispatcherType.ERROR).permitAll()
                        .anyRequest().denyAll())
                .build();
    }

    private static CorsConfigurationSource cors(String origins, boolean credentials, String... methods) {
        CorsConfiguration cors = new CorsConfiguration();
        cors.setAllowedOrigins(Arrays.stream(origins.split(","))
                .map(String::trim).filter(origin -> !origin.isEmpty()).toList());
        cors.setAllowedMethods(List.of(methods));
        cors.setAllowedHeaders(credentials
                ? List.of("Accept", "Content-Type", "X-XSRF-TOKEN")
                : List.of("Accept", "Content-Type"));
        cors.setAllowCredentials(credentials);
        UrlBasedCorsConfigurationSource source = new UrlBasedCorsConfigurationSource();
        source.registerCorsConfiguration("/api/**", cors);
        return source;
    }

    @Bean
    SecurityContextRepository securityContextRepository() {
        return new HttpSessionSecurityContextRepository();
    }

    /** The CSRF cookie follows the session cookie's Secure and SameSite settings. */
    @Bean
    public CookieCsrfTokenRepository csrfTokenRepository(
            @Value("${server.servlet.session.cookie.secure:false}") boolean secure,
            @Value("${server.servlet.session.cookie.same-site:lax}") String sameSite) {
        CookieCsrfTokenRepository repository = CookieCsrfTokenRepository.withHttpOnlyFalse();
        repository.setCookieCustomizer(cookie -> cookie.secure(secure).sameSite(sameSite));
        return repository;
    }

    /** Passwords are stored as salted BCrypt hashes only (SEC-1). */
    @Bean
    PasswordEncoder passwordEncoder() {
        return new BCryptPasswordEncoder(12);
    }

    /** Accounts live in the database; this stops Spring creating a default user with a logged password. */
    @Bean
    UserDetailsService noBuiltInUsers() {
        return new InMemoryUserDetailsManager();
    }
}
