package com.brightbuy.backend.config;

import org.springframework.boot.jackson.autoconfigure.JsonMapperBuilderCustomizer;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import tools.jackson.databind.DeserializationFeature;
import tools.jackson.databind.MapperFeature;

/** A quantity of 1.5 or "2" is rejected instead of being silently turned into a whole number. */
@Configuration(proxyBeanMethods = false)
public class StrictJsonConfiguration {
    @Bean
    JsonMapperBuilderCustomizer strictNumbers() {
        return builder -> builder
                .disable(DeserializationFeature.ACCEPT_FLOAT_AS_INT)
                .disable(MapperFeature.ALLOW_COERCION_OF_SCALARS);
    }
}
