package com.brightbuy.backend.reporting;

import com.brightbuy.backend.auth.Access;
import com.brightbuy.backend.auth.AuthService;
import com.brightbuy.backend.auth.AuthenticatedUser;
import com.brightbuy.backend.auth.EmployeeRole;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import java.time.LocalDate;
import java.util.List;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.server.ResponseStatusException;

/**
 * The five management reports (SRS 4.7). Management only and read-only (BR-15). The employee
 * recorded in the report access log is always the signed-in one, never a request parameter.
 */
@RestController
@RequestMapping("/api/reports")
public class ReportController {
    private final ReportRepository reports;
    private final AuthService auth;

    public ReportController(ReportRepository reports, AuthService auth) {
        this.reports = reports;
        this.auth = auth;
    }

    @GetMapping("/quarterly-sales")
    public List<QuarterlySales> quarterlySales(@AuthenticationPrincipal AuthenticatedUser user,
            @RequestParam @Min(2000) @Max(2100) int year) {
        return reports.getQuarterlySales(year, manager(user));
    }

    @GetMapping("/top-selling-products")
    public List<TopSellingProduct> topSellingProducts(@AuthenticationPrincipal AuthenticatedUser user,
            @RequestParam LocalDate startDate, @RequestParam LocalDate endDate,
            @RequestParam(defaultValue = "10") @Min(1) @Max(100) int topN) {
        if (startDate.isAfter(endDate)) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Invalid date range");
        }
        return reports.getTopSellingProducts(startDate, endDate, topN, manager(user));
    }

    @GetMapping("/category-order-counts")
    public List<CategoryOrderCount> categoryOrderCounts(@AuthenticationPrincipal AuthenticatedUser user) {
        return reports.getCategoryOrderCounts(manager(user));
    }

    @GetMapping("/delivery-estimates")
    public List<DeliveryTimeEstimate> deliveryEstimates(@AuthenticationPrincipal AuthenticatedUser user) {
        return reports.getUpcomingDeliveryEstimates(manager(user));
    }

    @GetMapping("/customer-order-summary")
    public List<CustomerWiseOrderSummary> customerOrderSummary(@AuthenticationPrincipal AuthenticatedUser user) {
        return reports.getCustomerOrderSummary(manager(user));
    }

    /** The employee ID of an active management user; otherwise 401 or 403. */
    private int manager(AuthenticatedUser user) {
        int employeeId = Access.employee(user);
        if (!auth.employeeHasRole(employeeId, EmployeeRole.MANAGEMENT)) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN);
        }
        return employeeId;
    }
}
