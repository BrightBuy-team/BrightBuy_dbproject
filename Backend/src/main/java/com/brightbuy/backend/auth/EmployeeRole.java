package com.brightbuy.backend.auth;

public enum EmployeeRole {
    WAREHOUSE_STAFF("WarehouseStaff"),
    MANAGEMENT("Management"),
    DELIVERY_DRIVER("DeliveryDriver"),
    ADMIN("Admin");

    private final String databaseValue;

    EmployeeRole(String databaseValue) {
        this.databaseValue = databaseValue;
    }

    public String databaseValue() {
        return databaseValue;
    }
}