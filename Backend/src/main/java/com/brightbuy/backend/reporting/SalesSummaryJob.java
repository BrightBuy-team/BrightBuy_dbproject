package com.brightbuy.backend.reporting;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

@Component
public class SalesSummaryJob {
    private static final Logger log = LoggerFactory.getLogger(SalesSummaryJob.class);

    private final JdbcTemplate jdbcTemplate;

    public SalesSummaryJob(JdbcTemplate jdbcTemplate) {
        this.jdbcTemplate = jdbcTemplate;
    }

    @Scheduled(cron = "0 5 0 * * *")
    public void updateYesterdaySummary() {
        log.info("Running sp_populate_sales_summary for the previous 7 days...");
        jdbcTemplate.update("CALL sp_populate_sales_summary(?)", 7);
        log.info("sp_populate_sales_summary completed.");
    }
}
