package com.brightbuy.backend.reporting;

import java.time.LocalDate;
import java.util.List;
import org.springframework.stereotype.Service;

/** Connects the existing report controller to its procedure-backed repository. */
@Service
public class ReportService {
    private final ReportRepository repository;

    public ReportService(ReportRepository repository) {
        this.repository = repository;
    }

    public List<QuarterlySales> getQuarterlySales(int year, int employeeId) {
        return repository.getQuarterlySales(year, employeeId);
    }

    public List<TopSellingProduct> getTopSellingProducts(LocalDate startDate, LocalDate endDate,
            int topN, int employeeId) {
        return repository.getTopSellingProducts(startDate, endDate, topN, employeeId);
    }

    public List<CategoryOrderCount> getCategoryOrderCounts(int employeeId) {
        return repository.getCategoryOrderCounts(employeeId);
    }

    public List<DeliveryTimeEstimate> getUpcomingDeliveryEstimates(int employeeId) {
        return repository.getUpcomingDeliveryEstimates(employeeId);
    }

    public List<CustomerWiseOrderSummary> getCustomerOrderSummary(int employeeId) {
        return repository.getCustomerOrderSummary(employeeId);
    }
}
