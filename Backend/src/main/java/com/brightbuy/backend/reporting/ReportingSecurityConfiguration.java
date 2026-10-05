package com.brightbuy.backend.reporting;

import java.util.Arrays;
import java.util.List;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.core.annotation.Order;
import org.springframework.http.HttpMethod;
import org.springframework.security.config.Customizer;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.web.SecurityFilterChain;
import org.springframework.web.cors.CorsConfiguration;
import org.springframework.web.cors.UrlBasedCorsConfigurationSource;

@Configuration(proxyBeanMethods = false)
public class ReportingSecurityConfiguration {

    @Bean
    @Order(9)
    SecurityFilterChain reportingSecurity(HttpSecurity http,
            @Value("${catalogue.cors.allowed-origins:http://localhost:5173,http://127.0.0.1:5173}") String origins)
            throws Exception {
        CorsConfiguration cors = new CorsConfiguration();
        cors.setAllowedOrigins(Arrays.stream(origins.split(",")).map(String::trim).filter(s -> !s.isEmpty()).toList());
        cors.setAllowedMethods(List.of("GET", "OPTIONS"));
        cors.setAllowedHeaders(List.of("Accept", "Content-Type"));
        cors.setAllowCredentials(true);
        UrlBasedCorsConfigurationSource source = new UrlBasedCorsConfigurationSource();
        source.registerCorsConfiguration("/api/reports/**", cors);

        return http.securityMatcher("/api/reports/**")
                .cors(config -> config.configurationSource(source))
                .httpBasic(Customizer.withDefaults())
                .authorizeHttpRequests(auth -> auth
                        .requestMatchers(HttpMethod.OPTIONS, "/api/reports/**").permitAll()
                        .requestMatchers(HttpMethod.GET, "/api/reports/**").authenticated()
                        .anyRequest().denyAll())
                .build();
    }
}
