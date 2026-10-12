package com.brightbuy.backend.catalogue;

import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import tools.jackson.core.JacksonException;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.json.JsonMapper;

@Service
public class CatalogueService {
    private final CatalogueRepository repository;
    private final JsonMapper mapper;
    private final InFlightSearches searches = new InFlightSearches();

    public CatalogueService(CatalogueRepository repository, JsonMapper mapper) {
        this.repository = repository;
        this.mapper = mapper;
    }

    // Each caller gets its own parsed tree; no stock/price snapshot survives a query.
    public JsonNode search(CatalogueSearch search) {
        return response(searches.execute(search, () -> repository.search(search)));
    }
    public JsonNode categories() { return response(repository.categories()); }
    public JsonNode product(int id) { return response(repository.product(id)); }

    private JsonNode response(String json) {
        try {
            JsonNode result = json == null ? null : mapper.readTree(json);
            if (result == null || !result.isObject()) throw invalidResponse(null);
            return result;
        } catch (JacksonException exception) {
            throw invalidResponse(exception);
        }
    }

    private CatalogueException invalidResponse(Throwable cause) {
        return new CatalogueException(HttpStatus.INTERNAL_SERVER_ERROR, "CATALOGUE_ERROR",
                "Unable to load catalogue data.", cause);
    }
}
