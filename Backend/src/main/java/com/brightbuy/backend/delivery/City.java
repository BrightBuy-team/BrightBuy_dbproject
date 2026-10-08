package com.brightbuy.backend.delivery;

import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Table;
import jakarta.persistence.Column;

@Entity
@Table(name = "city")
public class City {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "city_id")
    private Integer cityId;

    @Column(name = "name")
    private String name;

    @Column(name = "is_main_city")
    private Boolean isMainCity;

    // Getters and Setters
    public Integer getCityId() {
        return cityId;
    }

    public void setCityId(Integer cityId) {
        this.cityId = cityId;
    }

    public String getName() {
        return name;
    }

    public void setName(String name) {
        this.name = name;
    }

    public Boolean getIsMainCity() {
        return isMainCity;
    }

    public void setIsMainCity(Boolean isMainCity) {
        this.isMainCity = isMainCity;
    }
}
