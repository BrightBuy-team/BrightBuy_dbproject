package com.brightbuy.backend.reporting;

import org.springframework.jdbc.core.BeanPropertyRowMapper;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.core.simple.SimpleJdbcCall;
import org.springframework.jdbc.core.namedparam.MapSqlParameterSource;
import org.springframework.stereotype.Repository;

import java.time.LocalDate;
import java.util.List;
import java.util.Map;

@Repository
public class ReportRepository {
    private final SimpleJdbcCall quarterlySalesCall;
    private final SimpleJdbcCall topSellingProductsCall;
    private final SimpleJdbcCall categoryOrderCountsCall;
    private final SimpleJdbcCall deliveryEstimatesCall;
    private final SimpleJdbcCall customerOrderSummaryCall;

    public ReportRepository(JdbcTemplate jdbcTemplate) {
        this.quarterlySalesCall = new SimpleJdbcCall(jdbcTemplate).withProcedureName("get_quarterly_sales_report")
                                                                  .returningResultSet("#resultSet1",
                                                                                       BeanPropertyRowMapper.newInstance(QuarterlySales.class));

        this.topSellingProductsCall = new SimpleJdbcCall(jdbcTemplate).withProcedureName("get_top_selling_products")
                                                                      .returningResultSet("#resultSet1",
                                                                                           BeanPropertyRowMapper.newInstance(TopSellingProduct.class));

        this.categoryOrderCountsCall = new SimpleJdbcCall(jdbcTemplate).withProcedureName("get_category_order_counts")
                                                                       .returningResultSet("#resultSet1",
                                                                                            BeanPropertyRowMapper.newInstance(CategoryOrderCount.class));

        this.deliveryEstimatesCall = new SimpleJdbcCall(jdbcTemplate).withProcedureName("get_upcoming_delivery_estimates")
                                                                     .returningResultSet("#resultSet1",
                                                                                          BeanPropertyRowMapper.newInstance(DeliveryTimeEstimate.class));

        this.customerOrderSummaryCall = new SimpleJdbcCall(jdbcTemplate).withProcedureName("get_customer_order_summary")
                                                                        .returningResultSet("#resultSet1",
                                                                                             BeanPropertyRowMapper.newInstance(CustomerWiseOrderSummary.class));
    }

    @SuppressWarnings("unchecked")
    public List<QuarterlySales> getQuarterlySales(int year, int employeeId){
        var para = new MapSqlParameterSource().addValue("p_year", year)
                                              .addValue("p_employee_id", employeeId);
        Map<String, Object> result = quarterlySalesCall.execute(para);
        return (List<QuarterlySales>) result.get("#resultSet1");
    }

    @SuppressWarnings("unchecked")
    public List<TopSellingProduct> getTopSellingProducts(LocalDate startDate, LocalDate endDate, int topN, int employeeId){
        var para = new MapSqlParameterSource().addValue("p_start_date", startDate)
                                              .addValue("p_end_date", endDate)
                                              .addValue("p_top_n", topN)
                                              .addValue("p_employee_id", employeeId);
        Map<String, Object> result = topSellingProductsCall.execute(para);
        return (List<TopSellingProduct>) result.get("#resultSet1");
    }

    @SuppressWarnings("unchecked")
    public List<CategoryOrderCount> getCategoryOrderCounts(int employeeId){
        var para = new MapSqlParameterSource().addValue("p_employee_id", employeeId);
        Map<String, Object> result = categoryOrderCountsCall.execute(para);
        return (List<CategoryOrderCount>) result.get("#resultSet1");
    }

    @SuppressWarnings("unchecked")
    public List<DeliveryTimeEstimate> getUpcomingDeliveryEstimates(int employeeId){
        var para = new MapSqlParameterSource().addValue("p_employee_id", employeeId);
        Map<String, Object> result = deliveryEstimatesCall.execute(para);
        return (List<DeliveryTimeEstimate>) result.get("#resultSet1");
    }

    @SuppressWarnings("unchecked")
    public List<CustomerWiseOrderSummary> getCustomerOrderSummary(int employeeId){
        var para = new MapSqlParameterSource().addValue("p_employee_id", employeeId);
        Map<String, Object> result = customerOrderSummaryCall.execute(para);
        return (List<CustomerWiseOrderSummary>) result.get("#resultSet1");
    }
}