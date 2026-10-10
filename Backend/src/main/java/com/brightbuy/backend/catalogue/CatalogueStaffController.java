package com.brightbuy.backend.catalogue;

import com.brightbuy.backend.auth.Access;
import com.brightbuy.backend.auth.AuthService;
import com.brightbuy.backend.auth.AuthenticatedUser;
import com.brightbuy.backend.auth.EmployeeRole;
import com.brightbuy.backend.config.ActorJdbc;
import com.brightbuy.backend.config.DatabaseErrors;
import jakarta.validation.Valid;
import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.Digits;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Positive;
import jakarta.validation.constraints.Size;
import java.math.BigDecimal;
import java.util.List;
import java.util.Map;
import java.util.function.Supplier;
import org.springframework.dao.DataAccessException;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.server.ResponseStatusException;

/**
 * Catalogue maintenance for warehouse staff and administrators (BR-14): products, categories
 * and category assignments. Every change goes through a procedure in
 * Database/Catalogue/05_catalogue_maintenance_procedures.sql and is written to the audit log
 * with the signed-in employee. Products are retired, never deleted (BR-18).
 */
@RestController
@RequestMapping("/api/catalogue/staff")
public class CatalogueStaffController {
    private static final int PAGE_SIZE = 100;

    private final JdbcTemplate jdbc;
    private final ActorJdbc actorJdbc;
    private final AuthService auth;

    public CatalogueStaffController(JdbcTemplate jdbc, ActorJdbc actorJdbc, AuthService auth) {
        this.jdbc = jdbc;
        this.actorJdbc = actorJdbc;
        this.auth = auth;
    }

    /** All products, including retired ones, 100 per page. */
    @GetMapping("/products")
    public List<Map<String, Object>> products(@AuthenticationPrincipal AuthenticatedUser user,
            @RequestParam(defaultValue = "") String keyword, @RequestParam(defaultValue = "1") int page) {
        staff(user);
        if (keyword.length() > 255 || page < 1 || page > 100000) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST);
        }
        String term = keyword.trim();
        return jdbc.queryForList("""
                SELECT product_id, sku, name, description, image_url, is_active
                FROM product
                WHERE ? = '' OR LOCATE(?, name) > 0 OR LOCATE(?, sku) > 0
                ORDER BY product_id LIMIT ? OFFSET ?
                """, term, term, term, PAGE_SIZE, (page - 1) * PAGE_SIZE);
    }

    @GetMapping("/categories")
    public List<Map<String, Object>> categories(@AuthenticationPrincipal AuthenticatedUser user) {
        staff(user);
        return jdbc.queryForList(
                "SELECT category_id, parent_category_id, name, description, is_active FROM category ORDER BY category_id");
    }

    @GetMapping("/warehouses")
    public List<Map<String, Object>> warehouses(@AuthenticationPrincipal AuthenticatedUser user) {
        staff(user);
        return jdbc.queryForList("SELECT warehouse_id, name FROM warehouse ORDER BY warehouse_id");
    }

    @GetMapping("/products/{productId}/categories")
    public List<Map<String, Object>> assignments(@AuthenticationPrincipal AuthenticatedUser user,
            @PathVariable int productId) {
        staff(user);
        return jdbc.queryForList("SELECT category_id FROM product_category WHERE product_id = ?", productId);
    }

    /** Creates the product with its first category and its default variant in one transaction. */
    @PostMapping("/products")
    @ResponseStatus(HttpStatus.CREATED)
    public Map<String, Integer> createProduct(@AuthenticationPrincipal AuthenticatedUser user,
            @Valid @RequestBody NewProduct product) {
        String actor = staff(user);
        Integer productId = write(() -> actorJdbc.callReturningId(actor,
                "{call sp_catalogue_create_product(?,?,?,?,?,?,?,?,?)}", product.sku(), product.name(),
                product.description(), product.imageUrl(), product.categoryId(), product.warehouseId(),
                product.price(), product.stock()));
        return Map.of("productId", productId);
    }

    @PutMapping("/products/{productId}")
    public void updateProduct(@AuthenticationPrincipal AuthenticatedUser user, @PathVariable int productId,
            @Valid @RequestBody ProductDetails product) {
        change(user, "CALL sp_catalogue_update_product(?, ?, ?, ?, ?)", productId, product.sku(),
                product.name(), product.description(), product.imageUrl());
    }

    /** Retires or restores a product. */
    @PatchMapping("/products/{productId}/active")
    public void setProductActive(@AuthenticationPrincipal AuthenticatedUser user, @PathVariable int productId,
            @RequestBody Active active) {
        change(user, "CALL sp_catalogue_set_product_active(?, ?)", productId, active.active() ? 1 : 0);
    }

    @PostMapping("/products/{productId}/categories/{categoryId}")
    public void assignCategory(@AuthenticationPrincipal AuthenticatedUser user, @PathVariable int productId,
            @PathVariable int categoryId) {
        change(user, "CALL sp_catalogue_assign_category(?, ?)", productId, categoryId);
    }

    /** Refused with 400 for a product's last category (BR-2). */
    @DeleteMapping("/products/{productId}/categories/{categoryId}")
    public void unassignCategory(@AuthenticationPrincipal AuthenticatedUser user, @PathVariable int productId,
            @PathVariable int categoryId) {
        change(user, "CALL sp_catalogue_unassign_category(?, ?)", productId, categoryId);
    }

    @PostMapping("/categories")
    @ResponseStatus(HttpStatus.CREATED)
    public Map<String, Integer> createCategory(@AuthenticationPrincipal AuthenticatedUser user,
            @Valid @RequestBody CategoryDetails category) {
        String actor = staff(user);
        Integer categoryId = write(() -> actorJdbc.callReturningId(actor,
                "{call sp_catalogue_create_category(?,?,?,?)}", category.name(), category.description(),
                category.parentCategoryId()));
        return Map.of("categoryId", categoryId);
    }

    @PutMapping("/categories/{categoryId}")
    public void updateCategory(@AuthenticationPrincipal AuthenticatedUser user, @PathVariable int categoryId,
            @Valid @RequestBody CategoryDetails category) {
        change(user, "CALL sp_catalogue_update_category(?, ?, ?, ?, ?)", categoryId, category.name(),
                category.description(), category.parentCategoryId(), category.active() ? 1 : 0);
    }

    /** The audit actor for an active warehouse employee or administrator; otherwise 401 or 403. */
    private String staff(AuthenticatedUser user) {
        int employeeId = Access.employee(user);
        if (!auth.employeeHasAnyRole(employeeId, EmployeeRole.WAREHOUSE_STAFF, EmployeeRole.ADMIN)) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN);
        }
        return ActorJdbc.employee(employeeId);
    }

    private void change(AuthenticatedUser user, String sql, Object... arguments) {
        String actor = staff(user);
        write(() -> {
            actorJdbc.call(actor, sql, arguments);
            return null;
        });
    }

    private static <T> T write(Supplier<T> change) {
        try {
            return change.get();
        } catch (DataAccessException exception) {
            throw DatabaseErrors.toHttp(exception);
        }
    }

    public record NewProduct(@NotBlank @Size(max = 50) String sku, @NotBlank @Size(max = 150) String name,
            String description, @Size(max = 500) String imageUrl, @NotNull @Positive Integer categoryId,
            @Positive Integer warehouseId,
            @NotNull @DecimalMin("0.01") @Digits(integer = 8, fraction = 2) BigDecimal price,
            @NotNull @Min(0) Integer stock) {
    }

    public record ProductDetails(@NotBlank @Size(max = 50) String sku, @NotBlank @Size(max = 150) String name,
            String description, @Size(max = 500) String imageUrl) {
    }

    public record CategoryDetails(@NotBlank @Size(max = 100) String name, @Size(max = 500) String description,
            @Positive Integer parentCategoryId, boolean active) {
    }

    public record Active(boolean active) {
    }
}
