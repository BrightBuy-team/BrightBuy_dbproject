package com.brightbuy.backend.checkout.controller;

import com.brightbuy.backend.auth.AuthenticatedUser;
import com.brightbuy.backend.checkout.dto.OrderHistoryDto;
import com.brightbuy.backend.checkout.repository.OrderHistoryRepository;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.server.ResponseStatusException;

import java.util.List;

@RestController
@RequestMapping("/api/orders")
public class OrderHistoryController {
    
    private final OrderHistoryRepository orderHistoryRepository;
    
    public OrderHistoryController(OrderHistoryRepository orderHistoryRepository) {
        this.orderHistoryRepository = orderHistoryRepository;
    }
    
    @GetMapping
    public List<OrderHistoryDto> getOrderHistory(@AuthenticationPrincipal AuthenticatedUser user) {
        if (user == null || user.id() == null) {
            throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "User must be authenticated to view orders");
        }
        return orderHistoryRepository.getCustomerOrders(user.id());
    }
}

