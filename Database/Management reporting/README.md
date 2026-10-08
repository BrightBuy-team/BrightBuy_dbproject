# BrightBuy Management Reporting Database Module

## Owner

Adeesha Senadheera

## Purpose

Implements the database layer for BrightBuy's 5 mandatory management reports,
 - Quarterly sales report
 - Top selling products report
 - Category-wise total number of orders
 - Delivery time estimates for upcoming orders
 - Customer-wise order summary with payment status

## Tables Owned

 - `sales_summary`
 - `report_access_log`

## Dependencies on other modules

         Table            |     Owned by     |                    Used by
--------------------------------------------------------------------------------------------------
        variant           |    Catalogue     |       sales_summary, Top selling products
        product           |    Catalogue     |               Top selling product
 product_category,category|    Catalogue     |       Categor-wise total number of orders
        employee          |     User/Auth    |                report_access_log
    orders, order_item    |     Checkout    |  sales_summary,Category-wise total number of orders
        customer          |                  |    Customer-wise order summary with payment status
        payment           |                  |    Customer-wise order summary with payment status
     delivery, city       | Inventory/Checkout |   Delivery time estimates


## Refresh schedule

 - The Spring backend calls `sp_populate_sales_summary(7)` daily at 00:05 using `SalesSummaryJob`.
 - The procedure rebuilds the previous seven days, excluding the current date, so recent cancellations and order edits do not leave stale totals.
 - A fresh install only gets seven days of summary data from the scheduled job. Backfill older dates with a wider window, for example `CALL sp_populate_sales_summary(365)`, before using quarterly or top-selling reports for older dates.
 - The database must be available and the application database user must be allowed to execute the procedure.

## Assumptions
 - sales_summary.order_count counts distinct orders per variant/day, not order lines.
 - Category-wise order counts and delivery estimates read live from orders,order_item,delivery rather than from sales_summary, since they need current status, not a historical rollup.
 - `get_customer_order_summary` includes all orders regardless of payment status.
 - Cancelled orders are excluded from sales_summary and category order counts matching the reports' intent to reflect real sales activity.
