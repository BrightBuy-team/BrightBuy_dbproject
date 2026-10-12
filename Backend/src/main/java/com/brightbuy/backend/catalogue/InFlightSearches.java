package com.brightbuy.backend.catalogue;

import java.util.concurrent.CompletableFuture;
import java.util.concurrent.CompletionException;
import java.util.concurrent.ConcurrentHashMap;
import java.util.function.Supplier;

/** Share only overlapping identical reads. Completed results are never cached. */
final class InFlightSearches {
    private final ConcurrentHashMap<CatalogueSearch, CompletableFuture<String>> pending = new ConcurrentHashMap<>();

    String execute(CatalogueSearch key, Supplier<String> query) {
        var mine = new CompletableFuture<String>();
        var existing = pending.putIfAbsent(key, mine);
        if (existing != null) {
            try {
                return existing.join();
            } catch (CompletionException exception) {
                if (exception.getCause() instanceof RuntimeException cause) throw cause;
                if (exception.getCause() instanceof Error cause) throw cause;
                throw exception;
            }
        }
        try {
            String result = query.get();
            mine.complete(result);
            return result;
        } catch (RuntimeException | Error exception) {
            mine.completeExceptionally(exception);
            throw exception;
        } finally {
            pending.remove(key, mine);
        }
    }
}
