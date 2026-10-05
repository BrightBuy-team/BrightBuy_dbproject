package com.brightbuy.backend.reporting;

import org.springframework.jdbc.core.DataClassRowMapper;
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
    private static final String RESULT_SET = "#resultSet1";

    public ReportRepository(JdbcTemplate jdbcTemplate) {
        this.quarterlySalesCall = new SimpleJdbcCall(jdbcTemplate).withProcedureName("get_quarterly_sales_report")
                                                                  .returningResultSet(RESULT_SET,
                                                                                       DataClassRowMapper.newInstance(QuarterlySales.class));

        this.topSellingProductsCall = new SimpleJdbcCall(jdbcTemplate).withProcedureName("get_top_selling_products")
                                                                      .returningResultSet(RESULT_SET,
                                                                      DataClassRowMapper.newInstance(TopSellingProduct.class));

        this.categoryOrderCountsCall = new SimpleJdbcCall(jdbcTemplate).withProcedureName("get_category_order_counts")
                                                                       .returningResultSet(RESULT_SET,
                                                                       DataClassRowMapper.newInstance(CategoryOrderCount.class));

        this.deliveryEstimatesCall = new SimpleJdbcCall(jdbcTemplate).withProcedureName("get_upcoming_delivery_estimates")
                                                                     .returningResultSet(RESULT_SET,
                                                                     DataClassRowMapper.newInstance(DeliveryTimeEstimate.class));

        this.customerOrderSummaryCall = new SimpleJdbcCall(jdbcTemplate).withProcedureName("get_customer_order_summary")
                                                                        .returningResultSet(RESULT_SET,
                                                                        DataClassRowMapper.newInstance(CustomerWiseOrderSummary.class));
    }

    @SuppressWarnings("unchecked")
    public List<QuarterlySales> getQuarterlySales(int year, int employeeId){
        var para = new MapSqlParameterSource().addValue("p_year", year)
                                              .addValue("p_employee_id", employeeId);
        Map<String, Object> result = quarterlySalesCall.execute(para);
        return (List<QuarterlySales>) result.get(RESULT_SET);
    }

    @SuppressWarnings("unchecked")
    public List<TopSellingProduct> getTopSellingProducts(LocalDate startDate, LocalDate endDate, int topN, int employeeId){
        var para = new MapSqlParameterSource().addValue("p_start_date", startDate)
                                              .addValue("p_end_date", endDate)
                                              .addValue("p_top_n", topN)
                                              .addValue("p_employee_id", employeeId);
        Map<String, Object> result = topSellingProductsCall.execute(para);
        return (List<TopSellingProduct>) result.get(RESULT_SET);
    }

    @SuppressWarnings("unchecked")
    public List<CategoryOrderCount> getCategoryOrderCounts(int employeeId){
        var para = new MapSqlParameterSource().addValue("p_employee_id", employeeId);
        Map<String, Object> result = categoryOrderCountsCall.execute(para);
        return (List<CategoryOrderCount>) result.get(RESULT_SET);
    }

    @SuppressWarnings("unchecked")
    public List<DeliveryTimeEstimate> getUpcomingDeliveryEstimates(int employeeId){
        var para = new MapSqlParameterSource().addValue("p_employee_id", employeeId);
        Map<String, Object> result = deliveryEstimatesCall.execute(para);
        return (List<DeliveryTimeEstimate>) result.get(RESULT_SET);
    }

    @SuppressWarnings("unchecked")
    public List<CustomerWiseOrderSummary> getCustomerOrderSummary(int employeeId){
        var para = new MapSqlParameterSource().addValue("p_employee_id", employeeId);
        Map<String, Object> result = customerOrderSummaryCall.execute(para);
        return (List<CustomerWiseOrderSummary>) result.get(RESULT_SET);
    }
}
