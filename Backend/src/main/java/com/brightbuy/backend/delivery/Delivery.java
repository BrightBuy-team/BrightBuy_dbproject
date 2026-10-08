package com.brightbuy.backend.delivery;

import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Table;
import jakarta.persistence.Column;
import java.time.LocalDate;

@Entity
@Table(name = "delivery")
public class Delivery {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "delivery_id")
    private Integer deliveryId;

    // Foreign Key linking to Adeesha's Orders table
    @Column(name = "order_id")
    private Integer orderId;

    // Foreign Key linking to your City table
    @Column(name = "city_id")
    private Integer cityId;

    @Column(name = "delivery_mode")
    private String deliveryMode;

    @Column(name = "est_delivery_date")
    private LocalDate estDeliveryDate;

    @Column(name = "delivery_status")
    private String deliveryStatus;

    // Getters and Setters
    public Integer getDeliveryId() { return deliveryId; }
    public void setDeliveryId(Integer deliveryId) { this.deliveryId = deliveryId; }

    public Integer getOrderId() { return orderId; }
    public void setOrderId(Integer orderId) { this.orderId = orderId; }

    public Integer getCityId() { return cityId; }
    public void setCityId(Integer cityId) { this.cityId = cityId; }

    public String getDeliveryMode() { return deliveryMode; }
    public void setDeliveryMode(String deliveryMode) { this.deliveryMode = deliveryMode; }

    public LocalDate getEstDeliveryDate() { return estDeliveryDate; }
    public void setEstDeliveryDate(LocalDate estDeliveryDate) { this.estDeliveryDate = estDeliveryDate; }

    public String getDeliveryStatus() { return deliveryStatus; }
    public void setDeliveryStatus(String deliveryStatus) { this.deliveryStatus = deliveryStatus; }
}
