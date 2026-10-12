-- =========================================================
-- BrightBuy | Management Reporting | 02 Procedures
-- Module owner: Senadheera S.D.A.P
-- Run after Reporting/01 and the Checkout, Catalogue and Auth tables.
-- Safe to reinstall: replaces six routines, changes no rows.
--
-- The five mandatory reports (SRS 4.7). Each one records the employee who
-- ran it in report_access_log and reads live, non-cancelled order history,
-- so today's orders are included and totals reconcile with the order tables.
-- =========================================================
USE brightbuy;
DROP PROCEDURE IF EXISTS sp_populate_sales_summary;
DROP PROCEDURE IF EXISTS get_quarterly_sales_report;
DROP PROCEDURE IF EXISTS get_top_selling_products;
DROP PROCEDURE IF EXISTS get_category_order_counts;
DROP PROCEDURE IF EXISTS get_upcoming_delivery_estimates;
DROP PROCEDURE IF EXISTS get_customer_order_summary;
DELIMITER //

-- inserting values to sales_summary table

CREATE PROCEDURE sp_populate_sales_summary(IN p_days_back INT)
BEGIN
    DECLARE EXIT HANDLER FOR SQLEXCEPTION
    BEGIN
        ROLLBACK;
        RESIGNAL;
    END;

    IF p_days_back IS NULL OR p_days_back < 1 THEN
        SIGNAL SQLSTATE '45000'
            SET MESSAGE_TEXT = 'p_days_back must be a positive number';
    END IF;

    START TRANSACTION;

    -- Rebuild the window so cancellations and edits cannot leave stale totals.
    DELETE FROM sales_summary
    WHERE summary_date >= CURDATE() - INTERVAL p_days_back DAY
      AND summary_date < CURDATE();

    INSERT INTO sales_summary(variant_id, summary_date, units_sold, total_revenue, order_count)
    SELECT
        oi.variant_id,
        DATE(o.order_date) AS summary_date,
        SUM(oi.quantity) AS units_sold,
        SUM(oi.quantity * oi.unit_price) AS total_revenue,
        COUNT(DISTINCT o.order_id)
    FROM order_item oi
    JOIN orders o ON o.order_id = oi.order_id
    WHERE o.order_date >= CURDATE() - INTERVAL p_days_back DAY
      AND o.order_date < CURDATE()
      AND o.order_status NOT IN ('Cancelled')
    GROUP BY oi.variant_id, DATE(o.order_date)
    ON DUPLICATE KEY UPDATE
        units_sold = VALUES(units_sold),
        total_revenue = VALUES(total_revenue),
        order_count = VALUES(order_count);

    COMMIT;
END//

-- Quarterly sales report

CREATE PROCEDURE get_quarterly_sales_report(IN p_year INT, IN p_employee_id INT)
Begin
    INSERT INTO report_access_log(employee_id, report_name)
	VALUES(p_employee_id, 'quarterly_sales_report');

    -- Live history avoids mismatching today's order count with yesterday's summary.
    SELECT QUARTER(o.order_date) AS quarter,COUNT(*) AS order_count,
           SUM(o.total_amount) AS total_revenue
    FROM orders o
    WHERE o.order_date>=MAKEDATE(p_year,1) AND o.order_date<MAKEDATE(p_year+1,1)
      AND o.order_status<>'Cancelled'
    GROUP BY QUARTER(o.order_date) ORDER BY quarter;
END//

-- Top selling products report

CREATE PROCEDURE get_top_selling_products(
	IN p_start_date DATE,
	IN p_end_date DATE,
	IN p_top_n INT,
	IN p_employee_id INT
)
BEGIN
	INSERT INTO report_access_log(employee_id, report_name)
	VALUES (p_employee_id, 'top_selling_products_report');

    SELECT p.product_id,p.name,SUM(oi.quantity) AS units_sold,
           SUM(oi.quantity*oi.unit_price) AS revenue
    FROM orders o JOIN order_item oi ON oi.order_id=o.order_id
    JOIN variant v ON v.variant_id=oi.variant_id JOIN product p ON p.product_id=v.product_id
    WHERE o.order_date>=p_start_date AND o.order_date<DATE_ADD(p_end_date,INTERVAL 1 DAY)
      AND o.order_status<>'Cancelled'
    GROUP BY p.product_id,p.name ORDER BY units_sold DESC,p.product_id LIMIT p_top_n;
END//

-- Category-wise total number of orders

CREATE PROCEDURE get_category_order_counts(IN p_employee_id INT)

BEGIN
	INSERT INTO report_access_log(employee_id, report_name)
	VALUES (p_employee_id, 'category_order_count_report');

	SELECT 
		c.category_id,
		c.name,
		COUNT(DISTINCT o.order_id) AS total_orders
	FROM order_item oi
	JOIN orders o ON o.order_id = oi.order_id
	JOIN variant v ON v.variant_id = oi.variant_id
	JOIN product_category pc ON pc.product_id = v.product_id
	JOIN category c ON c.category_id = pc.category_id
	WHERE o.order_status NOT IN ('Cancelled')
	GROUP BY c.category_id, c.name
	ORDER BY total_orders DESC;
END//

-- Delivery time estimatess for upcoming orders

CREATE PROCEDURE get_upcoming_delivery_estimates(IN p_employee_id INT)
BEGIN
    INSERT INTO report_access_log(employee_id, report_name)
    VALUES (p_employee_id, 'delivery_estimates_report');

	SELECT
		o.order_id, 
		cu.first_name, 
		cu.last_name,
		d.delivery_mode,
		ci.name AS destination_city,
		d.est_delivery_date,
		d.delivery_status
	FROM delivery d
	JOIN orders o ON o.order_id = d.order_id
	JOIN customer cu ON cu.customer_id = o.customer_id
	LEFT JOIN city ci ON ci.city_id = d.city_id
	WHERE d.delivery_status NOT IN ('Delivered','Cancelled') AND o.order_status<>'Cancelled'
	ORDER BY d.est_delivery_date;
END//

-- Customer-wise order summary with payment status

CREATE PROCEDURE get_customer_order_summary(IN p_employee_id INT)
BEGIN
    INSERT INTO report_access_log(employee_id, report_name)
    VALUES (p_employee_id, 'customer_order_summary_report');

	SELECT
		cu.customer_id,
		cu.first_name,
		cu.last_name,
		COALESCE(os.lifetime_spend, 0) AS lifetime_spend,
		ps.payment_statuses
	FROM customer cu
	LEFT JOIN (
		SELECT
			customer_id,
			SUM(total_amount) AS lifetime_spend
		FROM orders WHERE order_status<>'Cancelled'
		GROUP BY customer_id
	) AS os 
	ON os.customer_id = cu.customer_id
	LEFT JOIN (
		SELECT
			o.customer_id,
			GROUP_CONCAT(DISTINCT p.payment_status) AS payment_statuses
		FROM orders o
		LEFT JOIN payment p ON p.order_id = o.order_id
        WHERE o.order_status<>'Cancelled'
		GROUP BY o.customer_id
	) AS ps
	ON ps.customer_id = cu.customer_id
	ORDER BY os.lifetime_spend DESC, cu.customer_id;
END//

DELIMITER ;
