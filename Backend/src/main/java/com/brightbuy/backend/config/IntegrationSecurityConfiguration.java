package com.brightbuy.backend.config;

import java.util.Arrays;
import java.util.List;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.*;
import org.springframework.core.annotation.Order;
import org.springframework.http.*;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.web.*;
import org.springframework.security.web.authentication.HttpStatusEntryPoint;
import org.springframework.security.web.csrf.CookieCsrfTokenRepository;
import org.springframework.web.cors.*;

@Configuration(proxyBeanMethods=false)
public class IntegrationSecurityConfiguration {
 @Bean @Order(6)
 SecurityFilterChain integratedSecurity(HttpSecurity http, CookieCsrfTokenRepository csrf,
  @Value("${catalogue.cors.allowed-origins:http://localhost:5173,http://127.0.0.1:5173}") String origins) throws Exception {
  var cors=new CorsConfiguration();
  cors.setAllowedOrigins(Arrays.stream(origins.split(",")).map(String::trim).filter(s->!s.isEmpty()).toList());
  cors.setAllowedMethods(List.of("GET","POST","PUT","PATCH","DELETE","OPTIONS"));
  cors.setAllowedHeaders(List.of("Accept","Content-Type","X-XSRF-TOKEN")); cors.setAllowCredentials(true);
  var source=new UrlBasedCorsConfigurationSource(); source.registerCorsConfiguration("/api/**",cors);
  return http.securityMatcher("/api/checkout/**","/api/orders/**","/api/reports/**",
   "/api/inventory/**","/api/delivery/**","/api/catalogue/staff/**")
   .cors(c->c.configurationSource(source)).csrf(c->c.csrfTokenRepository(csrf))
   .exceptionHandling(c->c.authenticationEntryPoint(new HttpStatusEntryPoint(HttpStatus.UNAUTHORIZED)))
   .authorizeHttpRequests(a->a.requestMatchers(HttpMethod.OPTIONS,"/api/**").permitAll()
    .requestMatchers(HttpMethod.GET,"/api/delivery/cities","/api/delivery/preview").permitAll()
    .requestMatchers("/api/checkout/**","/api/orders/**").hasRole("CUSTOMER")
    .requestMatchers("/api/reports/**").hasRole("MANAGEMENT")
    .requestMatchers("/api/inventory/**","/api/catalogue/staff/**").hasAnyRole("WAREHOUSESTAFF","ADMIN")
    .requestMatchers("/api/delivery/estimate").authenticated().anyRequest().denyAll()).build();
 }
}
