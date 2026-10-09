package com.brightbuy.backend.delivery;
import com.brightbuy.backend.auth.*;
import java.time.LocalDate;
import java.util.*;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;
@RestController @RequestMapping("/api/delivery")
public class DeliveryController {
 private final DeliveryService service;private final JdbcTemplate jdbc;private final AuthService auth;
 public DeliveryController(DeliveryService service,JdbcTemplate jdbc,AuthService auth){this.service=service;this.jdbc=jdbc;this.auth=auth;}
 @GetMapping("/cities") public List<City> cities(){return service.getAllCities();}
 @GetMapping("/preview") public Map<String,Object> preview(@RequestParam int cityId){
  var city=service.getAllCities().stream().filter(c->c.getCityId()==cityId).findFirst()
   .orElseThrow(()->new ResponseStatusException(HttpStatus.BAD_REQUEST,"Unknown city"));
  return Map.of("estimated_delivery_date",LocalDate.now().plusDays(Boolean.TRUE.equals(city.getIsMainCity())?5:7));
 }
 @GetMapping("/estimate") public Map<String,Object> estimate(@AuthenticationPrincipal AuthenticatedUser user,
  @RequestParam int cityId,@RequestParam int orderId){
  if(user==null)throw new ResponseStatusException(HttpStatus.UNAUTHORIZED);
  if(user.accountType()==AccountType.EMPLOYEE) {
   if(!auth.employeeHasRole(user.id(),EmployeeRole.WAREHOUSE_STAFF)&&!auth.employeeHasRole(user.id(),EmployeeRole.MANAGEMENT)&&!auth.employeeHasRole(user.id(),EmployeeRole.ADMIN))
    throw new ResponseStatusException(HttpStatus.FORBIDDEN);
  } else if(jdbc.queryForObject("SELECT COUNT(*) FROM orders WHERE order_id=? AND customer_id=?",Integer.class,orderId,user.id())!=1)
   throw new ResponseStatusException(HttpStatus.NOT_FOUND,"Order not found");
  var rows=jdbc.queryForList("SELECT est_delivery_date,delivery_mode,city_id FROM delivery WHERE order_id=?",orderId);
  if(rows.isEmpty())throw new ResponseStatusException(HttpStatus.NOT_FOUND);
  var row=rows.get(0);
  if("delivery".equals(row.get("delivery_mode"))&&!Objects.equals(row.get("city_id"),cityId))
   throw new ResponseStatusException(HttpStatus.BAD_REQUEST,"Destination differs from this order");
  // Return the persisted purchase-time estimate, not a new date based on today's stock.
  return row;
 }
}
