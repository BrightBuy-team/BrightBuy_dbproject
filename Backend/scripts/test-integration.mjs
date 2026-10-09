// Local integration only. Mutates a labelled disposable container; never Azure.
// Usage: node Backend/scripts/test-integration.mjs
import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
const container=process.env.BRIGHTBUY_TEST_CONTAINER||'brightbuy-integration-20261009'
const base=process.env.BRIGHTBUY_TEST_API||'http://127.0.0.1:18085'
const url=new URL(base)
assert.ok(['127.0.0.1','localhost'].includes(url.hostname),'Only loopback API is allowed')
const label=execFileSync('docker',['inspect','--format','{{index .Config.Labels "com.brightbuy.purpose"}}',container],{encoding:'utf8'}).trim()
assert.equal(label,'disposable-integration','Refusing an unlabelled/non-test database')
function sql(query){
 return execFileSync('docker',['exec','-i',container,'sh','-c','MYSQL_PWD="$MYSQL_ROOT_PASSWORD" exec mysql -u root --batch --skip-column-names brightbuy'],{input:query,encoding:'utf8'}).trim()
}
let passed=0
function check(condition,message){assert.ok(condition,message);console.log('PASS '+message);passed++}
function client(){
 const cookies=new Map()
 async function request(path,method='GET',body,csrf=true){
  const headers={Accept:'application/json'}
  if(method!=='GET'&&csrf){
   const token=await request('/api/auth/csrf')
   headers['X-XSRF-TOKEN']=token.body.token
  }
  if(body!==undefined)headers['Content-Type']='application/json'
  headers.Cookie=[...cookies].map(([k,v])=>k+'='+v).join('; ')
  const r=await fetch(base+path,{method,headers,body:body===undefined?undefined:JSON.stringify(body),signal:AbortSignal.timeout(15000)})
  for(const cookie of r.headers.getSetCookie()){const [pair]=cookie.split(';');const index=pair.indexOf('=');cookies.set(pair.slice(0,index),pair.slice(index+1))}
  const text=await r.text()
  let data;try{data=JSON.parse(text)}catch{data=text}
  return {status:r.status,body:data}
 }
 return {request}
}
const tag=Date.now().toString()
// Prove the API reads THIS disposable database before any account/order writes.
// A localhost backend could otherwise be configured to point at a shared DB.
const probeId=Number(sql("CALL sp_catalogue_create_product_with_variant('TEST-PROBE-"+tag+"','Disposable API probe',NULL,NULL,1,1,1.00,1,@probe);SELECT @probe;"))
const probeResponse=await fetch(base+'/api/catalogue/products/'+probeId,{signal:AbortSignal.timeout(10000)})
assert.equal(probeResponse.status,200,'API does not read the disposable database; refusing mutations')
assert.equal((await probeResponse.json()).sku,'TEST-PROBE-'+tag,'API is connected to a different database; refusing mutations')
const email='integration-'+tag+'@example.invalid'
const password='DisposableFixtureOnly2026'
const guest=client(),customer=client(),staff=client(),manager=client(),admin=client()
check((await guest.request('/api/catalogue/products')).status===200,'anonymous catalogue browsing')
check((await guest.request('/api/inventory/variants')).status===401,'anonymous inventory denied')
const registered=await customer.request('/api/auth/register','POST',{firstName:'Integration',lastName:'Fixture',email,password})
assert.equal(registered.status,200,JSON.stringify(registered.body))
const customerId=registered.body.customerId
const login=await customer.request('/api/auth/login','POST',{email,password,accountType:'CUSTOMER'})
check(login.status===200&&login.body.user.id===customerId,'real customer registration/login session')
check((await customer.request('/api/auth/me')).status===200,'session cookie roundtrip')
for(const path of ['/api/inventory/variants','/api/catalogue/staff/products','/api/reports/category-order-counts']){
 check((await customer.request(path)).status===403,'customer denied '+path)
}
sql("INSERT INTO employee(first_name,last_name,email,password_hash,role) SELECT 'Test','Staff','staff-"+tag+"@example.invalid',password_hash,'WarehouseStaff' FROM customer WHERE customer_id="+customerId+"; INSERT INTO employee(first_name,last_name,email,password_hash,role) SELECT 'Test','Manager','manager-"+tag+"@example.invalid',password_hash,'Management' FROM customer WHERE customer_id="+customerId+";")
const staffLogin=await staff.request('/api/auth/login','POST',{email:'staff-'+tag+'@example.invalid',password,accountType:'EMPLOYEE'})
check(staffLogin.status===200,'warehouse staff login')
const staffId=staffLogin.body.user.id
sql("INSERT INTO employee(first_name,last_name,email,password_hash,role) SELECT 'Test','Admin','admin-"+tag+"@example.invalid',password_hash,'Admin' FROM customer WHERE customer_id="+customerId)
const adminLogin=await admin.request('/api/auth/login','POST',{email:'admin-'+tag+'@example.invalid',password,accountType:'EMPLOYEE'})
check(adminLogin.status===200,'admin login')
const provision={firstName:'Provisioned',lastName:'Fixture',email:'provision-'+tag+'@example.invalid',password,role:'WAREHOUSE_STAFF'}
check((await staff.request('/api/auth/employees','POST',provision)).status===403,'warehouse staff cannot provision employees')
check((await admin.request('/api/auth/employees','POST',provision)).status===201,'active admin can provision employees')
sql('UPDATE employee SET is_active=FALSE WHERE employee_id='+adminLogin.body.user.id)
check((await admin.request('/api/auth/employees','POST',{...provision,email:'blocked-'+tag+'@example.invalid'})).status===403,'disabled admin session cannot provision employees')
check((await staff.request('/api/orders')).status===403,'employee cannot access customer order namespace')
check((await staff.request('/api/addresses/me')).status===403,'employee cannot access customer address namespace')
check((await staff.request('/api/checkout','POST',{cartItems:[{variantId:1,quantity:1}],deliveryMode:'pickup',paymentMethod:'cod'})).status===403,'employee checkout denied')
check((await staff.request('/api/inventory/variants/1/stock?quantity=5','PUT',undefined,false)).status===403,'stock mutation without CSRF rejected')
check((await staff.request('/api/inventory/variants/1/stock?quantity=-1','PUT')).status===400,'negative stock rejected')
check((await staff.request('/api/inventory/variants')).status===200,'authenticated inventory read')
const stockBefore=Number(sql('SELECT stock_quantity FROM variant WHERE variant_id=1'))
check((await staff.request('/api/inventory/variants/1/stock?quantity='+(stockBefore+1),'PUT')).status===200,'staff stock update')
check(sql('SELECT changed_by FROM variant_audit WHERE variant_id=1 ORDER BY audit_id DESC LIMIT 1')==='employee:'+staffId,'stock audit uses authenticated actor')
const sku='TEST-INTEGRATION-'+tag
const product={sku,name:'Integration phone',description:'Disposable fixture',imageUrl:null,categoryId:1,warehouseId:1,price:123.45,stock:3}
const bad=await staff.request('/api/catalogue/staff/products','POST',{...product,warehouseId:2147483647})
assert.equal(bad.status,409,JSON.stringify(bad.body));check(true,'invalid initial warehouse rolls back create')
check(sql("SELECT COUNT(*) FROM product WHERE sku='"+sku+"'")==='0','no partially created product')
const created=await staff.request('/api/catalogue/staff/products','POST',product)
assert.equal(created.status,201,JSON.stringify(created.body))
const productId=Number(sql("SELECT product_id FROM product WHERE sku='"+sku+"'"))
const variantId=Number(sql('SELECT variant_id FROM variant WHERE product_id='+productId))
check(productId>0&&variantId>0&&sql('SELECT COUNT(*) FROM product_category WHERE product_id='+productId)==='1','product category and initial variant created together')
check(sql("SELECT COUNT(*) FROM catalogue_audit WHERE entity_type='product' AND entity_id="+productId+" AND actor='employee:"+staffId+"'")==='1','catalogue audit records staff actor')
check((await staff.request('/api/catalogue/staff/products/'+productId,'PUT',{...product,name:'Updated integration phone'})).status===200,'product edit')
check((await staff.request('/api/catalogue/staff/products/'+productId+'/active','PATCH',{active:false})).status===200,'product soft retirement')
check((await guest.request('/api/catalogue/products/'+productId)).status===404,'retired product hidden')
await staff.request('/api/catalogue/staff/products/'+productId+'/active','PATCH',{active:true})
check((await staff.request('/api/catalogue/staff/products/'+productId+'/categories/1','DELETE')).status===400,'final category cannot be removed')
const categoryName='Integration category '+tag
check((await staff.request('/api/catalogue/staff/categories','POST',{name:categoryName,description:'Test category',parentCategoryId:null,active:true})).status===201,'staff creates category')
const categoryId=Number(sql("SELECT category_id FROM category WHERE name='"+categoryName+"'"))
check((await staff.request('/api/catalogue/staff/categories/'+categoryId,'PUT',{name:categoryName,description:'Edited category',parentCategoryId:null,active:true})).status===200,'staff edits category')
check((await staff.request('/api/catalogue/staff/products/'+productId+'/categories/'+categoryId,'POST')).status===200,'staff assigns category')
check((await staff.request('/api/catalogue/staff/products/'+productId+'/categories/'+categoryId,'DELETE')).status===200,'staff removes non-final category')
const checkout={cartItems:[{variantId,quantity:1}],deliveryMode:'delivery',paymentMethod:'cod',cityId:1,addressLine:'101 Integration Test Street'}
let ordersBefore=Number(sql('SELECT COUNT(*) FROM orders'))
check((await customer.request('/api/checkout','POST',{...checkout,paymentMethod:'card'})).status===503,'unconfigured card gateway fails closed')
check(Number(sql('SELECT COUNT(*) FROM orders'))===ordersBefore,'card rejection creates no order')
check((await customer.request('/api/checkout','POST',{...checkout,cartItems:[]})).status===400,'empty cart rejected')
check((await customer.request('/api/checkout','POST',{...checkout,cartItems:[{variantId,quantity:1.5}]})).status===400,'fractional quantity rejected before coercion')
check((await customer.request('/api/checkout','POST',{...checkout,cartItems:[{variantId,quantity:1},{variantId,quantity:1}]})).status===400,'duplicate variants rejected')
const stockSnapshot=sql('SELECT stock_quantity FROM variant WHERE variant_id='+variantId)
check((await customer.request('/api/checkout','POST',{...checkout,cartItems:[{variantId,quantity:1},{variantId:3,quantity:1}]})).status===409,'multi-line checkout rejects one unavailable variant')
check(sql('SELECT stock_quantity FROM variant WHERE variant_id='+variantId)===stockSnapshot&&Number(sql('SELECT COUNT(*) FROM orders'))===ordersBefore,'multi-line stock failure rolls back the entire order')
check(sql("CALL ProcessCheckoutV2("+customerId+",JSON_ARRAY(JSON_OBJECT('variantId',"+variantId+",'quantity',0.5)),'pickup','cod',NULL,NULL,@status,@order);SELECT @status;")==='INVALID_CART','SQL also rejects fractional raw quantities')
const success=await customer.request('/api/checkout','POST',{...checkout,customerId:1,totalAmount:0})
assert.equal(success.status,201,JSON.stringify(success.body))
const orderId=success.body.orderId
check(sql('SELECT customer_id FROM orders WHERE order_id='+orderId)===String(customerId),'request customerId cannot impersonate another customer')
check(sql('SELECT total_amount FROM orders WHERE order_id='+orderId)==='123.45','database price is authoritative')
check(sql('SELECT address_line FROM delivery WHERE order_id='+orderId)==='101 Integration Test Street','purchase-time address persisted')
check((await customer.request('/api/addresses/me','PUT',{addressLine:'202 Changed Profile Street',cityId:2})).status===200,'customer updates own valid address')
check((await customer.request('/api/addresses/me','PUT',{addressLine:'202 Changed Profile Street',cityId:2147483647})).status===400,'unknown address city rejected')
check(sql('SELECT address_line FROM delivery WHERE order_id='+orderId)==='101 Integration Test Street','profile edit does not rewrite historical delivery address')
check(sql('SELECT payment_status FROM payment WHERE order_id='+orderId)==='Pending','COD confirmation keeps payment pending')
check(sql('SELECT changed_by FROM variant_audit WHERE variant_id='+variantId+' ORDER BY audit_id DESC LIMIT 1')==='customer:'+customerId,'checkout stock audit records customer actor')
const history=await customer.request('/api/orders')
check(history.status===200&&history.body.some(o=>o.orderId===orderId),'own order history includes confirmation')
check((await customer.request('/api/delivery/estimate?cityId=1&orderId='+orderId)).status===200,'own delivery estimate')
check((await customer.request('/api/delivery/estimate?cityId=1&orderId=101')).status===404,'other customer delivery not exposed')
check((await customer.request('/api/delivery/estimate?cityId=2&orderId='+orderId)).status===400,'order destination cannot be replaced by request city')
const pickup=await customer.request('/api/checkout','POST',{...checkout,deliveryMode:'pickup',cityId:null,addressLine:null})
check(pickup.status===201,'pickup checkout without a delivery address')
check(sql('SELECT IF(city_id IS NULL AND est_delivery_date IS NULL,1,0) FROM delivery WHERE order_id='+pickup.body.orderId)==='1','pickup has no invented city-based delivery date')
await staff.request('/api/inventory/variants/'+variantId+'/stock?quantity=1','PUT')
ordersBefore=Number(sql('SELECT COUNT(*) FROM orders'))
const raced=await Promise.all([customer.request('/api/checkout','POST',checkout),customer.request('/api/checkout','POST',checkout)])
check(raced.filter(r=>r.status===201).length===1&&raced.filter(r=>r.status===409).length===1,'concurrent last-unit orders yield one success and one stock conflict')
check(Number(sql('SELECT COUNT(*) FROM orders'))===ordersBefore+1&&sql('SELECT stock_quantity FROM variant WHERE variant_id='+variantId)==='0','losing checkout leaves no partial order or negative stock')
const lastOrder=raced.find(r=>r.status===201).body.orderId
check(sql('SELECT DATEDIFF(est_delivery_date,DATE(order_date)) FROM delivery JOIN orders USING(order_id) WHERE order_id='+lastOrder)==='5','last-unit delivery is five days, not eight')
await staff.request('/api/inventory/variants/'+variantId+'/stock?quantity=20','PUT')
const buyers=Array.from({length:20},()=>client())
for(const buyer of buyers)assert.equal((await buyer.request('/api/auth/login','POST',{email,password,accountType:'CUSTOMER'})).status,200)
const started=performance.now()
const concurrent=await Promise.all(buyers.map(async buyer=>{
 const time=performance.now();const result=await buyer.request('/api/checkout','POST',{...checkout,deliveryMode:'pickup',cityId:null,addressLine:null})
 return {...result,ms:Math.round(performance.now()-time)}
}))
check(concurrent.every(r=>r.status===201)&&new Set(concurrent.map(r=>r.body.orderId)).size===20,'20 concurrent customer sessions each confirm exactly one order')
check(sql('SELECT stock_quantity FROM variant WHERE variant_id='+variantId)==='0','20 concurrent checkouts deduct exactly 20 units')
console.log('MEASUREMENT 20 concurrent checkout sessions: elapsed_ms='+Math.round(performance.now()-started)+', max_ms='+Math.max(...concurrent.map(r=>r.ms)))
const managerLogin=await manager.request('/api/auth/login','POST',{email:'manager-'+tag+'@example.invalid',password,accountType:'EMPLOYEE'})
check(managerLogin.status===200,'management login')
const managerId=managerLogin.body.user.id
sql('CALL sp_populate_sales_summary(7)')
const year=new Date().getFullYear()
for(const path of ['quarterly-sales?year='+year,'top-selling-products?startDate='+year+'-01-01&endDate='+year+'-12-31&topN=10','category-order-counts','delivery-estimates','customer-order-summary']){
 const result=await manager.request('/api/reports/'+path+(path.includes('?')?'&':'?')+'employeeId='+staffId)
 check(result.status===200&&Array.isArray(result.body),'management report '+path.split('?')[0])
}
check(sql('SELECT employee_id FROM report_access_log ORDER BY log_id DESC LIMIT 1')===String(managerId),'report audit ignores forged employee ID')
const quarterly=await manager.request('/api/reports/quarterly-sales?year='+year)
const expectedRevenue=Number(sql("SELECT SUM(total_amount) FROM orders WHERE YEAR(order_date)="+year+" AND QUARTER(order_date)=QUARTER(CURDATE()) AND order_status<>'Cancelled'"))
check(Number(quarterly.body.find(r=>r.quarter===Math.ceil((new Date().getMonth()+1)/3)).totalRevenue)===expectedRevenue,'quarterly revenue includes today and excludes cancelled orders')
const top=await manager.request('/api/reports/top-selling-products?startDate='+year+'-01-01&endDate='+year+'-12-31&topN=100')
check(top.status===200&&top.body.some(r=>r.productId===productId),'top products include today without waiting for summary cron')
check((await manager.request('/api/reports/top-selling-products?startDate=2026-12-31&endDate=2026-01-01')).status===400,'reversed report range rejected')
check((await manager.request('/api/reports/top-selling-products?startDate=2026-01-01&endDate=2026-12-31&topN=101')).status===400,'unbounded report size rejected')
sql('UPDATE employee SET is_active=FALSE WHERE employee_id='+staffId)
check((await staff.request('/api/catalogue/staff/products')).status===403,'disabled staff session cannot maintain catalogue')
check((await customer.request('/api/auth/logout','POST')).status===204,'real logout')
check((await customer.request('/api/auth/me')).status===401,'logout invalidates session')
console.log('PASS '+passed+' HTTP/MySQL integration checks')
