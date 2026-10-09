package com.brightbuy.backend.catalogue;
import com.brightbuy.backend.auth.*;
import com.brightbuy.backend.config.ActorJdbc;
import jakarta.validation.Valid;
import jakarta.validation.constraints.*;
import java.math.BigDecimal;
import java.sql.SQLException;
import java.util.*;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.dao.DataAccessException;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;

@RestController @RequestMapping("/api/catalogue/staff")
public class CatalogueStaffController {
 private final JdbcTemplate jdbc; private final ActorJdbc actor; private final AuthService auth;
 public CatalogueStaffController(JdbcTemplate jdbc,ActorJdbc actor,AuthService auth){
  this.jdbc=jdbc;this.actor=actor;this.auth=auth;
 }
 private String staff(AuthenticatedUser user){
  int id=Access.employee(user);
  if(!auth.employeeHasRole(id,EmployeeRole.WAREHOUSE_STAFF)&&!auth.employeeHasRole(id,EmployeeRole.ADMIN))
   throw new ResponseStatusException(HttpStatus.FORBIDDEN);
  return "employee:"+id;
 }
 @GetMapping("/products") public List<Map<String,Object>> products(@AuthenticationPrincipal AuthenticatedUser u,
  @RequestParam(defaultValue="") String keyword,@RequestParam(defaultValue="1") int page){
  staff(u);
  if(keyword.length()>255||page<1||page>100000)throw new ResponseStatusException(HttpStatus.BAD_REQUEST);
  return jdbc.queryForList("SELECT * FROM product WHERE ?='' OR LOCATE(?,name)>0 OR LOCATE(?,sku)>0 ORDER BY product_id LIMIT 100 OFFSET ?",
   keyword.trim(),keyword.trim(),keyword.trim(),(page-1)*100);
 }
 @GetMapping("/categories") public List<Map<String,Object>> categories(@AuthenticationPrincipal AuthenticatedUser u){
  staff(u);return jdbc.queryForList("SELECT * FROM category ORDER BY category_id");
 }
 @GetMapping("/warehouses") public List<Map<String,Object>> warehouses(@AuthenticationPrincipal AuthenticatedUser u){
  staff(u);return jdbc.queryForList("SELECT warehouse_id,name FROM warehouse ORDER BY warehouse_id");
 }
 @GetMapping("/products/{id}/categories") public List<Map<String,Object>> mappings(@AuthenticationPrincipal AuthenticatedUser u,@PathVariable int id){
  staff(u);return jdbc.queryForList("SELECT category_id FROM product_category WHERE product_id=?",id);
 }
 private void write(AuthenticatedUser u,String sql,Object... args){
  try{actor.call(staff(u),sql,args);}
  catch(DataAccessException e){
   Throwable cause=e.getMostSpecificCause(); String state=cause instanceof SQLException s?s.getSQLState():"";
   if("45004".equals(state)) throw new ResponseStatusException(HttpStatus.NOT_FOUND,"Referenced record not found");
   if("45000".equals(state)) throw new ResponseStatusException(HttpStatus.BAD_REQUEST,"Invalid catalogue change or business rule");
   if(state!=null&&state.startsWith("23")) throw new ResponseStatusException(HttpStatus.CONFLICT,"Duplicate or invalid reference");
   throw new ResponseStatusException(HttpStatus.INTERNAL_SERVER_ERROR,"Catalogue update failed");
  }
 }
 @PostMapping("/products") @ResponseStatus(HttpStatus.CREATED)
 public void create(@AuthenticationPrincipal AuthenticatedUser u,@Valid @RequestBody ProductInput p){
  write(u,"{call sp_catalogue_create_product_with_variant(?,?,?,?,?,?,?,?,@created_product)}",
   p.sku(),p.name(),p.description(),p.imageUrl(),p.categoryId(),p.warehouseId(),p.price(),p.stock());
 }
 @PutMapping("/products/{id}") public void update(@AuthenticationPrincipal AuthenticatedUser u,@PathVariable int id,@Valid @RequestBody ProductEdit p){
  write(u,"{call sp_catalogue_update_product(?,?,?,?,?)}",id,p.sku(),p.name(),p.description(),p.imageUrl());
 }
 @PatchMapping("/products/{id}/active") public void active(@AuthenticationPrincipal AuthenticatedUser u,@PathVariable int id,@RequestBody Active a){
  write(u,"{call sp_catalogue_set_product_active(?,?)}",id,a.active()?1:0);
 }
 @PostMapping("/products/{id}/categories/{category}") public void assign(@AuthenticationPrincipal AuthenticatedUser u,@PathVariable int id,@PathVariable int category){
  write(u,"{call sp_catalogue_assign_category(?,?)}",id,category);
 }
 @DeleteMapping("/products/{id}/categories/{category}") public void unassign(@AuthenticationPrincipal AuthenticatedUser u,@PathVariable int id,@PathVariable int category){
  write(u,"{call sp_catalogue_unassign_category(?,?)}",id,category);
 }
 @PostMapping("/categories") @ResponseStatus(HttpStatus.CREATED)
 public void createCategory(@AuthenticationPrincipal AuthenticatedUser u,@Valid @RequestBody CategoryInput c){
  write(u,"{call sp_catalogue_create_category(?,?,?,@created_category)}",c.name(),c.description(),c.parentCategoryId());
 }
 @PutMapping("/categories/{id}") public void updateCategory(@AuthenticationPrincipal AuthenticatedUser u,@PathVariable int id,@Valid @RequestBody CategoryInput c){
  write(u,"{call sp_catalogue_update_category(?,?,?,?,?)}",id,c.name(),c.description(),c.parentCategoryId(),c.active()?1:0);
 }
 public record ProductInput(@NotBlank @Size(max=50) String sku,@NotBlank @Size(max=150) String name,
  String description,@Size(max=500) String imageUrl,@NotNull @Positive Integer categoryId,
  @Positive Integer warehouseId,@NotNull @DecimalMin("0.01") @Digits(integer=8,fraction=2) BigDecimal price,
  @NotNull @Min(0) Integer stock){}
 public record ProductEdit(@NotBlank @Size(max=50) String sku,@NotBlank @Size(max=150) String name,
  String description,@Size(max=500) String imageUrl){}
 public record CategoryInput(@NotBlank @Size(max=100) String name,@Size(max=500) String description,
  @Positive Integer parentCategoryId,boolean active){}
 public record Active(boolean active){}
}
