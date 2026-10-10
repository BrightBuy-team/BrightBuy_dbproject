package com.brightbuy.backend.config;

import static org.assertj.core.api.Assertions.*;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.CsvSource;
import org.springframework.mock.env.MockEnvironment;

class ProductionSafetyTests {
    @Test
    void guardRunsOnlyWhenProductionProfileIsSelected() {
        var runner = new org.springframework.boot.test.context.runner.ApplicationContextRunner()
                .withUserConfiguration(ProductionSafetyConfiguration.class);
        runner.run(context -> assertThat(context).hasNotFailed());
        runner.withPropertyValues("spring.profiles.active=production")
                .run(context -> assertThat(context).hasFailed());
    }

    private MockEnvironment valid() {
        return new MockEnvironment()
                .withProperty("spring.datasource.url", "jdbc:mysql://database.example/brightbuy?sslMode=VERIFY_IDENTITY")
                .withProperty("spring.datasource.username", "scoped_application")
                .withProperty("spring.datasource.password", "test-only")
                .withProperty("spring.jpa.hibernate.ddl-auto", "none")
                .withProperty("spring.flyway.enabled", "false")
                .withProperty("server.servlet.session.cookie.secure", "true")
                .withProperty("server.servlet.session.cookie.same-site", "lax")
                .withProperty("catalogue.cors.allowed-origins", "https://shop.example,https://staff.example");
    }

    @Test
    void acceptsVerifiedTlsAndSecureSameSiteOrCrossSiteCookies() {
        var environment = valid();
        ProductionSafetyConfiguration.validate(environment);
        ProductionSafetyConfiguration.validate(environment.withProperty("server.servlet.session.cookie.same-site", "none"));
    }

    @ParameterizedTest
    @CsvSource(delimiter = '|', value = {
        "server.servlet.session.cookie.secure|false",
        "server.servlet.session.cookie.same-site|invalid",
        "spring.jpa.hibernate.ddl-auto|update",
        "spring.flyway.enabled|true",
        "spring.datasource.username|root",
        "spring.datasource.hikari.username|root",
        "spring.datasource.hikari.jdbc-url|jdbc:mysql://database.example/brightbuy?sslMode=DISABLED",
        "spring.datasource.hikari.data-source-properties.sslMode|DISABLED",
        "spring.datasource.hikari.data-source-properties.allowPublicKeyRetrieval|true",
        "spring.datasource.hikari.data-source-properties.user|root",
        "catalogue.cors.allowed-origins|http://shop.example",
        "catalogue.cors.allowed-origins|https://shop.example/path",
        "catalogue.cors.allowed-origins|https://shop.example/",
        "catalogue.cors.allowed-origins|https://shop.example?query=1",
        "catalogue.cors.allowed-origins|https://shop.example,",
        "catalogue.cors.allowed-origins|https://*.example",
        "spring.datasource.url|jdbc:mysql://localhost/brightbuy?sslMode=VERIFY_IDENTITY",
        "spring.datasource.url|jdbc:mysql://database.example/brightbuy",
        "spring.datasource.url|jdbc:mysql://database.example/brightbuy?sslMode=REQUIRED",
        "spring.datasource.url|jdbc:mysql://database.example/brightbuy?sslMode=VERIFY_IDENTITY&sslMode=DISABLED",
        "spring.datasource.url|jdbc:mysql://database.example/brightbuy?sslMode=VERIFY_IDENTITY&useSSL=false",
        "spring.datasource.url|jdbc:mysql://database.example/brightbuy?sslMode=VERIFY_IDENTITY&allowPublicKeyRetrieval=true",
        "spring.datasource.url|jdbc:mysql://database.example/brightbuy?sslMode=VERIFY_IDENTITY&user=root",
        "spring.datasource.url|jdbc:mysql://database.example/wrong?sslMode=VERIFY_IDENTITY"
    })
    void rejectsUnsafeDeploymentSettings(String key, String value) {
        assertThatThrownBy(() -> ProductionSafetyConfiguration.validate(valid().withProperty(key, value)))
                .isInstanceOf(RuntimeException.class);
    }

    @Test
    void invalidUrlDoesNotExposeItsSecretInAnExceptionOrCause() {
        assertThatThrownBy(() -> ProductionSafetyConfiguration.validate(valid().withProperty(
                "spring.datasource.url", "jdbc:mysql://user:secret password@database.example/brightbuy")))
                .hasMessageNotContaining("secret password").hasNoCause();
        assertThatThrownBy(() -> ProductionSafetyConfiguration.validate(valid().withProperty("spring.datasource.password", "")))
                .isInstanceOf(RuntimeException.class);
    }
}
