// Currency migration regression in isolated schemas within a labelled test container.
import assert from 'node:assert/strict'
import {execFileSync} from 'node:child_process'
import {readFileSync} from 'node:fs'
const container=process.env.BRIGHTBUY_TEST_CONTAINER||'brightbuy-currency-20261009'
assert.equal(execFileSync('docker',['inspect','--format','{{index .Config.Labels "com.brightbuy.purpose"}}',container],{encoding:'utf8'}).trim(),'disposable-integration')
const migration=readFileSync(new URL('../../Database/Integration/03_convert_currency_to_lkr.sql',import.meta.url),'utf8')
function sql(input){return execFileSync('docker',['exec','-i',container,'sh','-c','MYSQL_PWD="$MYSQL_ROOT_PASSWORD" exec mysql -u root --batch --skip-column-names'],{input,encoding:'utf8',stdio:['pipe','pipe','pipe']}).trim()}
let count=0
function check(value,label){assert.ok(value,label);console.log('PASS '+label);count++}
function setup(name){sql(`CREATE DATABASE ${name}; USE ${name};
 CREATE TABLE variant(variant_id INT PRIMARY KEY,price DECIMAL(10,2),stock_quantity INT) ENGINE=InnoDB;
 CREATE TABLE orders(order_id INT PRIMARY KEY,total_amount DECIMAL(10,2),order_date DATETIME,order_status VARCHAR(30)) ENGINE=InnoDB;
 CREATE TABLE order_item(order_id INT,variant_id INT,unit_price DECIMAL(10,2),quantity INT) ENGINE=InnoDB;
 CREATE TABLE payment(payment_id INT PRIMARY KEY,order_id INT,amount DECIMAL(10,2)) ENGINE=InnoDB;
 CREATE TABLE sales_summary(summary_id INT PRIMARY KEY,variant_id INT,summary_date DATE,total_revenue DECIMAL(12,2),units_sold INT,order_count INT) ENGINE=InnoDB;
 INSERT INTO variant VALUES(1,1099,2);
 INSERT INTO orders VALUES(1,28,NOW(),'Confirmed');
 INSERT INTO order_item VALUES(1,1,7,4);
 INSERT INTO payment VALUES(1,1,28);
 INSERT INTO sales_summary VALUES(1,1,CURDATE(),28,4,1);`)}
function run(name,approved=true){return sql(`SET @brightbuy_convert_all_usd=${approved?1:0};\n`+migration.replace('USE brightbuy;',`USE ${name};`))}
function snapshot(name){return sql(`USE ${name}; SELECT price,stock_quantity FROM variant; SELECT total_amount FROM orders;SELECT unit_price,quantity FROM order_item;SELECT amount FROM payment;SELECT total_revenue FROM sales_summary;`)}
const tag=Date.now().toString()
const valid='currency_valid_'+tag,invalid='currency_invalid_'+tag
setup(valid);const before=snapshot(valid)
assert.throws(()=>run(valid,false));check(snapshot(valid)===before,'missing explicit approval changes no money')
run(valid)
check(sql(`USE ${valid};SELECT price FROM variant`)=== '363726.91','USD 1099 converts to LKR 363726.91')
check(sql(`USE ${valid};SELECT stock_quantity FROM variant`)==='2','conversion does not change stock')
check(sql(`USE ${valid};SELECT unit_price FROM order_item`)==='2316.73','historical unit prices convert to two decimals')
check(sql(`USE ${valid};SELECT total_amount FROM orders`)==='9266.92','order total sums rounded unit prices')
check(sql(`USE ${valid};SELECT amount FROM payment`)==='9266.92','full payment matches converted order')
check(sql(`USE ${valid};SELECT total_revenue FROM sales_summary`)==='9266.92','summary reconciles converted historical line prices')
check(sql(`USE ${valid};SELECT original_amount FROM currency_conversion_values WHERE entity_type='order'`)==='28.00','original USD amounts retained in audit')
check(sql(`USE ${valid};SELECT COUNT(*) FROM currency_conversion_values`)==='5','all five monetary entities audited')
const converted=snapshot(valid)
run(valid);check(snapshot(valid)===converted,'second migration is a no-op')
check(sql(`USE ${valid};SELECT COUNT(*) FROM currency_conversion_log`)==='1','one migration marker prevents double conversion')
setup(invalid);sql(`USE ${invalid};UPDATE variant SET price=99999999.99;`)
const bad=snapshot(invalid);assert.throws(()=>run(invalid));check(snapshot(invalid)===bad,'overflow rejects the entire conversion')
check(sql(`USE ${invalid};SELECT COUNT(*) FROM currency_conversion_log`)==='0','rejected conversion records no success marker')
check(sql(`USE ${invalid};SELECT COUNT(*) FROM currency_conversion_values`)==='0','rejected conversion leaves no partial audit values')
sql(`USE ${invalid};UPDATE variant SET price=1099;UPDATE orders SET total_amount=29;`)
const mismatched=snapshot(invalid);assert.throws(()=>run(invalid));check(snapshot(invalid)===mismatched,'inconsistent original order totals are refused without writes')
console.log('PASS '+count+' currency conversion assertions; isolated schemas retained for inspection')
