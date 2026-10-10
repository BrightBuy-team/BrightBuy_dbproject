package com.brightbuy.backend.auth;

import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.validation.annotation.Validated;
import org.springframework.web.bind.annotation.*;

import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

/** A signed-in customer's own default delivery address (BR-16). */
@Validated
@RestController
@RequestMapping("/api/addresses/me")
public class AddressController {

    private final AddressRepository addressRepository;

    public AddressController(AddressRepository addressRepository) {
        this.addressRepository = addressRepository;
    }

    @GetMapping
    public AddressResponse getMyAddress(@AuthenticationPrincipal AuthenticatedUser user) {
        return addressRepository.getAddress(Access.customer(user));
    }

    @PutMapping
    public void updateMyAddress(@AuthenticationPrincipal AuthenticatedUser user,
            @Valid @RequestBody AddressRequest request) {
        addressRepository.updateAddress(Access.customer(user), request.addressLine(), request.cityId());
    }

    public record AddressRequest(
            @NotBlank @Size(max = 255) String addressLine,
            @NotNull Integer cityId
    ) {}

    public record AddressResponse(
            String addressLine,
            Integer cityId,
            String cityName 
    ) {}
}
