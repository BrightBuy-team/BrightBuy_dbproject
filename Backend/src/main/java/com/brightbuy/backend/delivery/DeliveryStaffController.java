package com.brightbuy.backend.delivery;

import com.brightbuy.backend.auth.Access;
import com.brightbuy.backend.auth.AuthService;
import com.brightbuy.backend.auth.AuthenticatedUser;
import com.brightbuy.backend.auth.EmployeeRole;
import com.brightbuy.backend.config.ActorJdbc;
import com.brightbuy.backend.config.DatabaseErrors;
import jakarta.validation.Valid;
import jakarta.validation.constraints.Positive;
import java.util.List;
import org.springframework.dao.DataAccessException;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.server.ResponseStatusException;

/** Staff delivery assignment and driver completion actions. */
@RestController
@RequestMapping("/api/delivery/staff")
public class DeliveryStaffController {
    private final DeliveryRepository repository;
    private final AuthService auth;

    public DeliveryStaffController(DeliveryRepository repository, AuthService auth) {
        this.repository = repository;
        this.auth = auth;
    }

    @GetMapping("/queue")
    public List<DeliveryRepository.StaffDelivery> queue(
            @AuthenticationPrincipal AuthenticatedUser user) {
        staff(user);
        return repository.pendingDeliveries(null);
    }

    @GetMapping("/assigned")
    public List<DeliveryRepository.StaffDelivery> assigned(
            @AuthenticationPrincipal AuthenticatedUser user) {
        int employeeId = employeeWithRole(user, EmployeeRole.DELIVERY_DRIVER);
        return repository.pendingDeliveries(employeeId);
    }

    @GetMapping("/drivers")
    public List<DeliveryRepository.DeliveryDriver> drivers(
            @AuthenticationPrincipal AuthenticatedUser user) {
        staff(user);
        return repository.activeDrivers();
    }

    @PutMapping("/{deliveryId}/assignment")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void assign(@AuthenticationPrincipal AuthenticatedUser user, @PathVariable @Positive int deliveryId,
            @Valid @RequestBody AssignmentRequest request) {
        int employeeId = staff(user);
        write(() -> repository.assign(ActorJdbc.employee(employeeId), deliveryId, request.employeeId()));
    }

    @PostMapping("/{deliveryId}/delivered")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void markDelivered(@AuthenticationPrincipal AuthenticatedUser user,
            @PathVariable @Positive int deliveryId) {
        int employeeId = employeeWithRole(user, EmployeeRole.DELIVERY_DRIVER);
        write(() -> repository.markDelivered(ActorJdbc.employee(employeeId), deliveryId, employeeId));
    }

    private int staff(AuthenticatedUser user) {
        int employeeId = Access.employee(user);
        if (!auth.employeeHasAnyRole(employeeId, EmployeeRole.WAREHOUSE_STAFF, EmployeeRole.ADMIN)) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN);
        }
        return employeeId;
    }

    private int employeeWithRole(AuthenticatedUser user, EmployeeRole role) {
        int employeeId = Access.employee(user);
        if (!auth.employeeHasRole(employeeId, role)) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN);
        }
        return employeeId;
    }

    private static void write(Runnable change) {
        try {
            change.run();
        } catch (DataAccessException exception) {
            throw DatabaseErrors.toHttp(exception);
        }
    }

    public record AssignmentRequest(Integer employeeId) {
    }
}
