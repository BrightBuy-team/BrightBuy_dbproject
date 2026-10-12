package com.brightbuy.backend.delivery;

import com.brightbuy.backend.auth.AccountType;
import com.brightbuy.backend.auth.AuthService;
import com.brightbuy.backend.auth.AuthenticatedUser;
import com.brightbuy.backend.auth.EmployeeRole;
import java.time.LocalDate;
import java.util.Collections;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.server.ResponseStatusException;

@RestController
@RequestMapping("/api/delivery")
public class DeliveryController {
    private final DeliveryRepository repository;
    private final AuthService auth;

    public DeliveryController(DeliveryRepository repository, AuthService auth) {
        this.repository = repository;
        this.auth = auth;
    }

    /** Public: the delivery cities for the checkout form. */
    @GetMapping("/cities")
    public List<City> cities() {
        return repository.cities();
    }

    /**
     * Public: the estimated delivery date before ordering (UI-8). Pass the cart's variant IDs and,
     * in the same order, the wanted quantities, so that a line with more than is in stock adds its
     * three days. Without quantities each variant counts as one unit.
     */
    @GetMapping("/preview")
    public Map<String, Object> preview(@RequestParam int cityId,
            @RequestParam(required = false) List<Integer> variantIds,
            @RequestParam(required = false) List<Integer> quantities) {
        List<Integer> variants = variantIds == null ? List.of() : variantIds;
        List<Integer> wanted = quantities == null ? Collections.nCopies(variants.size(), 1) : quantities;
        if (variants.size() > 100 || variants.stream().anyMatch(id -> id == null || id < 1)
                || wanted.size() != variants.size()
                || wanted.stream().anyMatch(quantity -> quantity == null || quantity < 1 || quantity > 100000)) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Invalid variants or quantities");
        }
        LocalDate date = repository.previewDate(cityId, variants, wanted)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.BAD_REQUEST, "Unknown city"));
        return Map.of("estimated_delivery_date", date);
    }

    /**
     * The estimate recorded for an order when it was placed. A customer sees only their own
     * orders (SEC-6); staff, management and administrators see any order.
     */
    @GetMapping("/estimate")
    public Map<String, Object> estimate(@AuthenticationPrincipal AuthenticatedUser user,
            @RequestParam int cityId, @RequestParam int orderId) {
        if (user == null) {
            throw new ResponseStatusException(HttpStatus.UNAUTHORIZED);
        }
        if (user.accountType() == AccountType.EMPLOYEE) {
            if (!auth.employeeHasAnyRole(user.id(), EmployeeRole.WAREHOUSE_STAFF, EmployeeRole.MANAGEMENT,
                    EmployeeRole.ADMIN)) {
                throw new ResponseStatusException(HttpStatus.FORBIDDEN);
            }
        } else if (!repository.orderBelongsTo(orderId, user.id())) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Order not found");
        }
        Map<String, Object> delivery = repository.deliveryOf(orderId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND));
        if ("delivery".equals(delivery.get("delivery_mode")) && !Objects.equals(delivery.get("city_id"), cityId)) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Destination differs from this order");
        }
        return delivery;
    }
}
