package com.brightbuy.backend.checkout.controller;
import com.brightbuy.backend.auth.*;
import com.brightbuy.backend.checkout.dto.*;
import com.brightbuy.backend.checkout.repository.CheckoutRepository;
import jakarta.validation.Valid;
import org.springframework.http.*;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;
@RestController @RequestMapping("/api/checkout")
public class CheckoutController {
 private final CheckoutRepository repository;
 public CheckoutController(CheckoutRepository repository){this.repository=repository;}
 @PostMapping
 public ResponseEntity<CheckoutResult> processCheckout(@AuthenticationPrincipal AuthenticatedUser user,
  @Valid @RequestBody CheckoutRequestDto request) {
  var result=repository.checkout(Access.customer(user),request);
  var status=switch(result.status()){
   case "SUCCESS" -> HttpStatus.CREATED;
   case "INSUFFICIENT_STOCK","UNKNOWN_VARIANT_OR_INVALID_PRICE_OR_RETIRED" -> HttpStatus.CONFLICT;
   case "PAYMENT_GATEWAY_UNAVAILABLE" -> HttpStatus.SERVICE_UNAVAILABLE;
   case "SQL_ERROR" -> HttpStatus.INTERNAL_SERVER_ERROR;
   default -> HttpStatus.BAD_REQUEST;
  };
  return ResponseEntity.status(status).body(result);
 }
}
