package com.brightbuy.backend.reporting;

import org.springframework.web.bind.annotation.*;
import java.time.LocalDate;
import java.util.List;

@RestController
@RequestMapping("/api/reports")
public class ReportController {
    private final ReportRepository rService;

    public ReportController(ReportRepository rService) {
        this.rService = rService;
    }

    @GetMapping("/quarterly-sales")
    public List<QuarterlySales> quarterlySales(@RequestParam int year, @RequestParam int employeeId) {
        return rService.getQuarterlySales(year, employeeId);
    }

    @GetMapping("/top-selling-products")
    public List<TopSellingProduct> topSellingProducts(@RequestParam LocalDate startDate, @RequestParam LocalDate endDate,
                                                      @RequestParam(defaultValue = "10") int topN, @RequestParam int employeeId) {
        return rService.getTopSellingProducts(startDate, endDate, topN, employeeId);
    }

    @GetMapping("/category-order-counts")
    public List<CategoryOrderCount> categoryOrderCounts(@RequestParam int employeeId) {
        return rService.getCategoryOrderCounts(employeeId);
    }

    @GetMapping("/delivery-estimates")
    public List<DeliveryTimeEstimate> deliveryEstimates(@RequestParam int employeeId) {
        return rService.getUpcomingDeliveryEstimates(employeeId);
    }

    @GetMapping("/customer-order-summary")
    public List<CustomerWiseOrderSummary> customerOrderSummary(@RequestParam int employeeId) {
        return rService.getCustomerOrderSummary(employeeId);
    }
}