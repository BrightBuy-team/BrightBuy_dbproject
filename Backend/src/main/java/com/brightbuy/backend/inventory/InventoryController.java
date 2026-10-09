package com.brightbuy.backend.inventory;
import com.brightbuy.backend.auth.*;
import com.brightbuy.backend.config.ActorJdbc;
import java.util.List;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;
@RestController @RequestMapping("/api/inventory")
public class InventoryController {
 private final InventoryService service;private final VariantRepository variants;private final ActorJdbc actor;private final AuthService auth;
 public InventoryController(InventoryService service,VariantRepository variants,ActorJdbc actor,AuthService auth){
  this.service=service;this.variants=variants;this.actor=actor;this.auth=auth;
 }
 private int staff(AuthenticatedUser u){
  int id=Access.employee(u);
  if(!auth.employeeHasRole(id,EmployeeRole.WAREHOUSE_STAFF)&&!auth.employeeHasRole(id,EmployeeRole.ADMIN))
   throw new ResponseStatusException(HttpStatus.FORBIDDEN);
  return id;
 }
 @GetMapping("/variants") public List<Variant> all(@AuthenticationPrincipal AuthenticatedUser u){staff(u);return service.getAllVariants();}
 @GetMapping("/low-stock") public List<Variant> low(@AuthenticationPrincipal AuthenticatedUser u,@RequestParam(defaultValue="10") int threshold){
  staff(u);if(threshold<0)throw new ResponseStatusException(HttpStatus.BAD_REQUEST);return service.getLowStockVariants(threshold);
 }
 @PutMapping("/variants/{variantId}/stock") public Variant stock(@AuthenticationPrincipal AuthenticatedUser u,
  @PathVariable int variantId,@RequestParam int quantity){
  int id=staff(u);if(quantity<0)throw new ResponseStatusException(HttpStatus.BAD_REQUEST);
  if(!variants.existsById(variantId))throw new ResponseStatusException(HttpStatus.NOT_FOUND);
  actor.call("employee:"+id,"UPDATE variant SET stock_quantity=? WHERE variant_id=?",quantity,variantId);
  return variants.findById(variantId).orElseThrow(()->new ResponseStatusException(HttpStatus.NOT_FOUND));
 }
}
