package com.brightbuy.backend.inventory;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;
import java.util.List;

@Repository
public interface VariantRepository extends JpaRepository<Variant, Integer> {

    // Custom method to find low stock items
    List<Variant> findByStockQuantityLessThan(Integer quantity);

}
