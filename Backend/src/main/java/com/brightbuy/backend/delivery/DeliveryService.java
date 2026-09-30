package com.brightbuy.backend.delivery;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;

import java.time.LocalDate;

@Service
public class DeliveryService {

    @Autowired
    private DeliveryRepository deliveryRepository;

    // Calculates the delivery date using your SQL logic
    public LocalDate getEstimatedDeliveryDate(Integer cityId, Integer orderId) {
        return deliveryRepository.calculateDeliveryDate(cityId, orderId);
    }
}
