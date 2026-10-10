package com.brightbuy.backend.checkout.repository;
import com.brightbuy.backend.checkout.dto.*;
import tools.jackson.databind.ObjectMapper;
import org.springframework.jdbc.core.*;
import org.springframework.stereotype.Repository;
import java.sql.Types;
import java.util.List;
@Repository
public class CheckoutRepository {
 private final JdbcTemplate jdbc;
 private final ObjectMapper mapper;
 public CheckoutRepository(JdbcTemplate jdbc,ObjectMapper mapper){this.jdbc=jdbc;this.mapper=mapper;}
 public CheckoutResult checkout(int customerId,CheckoutRequestDto request) {
  String json=mapper.writeValueAsString(request.cartItems());
  return jdbc.execute((ConnectionCallback<CheckoutResult>) connection->{
   try(var actor=connection.prepareStatement("SET @brightbuy_actor=?")){
    actor.setString(1,"customer:"+customerId);actor.execute();
   }
   try(var call=connection.prepareCall("{call ProcessCheckoutV2(?,?,?,?,?,?,?,?)}")){
    call.setInt(1,customerId);call.setString(2,json);
    call.setString(3,request.deliveryMode());call.setString(4,request.paymentMethod());
    if(request.cityId()==null)call.setNull(5,Types.INTEGER);else call.setInt(5,request.cityId());
    call.setString(6,request.addressLine());call.registerOutParameter(7,Types.VARCHAR);call.registerOutParameter(8,Types.INTEGER);
    call.execute();String status=call.getString(7);int id=call.getInt(8);
    return new CheckoutResult(status,call.wasNull()?null:id);
   }finally{
    try(var reset=connection.createStatement()){reset.execute("SET @brightbuy_actor=NULL");}
   }
  });
 }
 public String callProcessCheckout(Integer id,List<CartItemDto> items,String mode,String method) {
  return checkout(id,new CheckoutRequestDto(items,mode,method)).status();
 }
}
