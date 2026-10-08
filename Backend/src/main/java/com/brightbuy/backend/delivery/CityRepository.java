package com.brightbuy.backend.delivery;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

@Repository
public interface CityRepository extends JpaRepository<City, Integer> {
    
    // Spring Boot automatically gives us methods like findAll(), save(), and findById()
    
}
