package com.brightbuy.backend.checkout;

import com.brightbuy.backend.auth.Access;
import com.brightbuy.backend.auth.AuthenticatedUser;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/checkout")
public class CheckoutController {
    private final CheckoutService service;

    public CheckoutController(CheckoutService service) {
        this.service = service;
    }

    /**
     * Places an order for the signed-in customer (BR-1). The answer always carries a status:
     * 201 SUCCESS, 409 for an item that is no longer sold or a changed price, 402 when the card is declined, 503 when
     * card payments are switched off, 400 for anything invalid in the request.
     */
    @PostMapping
    public ResponseEntity<CheckoutResult> placeOrder(@AuthenticationPrincipal AuthenticatedUser user,
            @Valid @RequestBody CheckoutRequest request) {
        CheckoutResult result = service.checkout(Access.customer(user), request);
        HttpStatus status = switch (result.status()) {
            case "SUCCESS" -> HttpStatus.CREATED;
            case "ITEM_UNAVAILABLE", "AUTHORISED_AMOUNT_MISMATCH" -> HttpStatus.CONFLICT;
            case "CARD_DECLINED" -> HttpStatus.PAYMENT_REQUIRED;
            case "PAYMENT_GATEWAY_UNAVAILABLE" -> HttpStatus.SERVICE_UNAVAILABLE;
            case "SQL_ERROR" -> HttpStatus.INTERNAL_SERVER_ERROR;
            default -> HttpStatus.BAD_REQUEST;
        };
        return ResponseEntity.status(status).body(result);
    }
}
