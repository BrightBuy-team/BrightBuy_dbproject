package com.brightbuy.backend.catalogue;

import static org.assertj.core.api.Assertions.*;
import static org.mockito.Mockito.*;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.NullSource;
import org.junit.jupiter.params.provider.ValueSource;
import tools.jackson.databind.json.JsonMapper;

class CatalogueServiceTests {
    CatalogueRepository repository = mock(CatalogueRepository.class);
    CatalogueService service = new CatalogueService(repository, new JsonMapper());

    @Test
    void parsesResponseWithoutDoubleEncoding() {
        when(repository.categories()).thenReturn("{\"items\":[{\"category_id\":1}]}");
        assertThat(service.categories().get("items").get(0).get("category_id").asInt()).isEqualTo(1);
    }

    @Test
    void laterSearchReadsFreshPricesAndReturnsAnIndependentTree() {
        var search = new CatalogueSearch(null, null, null, null, false, "name_asc", 1, 12);
        when(repository.search(search)).thenReturn("{\"items\":[{\"price\":10}]}", "{\"items\":[{\"price\":20}]}");
        var first = service.search(search);
        var second = service.search(search);
        assertThat(first.get("items").get(0).get("price").asInt()).isEqualTo(10);
        assertThat(second.get("items").get(0).get("price").asInt()).isEqualTo(20);
        assertThat(first).isNotSameAs(second);
        verify(repository, times(2)).search(search);
    }

    @ParameterizedTest
    @NullSource
    @ValueSource(strings = {"", "null", "[]", "not JSON", "\"string\""})
    void invalidStoredProcedureResponseIsSafe500(String response) {
        when(repository.categories()).thenReturn(response);
        assertThatThrownBy(service::categories).isInstanceOfSatisfying(CatalogueException.class,
                exception -> assertThat(exception.status().value()).isEqualTo(500));
    }
}
