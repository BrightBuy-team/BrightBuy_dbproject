package com.brightbuy.backend.checkout.controller;

import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import com.brightbuy.backend.checkout.dto.CheckoutRequestDto;
import com.brightbuy.backend.checkout.repository.CheckoutRepository;

import org.springframework.security.core.annotation.AuthenticationPrincipal;
import com.brightbuy.backend.auth.AuthenticatedUser;
import org.springframework.web.server.ResponseStatusException;

@RestController
//HTTP request mapping for the checkout process
@RequestMapping("/api/checkout")//Endpoint for the checkout process
public class CheckoutController {

    private final CheckoutRepository checkoutRepository;

    public CheckoutController(CheckoutRepository checkoutRepository) {
        this.checkoutRepository = checkoutRepository;
    }
    //HTTP POST endpoint to process the checkout request
    @PostMapping
    public ResponseEntity<String> processCheckout(@AuthenticationPrincipal AuthenticatedUser user, @RequestBody CheckoutRequestDto request) {
        if (user == null || user.id() == null) {
            throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Not authenticated");
        }
        String dbStatus = checkoutRepository.callProcessCheckout(
                user.id(), 
                request.cartItems(),
                request.deliveryMode(),
                request.paymentMethod()
        );

        return switch (dbStatus) {
            case "SUCCESS" -> ResponseEntity.ok("Checkout completed successfully.");
            case "INSUFFICIENT_STOCK" -> ResponseEntity.status(HttpStatus.CONFLICT)
                    .body("Checkout failed: Insufficient stock for one or more items.");
            case "SQL_ERROR" -> ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body("Checkout failed: An internal database error occurred.");
            default -> ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body("Checkout failed: Unknown status returned.");
        };
    }
}