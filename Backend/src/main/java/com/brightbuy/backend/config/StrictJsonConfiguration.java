package com.brightbuy.backend.config;
import org.springframework.context.annotation.*;
import org.springframework.boot.jackson.autoconfigure.JsonMapperBuilderCustomizer;
import tools.jackson.databind.DeserializationFeature;
import tools.jackson.databind.MapperFeature;
@Configuration(proxyBeanMethods=false)
public class StrictJsonConfiguration {
 @Bean JsonMapperBuilderCustomizer strictNumbers(){
  return builder->builder.disable(DeserializationFeature.ACCEPT_FLOAT_AS_INT)
   .disable(MapperFeature.ALLOW_COERCION_OF_SCALARS);
 }
}
