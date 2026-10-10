package com.brightbuy.backend.auth;
import org.springframework.http.HttpStatus;
import org.springframework.web.server.ResponseStatusException;
public final class Access {
 private Access() {}
 public static int customer(AuthenticatedUser user) {
  if(user==null) throw new ResponseStatusException(HttpStatus.UNAUTHORIZED);
  if(user.accountType()!=AccountType.CUSTOMER) throw new ResponseStatusException(HttpStatus.FORBIDDEN);
  return user.id();
 }
 public static int employee(AuthenticatedUser user) {
  if(user==null) throw new ResponseStatusException(HttpStatus.UNAUTHORIZED);
  if(user.accountType()!=AccountType.EMPLOYEE) throw new ResponseStatusException(HttpStatus.FORBIDDEN);
  return user.id();
 }
}
