package com.brightbuy.backend.reporting;

import org.springframework.web.bind.annotation.*;
import java.time.LocalDate;
import java.util.List;

@RestController
@RequestMapping("/api/reports")
public class ReportController {
    private final ReportRepository rService;
    private final com.brightbuy.backend.auth.AuthService auth;

    public ReportController(ReportRepository rService, com.brightbuy.backend.auth.AuthService auth) {
        this.auth=auth;
        this.rService = rService;
    }

    private int manager(com.brightbuy.backend.auth.AuthenticatedUser user) {
        int id=com.brightbuy.backend.auth.Access.employee(user);
        if(!auth.employeeHasRole(id,com.brightbuy.backend.auth.EmployeeRole.MANAGEMENT))
            throw new org.springframework.web.server.ResponseStatusException(org.springframework.http.HttpStatus.FORBIDDEN);
        return id;
    }
    @GetMapping("/quarterly-sales")
    public List<QuarterlySales> quarterlySales(@RequestParam int year, @org.springframework.security.core.annotation.AuthenticationPrincipal com.brightbuy.backend.auth.AuthenticatedUser user) {
        return rService.getQuarterlySales(year, manager(user));
    }

    @GetMapping("/top-selling-products")
    public List<TopSellingProduct> topSellingProducts(@RequestParam LocalDate startDate, @RequestParam LocalDate endDate,
                                                      @RequestParam(defaultValue = "10") int topN, @org.springframework.security.core.annotation.AuthenticationPrincipal com.brightbuy.backend.auth.AuthenticatedUser user) {
        return rService.getTopSellingProducts(startDate, endDate, topN, manager(user));
    }

    @GetMapping("/category-order-counts")
    public List<CategoryOrderCount> categoryOrderCounts(@org.springframework.security.core.annotation.AuthenticationPrincipal com.brightbuy.backend.auth.AuthenticatedUser user) {
        return rService.getCategoryOrderCounts(manager(user));
    }

    @GetMapping("/delivery-estimates")
    public List<DeliveryTimeEstimate> deliveryEstimates(@org.springframework.security.core.annotation.AuthenticationPrincipal com.brightbuy.backend.auth.AuthenticatedUser user) {
        return rService.getUpcomingDeliveryEstimates(manager(user));
    }

    @GetMapping("/customer-order-summary")
    public List<CustomerWiseOrderSummary> customerOrderSummary(@org.springframework.security.core.annotation.AuthenticationPrincipal com.brightbuy.backend.auth.AuthenticatedUser user) {
        return rService.getCustomerOrderSummary(manager(user));
    }
}
