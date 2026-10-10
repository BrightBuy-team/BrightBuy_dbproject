package com.brightbuy.backend.config;
import java.sql.*;
import org.springframework.jdbc.core.*;
import org.springframework.stereotype.Component;
@Component
public class ActorJdbc {
 private final JdbcTemplate jdbc;
 public ActorJdbc(JdbcTemplate jdbc){this.jdbc=jdbc;}
 public void call(String actor,String sql,Object... args){
  jdbc.execute((ConnectionCallback<Void>) c->{
   try(var set=c.prepareStatement("SET @brightbuy_actor=?")){
    set.setString(1,actor);set.execute();
   }
   // Native prepared CALL avoids JDBC metadata/OUT binding for discarded IDs.
   String nativeSql=sql.startsWith("{call ")?"CALL "+sql.substring(6,sql.length()-1):sql;
   try(var call=c.prepareStatement(nativeSql)){
    for(int i=0;i<args.length;i++) call.setObject(i+1,args[i]);
    call.execute();
   } finally {
    try(var reset=c.createStatement()){reset.execute("SET @brightbuy_actor=NULL");}
   }
   return null;
  });
 }
}
