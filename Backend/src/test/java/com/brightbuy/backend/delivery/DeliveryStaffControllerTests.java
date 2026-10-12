package com.brightbuy.backend.delivery;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.Mockito.*;

import com.brightbuy.backend.auth.AccountType;
import com.brightbuy.backend.auth.AuthService;
import com.brightbuy.backend.auth.AuthenticatedUser;
import com.brightbuy.backend.auth.EmployeeRole;
import java.util.List;
import org.junit.jupiter.api.Assertions;
import org.junit.jupiter.api.Test;
import org.springframework.http.HttpStatus;
import org.springframework.web.server.ResponseStatusException;

class DeliveryStaffControllerTests {
    private final DeliveryRepository repository = mock(DeliveryRepository.class);
    private final AuthService auth = mock(AuthService.class);
    private final DeliveryStaffController controller = new DeliveryStaffController(repository, auth);

    @Test
    void driverQueueIsFilteredByTheSignedInEmployeeId() {
        var delivery = new DeliveryRepository.StaffDelivery(10, 100, "12 Main St", "Colombo", null, 42);
        when(auth.employeeHasRole(42, EmployeeRole.DELIVERY_DRIVER)).thenReturn(true);
        when(repository.pendingDeliveries(42)).thenReturn(List.of(delivery));

        assertThat(controller.assigned(employee(42, "DeliveryDriver"))).containsExactly(delivery);
        verify(repository).pendingDeliveries(42);
    }

    @Test
    void driverCannotReadTheUnassignedGlobalQueue() {
        when(auth.employeeHasAnyRole(42, EmployeeRole.WAREHOUSE_STAFF, EmployeeRole.ADMIN)).thenReturn(false);

        ResponseStatusException failure = Assertions.assertThrows(ResponseStatusException.class,
                () -> controller.queue(employee(42, "DeliveryDriver")));
        assertThat(failure.getStatusCode()).isEqualTo(HttpStatus.FORBIDDEN);
        verifyNoInteractions(repository);
    }

    @Test
    void warehouseAssignmentIsAuditedAsTheWarehouseEmployee() {
        when(auth.employeeHasAnyRole(12, EmployeeRole.WAREHOUSE_STAFF, EmployeeRole.ADMIN)).thenReturn(true);

        controller.assign(employee(12, "WarehouseStaff"), 10,
                new DeliveryStaffController.AssignmentRequest(42));

        verify(repository).assign("employee:12", 10, 42);
    }

    @Test
    void aDriverCanOnlyCompleteUsingTheirOwnSessionIdentity() {
        when(auth.employeeHasRole(42, EmployeeRole.DELIVERY_DRIVER)).thenReturn(true);

        controller.markDelivered(employee(42, "DeliveryDriver"), 10);

        verify(repository).markDelivered("employee:42", 10, 42);
    }

    @Test
    void driverCannotAssignDeliveries() {
        when(auth.employeeHasAnyRole(42, EmployeeRole.WAREHOUSE_STAFF, EmployeeRole.ADMIN)).thenReturn(false);

        assertThatThrownBy(() -> controller.assign(employee(42, "DeliveryDriver"), 10,
                new DeliveryStaffController.AssignmentRequest(99)))
                .isInstanceOf(ResponseStatusException.class);
        verifyNoInteractions(repository);
    }

    private static AuthenticatedUser employee(int id, String role) {
        return new AuthenticatedUser(id, "employee@example.test", AccountType.EMPLOYEE, role);
    }
}
