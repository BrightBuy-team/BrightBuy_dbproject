-- =========================================================
-- BrightBuy | Management Reporting | 01 Tables
-- Module owner: Senadheera S.D.A.P
-- Tables: sales_summary, report_access_log
-- Run after Inventory/01 (variant) and Auth/01 (employee).
-- Safe to rerun: existing tables are kept.
-- =========================================================
USE brightbuy;

-- Daily sales per variant, rebuilt by sp_populate_sales_summary. This is a
-- deliberate denormalisation (DB-1): totals that can always be recomputed
-- from orders and order_item are kept for fast historical analysis. The five
-- live reports read the order tables directly, so they never depend on it.
CREATE TABLE IF NOT EXISTS sales_summary (
    summary_id    INT PRIMARY KEY AUTO_INCREMENT,
    variant_id    INT NOT NULL,
    summary_date  DATE NOT NULL,
    units_sold    INT NOT NULL DEFAULT 0,
    total_revenue DECIMAL(12,2) NOT NULL DEFAULT 0,
    order_count   INT NOT NULL DEFAULT 0,
    FOREIGN KEY (variant_id) REFERENCES variant(variant_id),
    UNIQUE KEY uq_variant_date (variant_id, summary_date),
    INDEX idx_summary_date (summary_date)
) ENGINE=InnoDB;

-- Who ran which report, and when (SEC-11).
CREATE TABLE IF NOT EXISTS report_access_log (
    log_id      INT PRIMARY KEY AUTO_INCREMENT,
    employee_id INT NOT NULL,
    report_name VARCHAR(100) NOT NULL,
    accessed_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (employee_id) REFERENCES employee(employee_id),
    INDEX idx_accesslog_employee (employee_id)
) ENGINE=InnoDB;
