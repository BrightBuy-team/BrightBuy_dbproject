package com.brightbuy.backend.inventory;

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
import org.springframework.dao.DataAccessException;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.server.ResponseStatusException;

/** Warehouse console (UI-11): variants, prices, stock and the low-stock list. Staff only (BR-14). */
@RestController
@RequestMapping("/api/inventory")
public class InventoryController {
    private final InventoryRepository repository;
    private final AuthService auth;

    public InventoryController(InventoryRepository repository, AuthService auth) {
        this.repository = repository;
        this.auth = auth;
    }

    @GetMapping("/variants")
    public List<Variant> variants(@AuthenticationPrincipal AuthenticatedUser user) {
        staff(user);
        return repository.allVariants();
    }

    /** Variants whose stock is below the threshold (TBD-5; the caller chooses, default 10). */
    @GetMapping("/low-stock")
    public List<Variant> lowStock(@AuthenticationPrincipal AuthenticatedUser user,
            @RequestParam(defaultValue = "10") int threshold) {
        staff(user);
        if (threshold < 0) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST);
        }
        return repository.variantsBelow(threshold);
    }

    @PostMapping("/variants")
    @ResponseStatus(HttpStatus.CREATED)
    public Variant createVariant(@AuthenticationPrincipal AuthenticatedUser user,
            @Valid @RequestBody NewVariant variant) {
        String actor = staff(user);
        Integer variantId = write(() -> repository.createVariant(actor, variant.productId(),
                variant.warehouseId(), variant.variantName(), variant.colour(), variant.memorySize(),
                variant.price(), variant.stock()));
        return find(variantId);
    }

    @PutMapping("/variants/{variantId}")
    public Variant updateVariant(@AuthenticationPrincipal AuthenticatedUser user, @PathVariable int variantId,
            @Valid @RequestBody VariantDetails variant) {
        String actor = staff(user);
        write(() -> {
            repository.updateVariant(actor, variantId, variant.variantName(), variant.colour(),
                    variant.memorySize(), variant.price());
            return null;
        });
        return find(variantId);
    }

    /** Sets the counted stock. The change is written to the stock audit with this employee (SAF-7). */
    @PutMapping("/variants/{variantId}/stock")
    public Variant setStock(@AuthenticationPrincipal AuthenticatedUser user, @PathVariable int variantId,
            @RequestParam int quantity) {
        String actor = staff(user);
        if (quantity < 0) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST);
        }
        write(() -> {
            repository.setStock(actor, variantId, quantity);
            return null;
        });
        return find(variantId);
    }

    /** The audit actor for an active warehouse employee or administrator; otherwise 401 or 403. */
    private String staff(AuthenticatedUser user) {
        int employeeId = Access.employee(user);
        if (!auth.employeeHasAnyRole(employeeId, EmployeeRole.WAREHOUSE_STAFF, EmployeeRole.ADMIN)) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN);
        }
        return ActorJdbc.employee(employeeId);
    }

    private Variant find(Integer variantId) {
        return repository.variant(variantId == null ? -1 : variantId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND));
    }

    private static <T> T write(java.util.function.Supplier<T> change) {
        try {
            return change.get();
        } catch (DataAccessException exception) {
            throw DatabaseErrors.toHttp(exception);
        }
    }

    public record NewVariant(@NotNull @Positive Integer productId, @Positive Integer warehouseId,
            @NotBlank @Size(max = 100) String variantName, @Size(max = 50) String colour,
            @Size(max = 50) String memorySize,
            @NotNull @DecimalMin("0.01") @Digits(integer = 8, fraction = 2) BigDecimal price,
            @NotNull @Min(0) Integer stock) {
    }

    public record VariantDetails(@NotBlank @Size(max = 100) String variantName, @Size(max = 50) String colour,
            @Size(max = 50) String memorySize,
            @NotNull @DecimalMin("0.01") @Digits(integer = 8, fraction = 2) BigDecimal price) {
    }
}
