package com.brightbuy.backend.config;

import java.net.URI;
import java.net.URLDecoder;
import java.nio.charset.StandardCharsets;
import java.util.HashMap;
import java.util.Locale;
import java.util.Map;
import org.springframework.beans.factory.config.BeanFactoryPostProcessor;
import org.springframework.boot.context.properties.bind.Bindable;
import org.springframework.boot.context.properties.bind.Binder;
import org.springframework.context.annotation.*;
import org.springframework.core.env.Environment;

/**
 * Refuses to start the production profile with unsafe settings: insecure cookies, a root or
 * password-less database account, an unverified database connection or loose CORS origins.
 * It never logs connection strings or secrets.
 */
@Configuration(proxyBeanMethods = false)
@Profile("production")
public class ProductionSafetyConfiguration {
    @Bean
    static BeanFactoryPostProcessor productionSettingsCheck(Environment environment) {
        // Fail before the datasource can connect with unsafe settings.
        return beanFactory -> validate(environment);
    }

    static void validate(Environment environment) {
        require(environment.getProperty("server.servlet.session.cookie.secure", Boolean.class, false),
                "Production requires Secure session cookies");
        String sameSite = environment.getProperty("server.servlet.session.cookie.same-site", "").toLowerCase(Locale.ROOT);
        require(java.util.Set.of("lax", "strict", "none").contains(sameSite), "Invalid production SameSite policy");
        String username = environment.getProperty("spring.datasource.hikari.username",
                environment.getProperty("spring.datasource.username", ""));
        require(!username.isBlank() && !username.equalsIgnoreCase("root"),
                "Production requires a non-root application database account");
        require(!environment.getProperty("spring.datasource.hikari.password",
                environment.getProperty("spring.datasource.password", "")).isBlank(),
                "Production database password must be supplied privately");

        String url = environment.getProperty("spring.datasource.url", "");
        try {
            require(url.equals(environment.getProperty("spring.datasource.hikari.jdbc-url", url)),
                    "Hikari must not override the verified production JDBC URL");
            require(url.startsWith("jdbc:mysql://"), "Production requires a MySQL JDBC URL");
            URI uri = URI.create(url.substring(5));
            require(uri.getHost() != null && uri.getUserInfo() == null
                    && !java.util.Set.of("localhost", "127.0.0.1", "[::1]", "::1").contains(uri.getHost().toLowerCase(Locale.ROOT))
                    && "/brightbuy".equals(uri.getPath()) && uri.getFragment() == null,
                    "Production requires a remote brightbuy database without URL credentials");
            Map<String, String> parameters = new HashMap<>();
            for (String entry : (uri.getRawQuery() == null ? "" : uri.getRawQuery()).split("&")) {
                if (entry.isEmpty()) continue;
                String[] pair = entry.split("=", 2);
                String key = URLDecoder.decode(pair[0], StandardCharsets.UTF_8).toLowerCase(Locale.ROOT);
                String value = pair.length == 2 ? URLDecoder.decode(pair[1], StandardCharsets.UTF_8) : "";
                require(parameters.putIfAbsent(key, value) == null, "Duplicate production JDBC parameter");
            }
            require("VERIFY_IDENTITY".equalsIgnoreCase(parameters.get("sslmode")),
                    "Production MySQL requires sslMode=VERIFY_IDENTITY");
            require(!parameters.containsKey("user") && !parameters.containsKey("password")
                    && !parameters.containsKey("usessl") && !parameters.containsKey("requiressl")
                    && !parameters.containsKey("verifyservercertificate")
                    && !parameters.containsKey("trustcertificatekeystoreurl")
                    && !"true".equalsIgnoreCase(parameters.get("allowpublickeyretrieval")),
                    "Remove URL credentials and conflicting/insecure legacy JDBC TLS options");
            var overrides = Binder.get(environment).bind("spring.datasource.hikari.data-source-properties",
                    Bindable.mapOf(String.class, String.class)).orElse(Map.of());
            for (var entry : overrides.entrySet()) {
                String key = entry.getKey().toLowerCase(Locale.ROOT);
                require(!java.util.Set.of("user", "password", "usessl", "requiressl", "verifyservercertificate",
                        "trustcertificatekeystoreurl").contains(key), "Unsafe Hikari JDBC property override");
                require(!key.equals("sslmode") || entry.getValue().equalsIgnoreCase("VERIFY_IDENTITY"),
                        "Hikari must not override verified JDBC TLS");
                require(!key.equals("allowpublickeyretrieval") || !entry.getValue().equalsIgnoreCase("true"),
                        "Hikari must not enable public key retrieval");
            }
        } catch (IllegalArgumentException exception) {
            // Do not attach a URI parsing exception: it may contain credentials.
            throw new IllegalStateException("Production JDBC URL failed safety checks; configure verified TLS and private credentials");
        }

        String origins = environment.getProperty("brightbuy.cors.allowed-origins", "");
        require(!origins.isBlank(), "Production requires explicit HTTPS frontend origins");
        for (String origin : origins.split(",", -1)) {
            try {
                URI uri = URI.create(origin.trim());
                require("https".equals(uri.getScheme()) && uri.getHost() != null
                        && !uri.getHost().contains("*") && uri.getUserInfo() == null
                        && (uri.getPath() == null || uri.getPath().isEmpty())
                        && uri.getQuery() == null && uri.getFragment() == null,
                        "Production CORS must contain exact HTTPS origins without paths");
            } catch (IllegalArgumentException exception) {
                throw new IllegalStateException("Invalid production CORS origin");
            }
        }
    }

    private static void require(boolean condition, String message) {
        if (!condition) throw new IllegalArgumentException(message);
    }
}
