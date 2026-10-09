package com.brightbuy.backend.checkout.repository;
import com.brightbuy.backend.checkout.dto.*;
import tools.jackson.databind.ObjectMapper;
import org.springframework.jdbc.core.*;
import org.springframework.jdbc.core.simple.SimpleJdbcCall;
import org.springframework.jdbc.core.namedparam.MapSqlParameterSource;
import org.springframework.stereotype.Repository;
import java.sql.Types;
import java.util.List;
@Repository
public class CheckoutRepository {
 private final SimpleJdbcCall call;
 private final ObjectMapper mapper;
 public CheckoutRepository(JdbcTemplate jdbc,ObjectMapper mapper) {
  this.mapper=mapper;
  call=new SimpleJdbcCall(jdbc).withProcedureName("ProcessCheckoutV2")
   .withoutProcedureColumnMetaDataAccess().declareParameters(
    new SqlParameter("p_customer_id",Types.INTEGER),new SqlParameter("p_cart_json",Types.VARCHAR),
    new SqlParameter("p_delivery_mode",Types.VARCHAR),new SqlParameter("p_payment_method",Types.VARCHAR),
    new SqlParameter("p_city_id",Types.INTEGER),new SqlParameter("p_address",Types.VARCHAR),
    new SqlOutParameter("p_status",Types.VARCHAR),new SqlOutParameter("p_order_id",Types.INTEGER));
 }
 public CheckoutResult checkout(int customerId,CheckoutRequestDto request) {
  var out=call.execute(new MapSqlParameterSource().addValue("p_customer_id",customerId)
   .addValue("p_cart_json",mapper.writeValueAsString(request.cartItems()))
   .addValue("p_delivery_mode",request.deliveryMode()).addValue("p_payment_method",request.paymentMethod())
   .addValue("p_city_id",request.cityId()).addValue("p_address",request.addressLine()));
  return new CheckoutResult((String)out.get("p_status"),(Integer)out.get("p_order_id"));
 }
 // Older callers retain the status-only interface.
 public String callProcessCheckout(Integer id,List<CartItemDto> items,String mode,String method) {
  return checkout(id,new CheckoutRequestDto(items,mode,method)).status();
 }
}
