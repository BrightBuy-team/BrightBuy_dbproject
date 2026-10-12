package com.brightbuy.backend.catalogue;

import java.sql.CallableStatement;
import java.sql.Connection;
import java.sql.SQLException;
import java.sql.Types;
import javax.sql.DataSource;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Repository;

@Repository
public class CatalogueRepository {
    private final DataSource dataSource;
    private final int queryTimeout;

    public CatalogueRepository(DataSource dataSource,
            @Value("${brightbuy.query-timeout-seconds:5}") int queryTimeout) {
        if (queryTimeout < 1 || queryTimeout > 60) throw new IllegalArgumentException("Catalogue query timeout must be 1..60 seconds");
        this.dataSource = dataSource;
        this.queryTimeout = queryTimeout;
    }

    public String search(CatalogueSearch search) {
        return call("{call sp_catalogue_search(?,?,?,?,?,?,?,?,?)}", 9, statement -> {
            statement.setObject(1, search.keyword(), Types.VARCHAR);
            statement.setObject(2, search.categoryId(), Types.INTEGER);
            statement.setObject(3, search.minPrice(), Types.DECIMAL);
            statement.setObject(4, search.maxPrice(), Types.DECIMAL);
            statement.setInt(5, search.inStockOnly() ? 1 : 0);
            statement.setString(6, search.sort());
            statement.setInt(7, search.page());
            statement.setInt(8, search.pageSize());
        });
    }

    public String categories() {
        return call("{call sp_catalogue_categories(?)}", 1, statement -> {});
    }

    public String product(int id) {
        return call("{call sp_catalogue_product_detail(?,?)}", 2, statement -> statement.setInt(1, id));
    }

    private String call(String sql, int outputIndex, Binder binder) {
        try (Connection connection = dataSource.getConnection();
             CallableStatement statement = connection.prepareCall(sql)) {
            statement.setQueryTimeout(queryTimeout);
            binder.bind(statement);
            statement.registerOutParameter(outputIndex, Types.VARCHAR);
            statement.execute();
            return statement.getString(outputIndex);
        } catch (SQLException exception) {
            String state = exception.getSQLState();
            if ("45004".equals(state))
                throw new CatalogueException(HttpStatus.NOT_FOUND, "PRODUCT_NOT_FOUND", "Product not found or unavailable.", exception);
            if ("45000".equals(state))
                throw new CatalogueException(HttpStatus.BAD_REQUEST, "INVALID_PARAMETER", "Invalid catalogue query.", exception);
            if (exception instanceof java.sql.SQLTimeoutException
                    || exception instanceof java.sql.SQLTransientConnectionException
                    || exception instanceof java.sql.SQLNonTransientConnectionException
                    || (state != null && state.startsWith("08")))
                throw new CatalogueException(HttpStatus.SERVICE_UNAVAILABLE, "CATALOGUE_UNAVAILABLE", "Catalogue is temporarily unavailable.", exception);
            throw new CatalogueException(HttpStatus.INTERNAL_SERVER_ERROR, "CATALOGUE_ERROR", "Unable to load catalogue data.", exception);
        }
    }

    @FunctionalInterface
    private interface Binder {
        void bind(CallableStatement statement) throws SQLException;
    }
}
