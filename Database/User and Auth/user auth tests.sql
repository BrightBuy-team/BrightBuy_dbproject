-- BrightBuy | User & Auth | 04 Tests
-- Run after 01, 02 and 03. Lines marked "MUST FAIL" should return an error.

-- 1. Register a new customer (expect a new id)
CALL sp_register_customer('Test','User','test.user@example.com','$2b$10$hash','555-0300','1 Main St',1,@cid);
SELECT @cid AS new_customer_id;

-- 2. Duplicate email (MUST FAIL: Email already registered)
CALL sp_register_customer('Test','Again','test.user@example.com','$2b$10$hash','555-0301','2 Main St',1,@cid);

-- 3. Invalid email format (MUST FAIL: CHECK constraint)
CALL sp_register_customer('Bad','Email','not-an-email','$2b$10$hash','555','x',1,@cid);

-- 4. Invalid city (MUST FAIL: foreign key)
CALL sp_register_customer('Bad','City','badcity@example.com','$2b$10$hash','555','x',999,@cid);

-- 5. Invalid employee role (MUST FAIL: CHECK constraint)
CALL sp_create_employee('Bad','Role','badrole@brightbuy.com','$2b$10$hash','555','Cashier',@eid);

-- 6. Valid employee
CALL sp_create_employee('New','Staff','newstaff@brightbuy.com','$2b$10$hash','555','WarehouseStaff',@eid);
SELECT @eid AS new_employee_id;

-- 7. Login lookups
CALL sp_get_customer_login('abrahaml@example.com');   -- returns id + hash
CALL sp_get_customer_login('nobody@example.com');     -- returns empty set
CALL sp_get_employee_login('manager@brightbuy.com');  -- returns id + hash + role

-- 8. Rate limiting: log 5 failures then count
CALL sp_log_login('abrahaml@example.com','customer',FALSE);
CALL sp_log_login('abrahaml@example.com','customer',FALSE);
CALL sp_log_login('abrahaml@example.com','customer',FALSE);
CALL sp_log_login('abrahaml@example.com','customer',FALSE);
CALL sp_log_login('abrahaml@example.com','customer',FALSE);
SELECT fn_recent_failures('abrahaml@example.com') AS failures;   -- expect 5

-- 9. Role helper
SELECT fn_employee_has_role(3,'Management') AS is_manager;       -- expect 1 (seed id 3)
SELECT fn_employee_has_role(2,'Management') AS is_manager;       -- expect 0

-- 10. Referential protection: customer with orders cannot be deleted
-- (after running a checkout for customer 1)
-- DELETE FROM customer WHERE customer_id = 1;                   -- MUST FAIL (ON DELETE RESTRICT chain)
