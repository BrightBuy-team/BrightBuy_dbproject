package com.brightbuy.backend.reporting;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.*;

import org.junit.jupiter.api.Test;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.scheduling.annotation.Scheduled;

class SalesSummaryJobTests {
    @Test
    void refreshUsesExistingProcedureAndSevenDayWindow() {
        JdbcTemplate jdbcTemplate = mock(JdbcTemplate.class);
        new SalesSummaryJob(jdbcTemplate).updateYesterdaySummary();
        verify(jdbcTemplate).update("CALL sp_populate_sales_summary(?)", 7);
        verifyNoMoreInteractions(jdbcTemplate);
    }

    @Test
    void dailyScheduleIsUnchanged() throws Exception {
        var schedule = SalesSummaryJob.class.getMethod("updateYesterdaySummary")
                .getAnnotation(Scheduled.class);
        assertThat(schedule.cron()).isEqualTo("0 5 0 * * *");
    }
}
