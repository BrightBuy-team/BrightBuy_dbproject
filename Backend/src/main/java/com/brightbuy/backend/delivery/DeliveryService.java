package com.brightbuy.backend.delivery;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;

import java.time.LocalDate;
import java.util.List;

@Service
public class DeliveryService {

    @Autowired
    private DeliveryRepository deliveryRepository;

    @Autowired
    private CityRepository cityRepository;

    // Get all cities for the frontend dropdown menu
    public List<City> getAllCities() {
        return cityRepository.findAll();
    }

    // Calculates the delivery date using your SQL logic
    public LocalDate getEstimatedDeliveryDate(Integer cityId, Integer orderId) {
        return deliveryRepository.calculateDeliveryDate(cityId, orderId);
    }
}
