package com.brightbuy.backend.inventory;

import java.util.Arrays;
import java.util.List;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.core.annotation.Order;
import org.springframework.http.HttpMethod;
import org.springframework.http.HttpStatus;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.http.SessionCreationPolicy;
import org.springframework.security.web.SecurityFilterChain;
import org.springframework.security.web.authentication.HttpStatusEntryPoint;
import org.springframework.web.cors.CorsConfiguration;
import org.springframework.web.cors.UrlBasedCorsConfigurationSource;

@Configuration(proxyBeanMethods = false)
public class InventorySecurityConfiguration {

    @Bean
    @Order(10)
    SecurityFilterChain inventorySecurity(HttpSecurity http,
            @Value("${catalogue.cors.allowed-origins:http://localhost:5173,http://127.0.0.1:5173}") String origins) throws Exception {
        CorsConfiguration cors = new CorsConfiguration();
        cors.setAllowedOrigins(Arrays.stream(origins.split(",")).map(String::trim).filter(s -> !s.isEmpty()).toList());
        cors.setAllowedMethods(List.of("GET", "POST", "PUT", "OPTIONS"));
        cors.setAllowedHeaders(List.of("Accept", "Content-Type", "X-XSRF-TOKEN"));
        cors.setAllowCredentials(true);
        UrlBasedCorsConfigurationSource source = new UrlBasedCorsConfigurationSource();
        source.registerCorsConfiguration("/api/inventory/**", cors);

        return http.securityMatcher("/api/inventory/**")
                .cors(config -> config.configurationSource(source))
                .csrf(config -> config.disable())
                .sessionManagement(config -> config.sessionCreationPolicy(SessionCreationPolicy.IF_REQUIRED))
                .exceptionHandling(config -> config.authenticationEntryPoint(new HttpStatusEntryPoint(HttpStatus.UNAUTHORIZED)))
                .authorizeHttpRequests(auth -> auth
                        .requestMatchers(HttpMethod.OPTIONS, "/api/inventory/**").permitAll()
                        .requestMatchers(HttpMethod.GET, "/api/inventory/**").permitAll()
                        .requestMatchers(HttpMethod.PUT, "/api/inventory/variants/*/stock").hasAnyRole("WAREHOUSESTAFF", "ADMIN")
                        .anyRequest().denyAll())
                .build();
    }
}
