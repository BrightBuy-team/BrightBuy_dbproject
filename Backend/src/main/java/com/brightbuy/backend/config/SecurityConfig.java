package com.brightbuy.backend.config;

import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.web.SecurityFilterChain;

import org.springframework.core.annotation.Order;

@Configuration
public class SecurityConfig {

    @Bean
    @Order(20)
    public SecurityFilterChain inventorySecurityFilterChain(HttpSecurity http) throws Exception {
        http
                .securityMatcher("/api/inventory/**", "/api/delivery/**")
                .csrf(csrf -> csrf.disable()) // Disable CSRF for API testing
                .authorizeHttpRequests(auth -> auth
                        .anyRequest().permitAll() // Allow all traffic to your APIs without a password
                );

        return http.build();
    }
}
