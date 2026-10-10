package com.brightbuy.backend.catalogue;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.csrf;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.webmvc.test.autoconfigure.WebMvcTest;
import com.brightbuy.backend.config.SecurityConfiguration;
import org.springframework.context.annotation.Import;
import org.springframework.http.HttpStatus;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;
import tools.jackson.databind.json.JsonMapper;

@WebMvcTest(CatalogueController.class)
@Import(SecurityConfiguration.class)
class CatalogueWebTests {
    @Autowired MockMvc mvc;
    @Autowired JsonMapper mapper;
    @MockitoBean CatalogueService service;

    @Test
    void anonymousSearchReturnsJsonNotAnEncodedString() throws Exception {
        when(service.search(any())).thenReturn(mapper.readTree(
                "{\"page\":1,\"page_size\":12,\"total_products\":39,\"items\":[]}"));
        mvc.perform(get("/api/catalogue/products"))
                .andExpect(status().isOk()).andExpect(content().contentTypeCompatibleWith("application/json"))
                .andExpect(jsonPath("$.total_products").value(39)).andExpect(jsonPath("$.items").isArray());
        verify(service).search(new CatalogueSearch(null, null, null, null, false, "name_asc", 1, 12));
    }

    @Test
    void anonymousCategories() throws Exception {
        when(service.categories()).thenReturn(mapper.readTree("{\"items\":[]}"));
        mvc.perform(get("/api/catalogue/categories")).andExpect(status().isOk())
                .andExpect(jsonPath("$.items").isArray());
    }

    @Test
    void detailIncludesNullImageAndZeroStockVariant() throws Exception {
        when(service.product(1)).thenReturn(mapper.readTree(
                "{\"product_id\":1,\"image_url\":null,\"variants\":[{\"variant_id\":3,\"stock_quantity\":0}]}"));
        mvc.perform(get("/api/catalogue/products/1")).andExpect(status().isOk())
                .andExpect(jsonPath("$.product_id").value(1))
                .andExpect(jsonPath("$.variants[0].stock_quantity").value(0));
    }

    @ParameterizedTest
    @ValueSource(strings = {"0", "-1", "abc", "2147483648", "1.5"})
    void invalidProductIdsNeverReachDatabase(String id) throws Exception {
        mvc.perform(get("/api/catalogue/products/" + id)).andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("INVALID_PARAMETER"));
        verifyNoInteractions(service);
    }

    @Test
    void duplicateParametersRejected() throws Exception {
        mvc.perform(get("/api/catalogue/products").param("page", "1", "2"))
                .andExpect(status().isBadRequest());
        verifyNoInteractions(service);
    }

    @Test
    void missingProductMapsTo404() throws Exception {
        when(service.product(40)).thenThrow(new CatalogueException(HttpStatus.NOT_FOUND,
                "PRODUCT_NOT_FOUND", "Product not found or unavailable."));
        mvc.perform(get("/api/catalogue/products/40")).andExpect(status().isNotFound())
                .andExpect(jsonPath("$.code").value("PRODUCT_NOT_FOUND"));
    }

    @Test
    void databaseErrorDoesNotLeakSqlOrCause() throws Exception {
        when(service.categories()).thenThrow(new CatalogueException(HttpStatus.INTERNAL_SERVER_ERROR,
                "CATALOGUE_ERROR", "Unable to load catalogue data.", new RuntimeException("secret SQL text")));
        mvc.perform(get("/api/catalogue/categories")).andExpect(status().isInternalServerError())
                .andExpect(jsonPath("$.detail").value("Unable to load catalogue data."))
                .andExpect(content().string(org.hamcrest.Matchers.not(org.hamcrest.Matchers.containsString("secret SQL text"))));
    }

    @Test
    void unavailableDatabaseMapsTo503() throws Exception {
        when(service.categories()).thenThrow(new CatalogueException(HttpStatus.SERVICE_UNAVAILABLE,
                "CATALOGUE_UNAVAILABLE", "Catalogue is temporarily unavailable."));
        mvc.perform(get("/api/catalogue/categories")).andExpect(status().isServiceUnavailable());
    }

    @Test
    void allowedFrontendPreflight() throws Exception {
        mvc.perform(options("/api/catalogue/products").header("Origin", "http://localhost:5173")
                        .header("Access-Control-Request-Method", "GET"))
                .andExpect(status().isOk())
                .andExpect(header().string("Access-Control-Allow-Origin", "http://localhost:5173"));
    }

    @Test
    void unlistedOriginRejected() throws Exception {
        mvc.perform(get("/api/catalogue/products").header("Origin", "https://untrusted.example"))
                .andExpect(status().isForbidden());
        verifyNoInteractions(service);
    }

    @Test
    void writesAreNotPublic() throws Exception {
        mvc.perform(post("/api/catalogue/products").with(csrf())).andExpect(status().isForbidden());
        verifyNoInteractions(service);
    }

    @Test
    void writePreflightIsRejected() throws Exception {
        mvc.perform(options("/api/catalogue/products").header("Origin", "http://localhost:5173")
                        .header("Access-Control-Request-Method", "POST"))
                .andExpect(status().isForbidden());
    }

    @Test
    void unrelatedRoutesRemainProtected() throws Exception {
        mvc.perform(get("/api/orders").accept("application/json")).andExpect(status().isUnauthorized());
    }
}
