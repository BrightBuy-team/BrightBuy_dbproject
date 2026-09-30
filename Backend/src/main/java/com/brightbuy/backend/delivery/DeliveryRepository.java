package com.brightbuy.backend.delivery;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.time.LocalDate;

@Repository
public interface DeliveryRepository extends JpaRepository<Delivery, Integer> {

    // This directly calls the amazing SQL function you wrote!
    @Query(value = "SELECT calculate_delivery_date(:cityId, :orderId)", nativeQuery = true)
    LocalDate calculateDeliveryDate(@Param("cityId") Integer cityId, @Param("orderId") Integer orderId);

}
