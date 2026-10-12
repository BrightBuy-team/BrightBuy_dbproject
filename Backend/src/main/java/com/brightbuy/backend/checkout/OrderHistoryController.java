package com.brightbuy.backend.checkout;

import com.brightbuy.backend.auth.Access;
import com.brightbuy.backend.auth.AuthenticatedUser;
import java.util.List;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/orders")
public class OrderHistoryController {
    private final OrderHistoryRepository repository;

    public OrderHistoryController(OrderHistoryRepository repository) {
        this.repository = repository;
    }

    /** The signed-in customer's own orders; the customer ID never comes from the request. */
    @GetMapping
    public List<OrderSummary> myOrders(@AuthenticationPrincipal AuthenticatedUser user) {
        return repository.ordersOf(Access.customer(user));
    }
}
