package com.brightbuy.backend.checkout.dto;
import java.util.List;
import jakarta.validation.Valid;
import jakarta.validation.constraints.*;
public record CheckoutRequestDto(@NotEmpty @Size(max=100) List<@Valid CartItemDto> cartItems,
 @NotNull @Pattern(regexp="delivery|pickup") String deliveryMode,
 @NotNull @Pattern(regexp="cod|card") String paymentMethod,
 @Positive Integer cityId,@Size(max=255) String addressLine) {
 public CheckoutRequestDto(List<CartItemDto> items,String delivery,String payment) {
  this(items,delivery,payment,null,null);
 }
}
