# Checkout & Transactions Module - Progress Tracker

## 1. Completed Tasks (Database Tier)
* **Directory Reorganization:** Established a dedicated `Database/Checkout` module directory and enforced sequential script execution.
* **Schema Definition (`01_checkout_schema.sql`):** Created strictly normalized tables for `orders`, `order_item`, `delivery`, and `payment` with enforced foreign key constraints.
* **ACID Business Logic (`02_checkout_procedures.sql`):** Developed the `ProcessCheckout` stored procedure featuring `SELECT ... FOR UPDATE` row-level locking, `JSON_TABLE` cart parsing, and atomic transaction handling (`COMMIT`/`ROLLBACK`).
* **Testing & Validation (`03_checkout_seed_data.sql` & `04_checkout_test.sql`):** Drafted seed data and test execution scripts to verify stock deduction logic and transaction isolation.
* **Version Control:** Staged, committed, and pushed the database tier architecture to the `Induru-dev` branch.

## 2. In Progress / Up Next (Backend Tier)
* **Java Data Transfer Objects (DTOs):** Define `CartItemDTO` and `CheckoutRequestDTO` records in Spring Boot to capture the incoming React JSON payloads.
* **JDBC Repository Layer:** Implement Spring's `JdbcTemplate` and `SimpleJdbcCall` to bridge the Java backend with the MySQL stored procedure, adhering to raw SQL constraints.
* **REST API Controller:** Build the `@PostMapping` endpoint to receive frontend cart data, invoke the JDBC repository, and translate the `p_status` variable into HTTP response codes (e.g., `200 OK` or `409 Conflict`).
