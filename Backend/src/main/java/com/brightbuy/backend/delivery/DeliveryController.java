package com.brightbuy.backend.delivery;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDate;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/delivery")
@CrossOrigin(origins = "*")
public class DeliveryController {

    @Autowired
    private DeliveryService deliveryService;

    // GET /api/delivery/cities
    // Frontend needs this to show a dropdown list of cities to the customer!
    @GetMapping("/cities")
    public ResponseEntity<List<City>> getAllCities() {
        return ResponseEntity.ok(deliveryService.getAllCities());
    }

    // GET /api/delivery/estimate?cityId=1&orderId=101
    // Your React Frontend Checkout page will call this to display the delivery
    // date!
    @GetMapping("/estimate")
    public ResponseEntity<Map<String, Object>> estimateDelivery(
            @RequestParam Integer cityId,
            @RequestParam Integer orderId) {

        try {
            LocalDate estimatedDate = deliveryService.getEstimatedDeliveryDate(cityId, orderId);

            // We wrap it in a JSON object so React can easily read it
            Map<String, Object> response = new HashMap<>();
            response.put("estimated_delivery_date", estimatedDate);

            return ResponseEntity.ok(response);

        } catch (Exception e) {
            return ResponseEntity.badRequest().build();
        }
    }
}
