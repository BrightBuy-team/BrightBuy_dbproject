package com.brightbuy.backend.reporting;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.Mockito.*;

import java.time.LocalDate;
import java.util.List;
import org.junit.jupiter.api.Test;
import org.springframework.dao.DataAccessResourceFailureException;

class ReportServiceTests {
    private final ReportRepository repository = mock(ReportRepository.class);
    private final ReportService service = new ReportService(repository);

    @Test
    void quarterlySalesPreservesYearAndEmployee() {
        List<QuarterlySales> rows = List.of();
        when(repository.getQuarterlySales(2026, 7)).thenReturn(rows);
        assertThat(service.getQuarterlySales(2026, 7)).isSameAs(rows);
        verify(repository).getQuarterlySales(2026, 7);
        verifyNoMoreInteractions(repository);
    }

    @Test
    void topSellingPreservesDateRangeLimitAndEmployee() {
        LocalDate start = LocalDate.of(2026, 9, 1);
        LocalDate end = LocalDate.of(2026, 9, 30);
        List<TopSellingProduct> rows = List.of();
        when(repository.getTopSellingProducts(start, end, 10, 7)).thenReturn(rows);
        assertThat(service.getTopSellingProducts(start, end, 10, 7)).isSameAs(rows);
        verify(repository).getTopSellingProducts(start, end, 10, 7);
        verifyNoMoreInteractions(repository);
    }

    @Test
    void categoryCountsPreserveEmployee() {
        List<CategoryOrderCount> rows = List.of();
        when(repository.getCategoryOrderCounts(7)).thenReturn(rows);
        assertThat(service.getCategoryOrderCounts(7)).isSameAs(rows);
        verify(repository).getCategoryOrderCounts(7);
        verifyNoMoreInteractions(repository);
    }

    @Test
    void deliveryEstimatesPreserveEmployee() {
        List<DeliveryTimeEstimate> rows = List.of();
        when(repository.getUpcomingDeliveryEstimates(7)).thenReturn(rows);
        assertThat(service.getUpcomingDeliveryEstimates(7)).isSameAs(rows);
        verify(repository).getUpcomingDeliveryEstimates(7);
        verifyNoMoreInteractions(repository);
    }

    @Test
    void customerSummaryPreservesEmployee() {
        List<CustomerWiseOrderSummary> rows = List.of();
        when(repository.getCustomerOrderSummary(7)).thenReturn(rows);
        assertThat(service.getCustomerOrderSummary(7)).isSameAs(rows);
        verify(repository).getCustomerOrderSummary(7);
        verifyNoMoreInteractions(repository);
    }

    @Test
    void repositoryFailureIsNotDisguisedAsAnEmptyReport() {
        var failure = new DataAccessResourceFailureException("Database unavailable");
        when(repository.getCategoryOrderCounts(7)).thenThrow(failure);
        assertThatThrownBy(() -> service.getCategoryOrderCounts(7)).isSameAs(failure);
    }
}
