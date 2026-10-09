USE brightbuy;
CREATE TABLE IF NOT EXISTS catalogue_audit (
 audit_id BIGINT AUTO_INCREMENT PRIMARY KEY, entity_type VARCHAR(30) NOT NULL,
 entity_id INT NOT NULL, action VARCHAR(10) NOT NULL, actor VARCHAR(100) NOT NULL,
 changed_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP, old_values JSON, new_values JSON
);
DELIMITER //
DROP TRIGGER IF EXISTS audit_product_insert//
CREATE TRIGGER audit_product_insert AFTER INSERT ON product FOR EACH ROW
 INSERT INTO catalogue_audit(entity_type,entity_id,action,actor,old_values,new_values)
 VALUES('product',NEW.product_id,'INSERT',COALESCE(@brightbuy_actor,USER()),NULL,JSON_OBJECT('sku',NEW.sku,'name',NEW.name,'description',NEW.description,'image_url',NEW.image_url,'is_active',NEW.is_active))//
DROP TRIGGER IF EXISTS audit_product_update//
CREATE TRIGGER audit_product_update AFTER UPDATE ON product FOR EACH ROW
 INSERT INTO catalogue_audit(entity_type,entity_id,action,actor,old_values,new_values)
 VALUES('product',NEW.product_id,'UPDATE',COALESCE(@brightbuy_actor,USER()),JSON_OBJECT('sku',OLD.sku,'name',OLD.name,'description',OLD.description,'image_url',OLD.image_url,'is_active',OLD.is_active),JSON_OBJECT('sku',NEW.sku,'name',NEW.name,'description',NEW.description,'image_url',NEW.image_url,'is_active',NEW.is_active))//
DROP TRIGGER IF EXISTS audit_product_delete//
CREATE TRIGGER audit_product_delete AFTER DELETE ON product FOR EACH ROW
 INSERT INTO catalogue_audit(entity_type,entity_id,action,actor,old_values,new_values)
 VALUES('product',OLD.product_id,'DELETE',COALESCE(@brightbuy_actor,USER()),JSON_OBJECT('sku',OLD.sku,'name',OLD.name,'description',OLD.description,'image_url',OLD.image_url,'is_active',OLD.is_active),NULL)//
DROP TRIGGER IF EXISTS audit_category_insert//
CREATE TRIGGER audit_category_insert AFTER INSERT ON category FOR EACH ROW
 INSERT INTO catalogue_audit(entity_type,entity_id,action,actor,old_values,new_values)
 VALUES('category',NEW.category_id,'INSERT',COALESCE(@brightbuy_actor,USER()),NULL,JSON_OBJECT('name',NEW.name,'description',NEW.description,'parent_category_id',NEW.parent_category_id,'is_active',NEW.is_active))//
DROP TRIGGER IF EXISTS audit_category_update//
CREATE TRIGGER audit_category_update AFTER UPDATE ON category FOR EACH ROW
 INSERT INTO catalogue_audit(entity_type,entity_id,action,actor,old_values,new_values)
 VALUES('category',NEW.category_id,'UPDATE',COALESCE(@brightbuy_actor,USER()),JSON_OBJECT('name',OLD.name,'description',OLD.description,'parent_category_id',OLD.parent_category_id,'is_active',OLD.is_active),JSON_OBJECT('name',NEW.name,'description',NEW.description,'parent_category_id',NEW.parent_category_id,'is_active',NEW.is_active))//
DROP TRIGGER IF EXISTS audit_category_delete//
CREATE TRIGGER audit_category_delete AFTER DELETE ON category FOR EACH ROW
 INSERT INTO catalogue_audit(entity_type,entity_id,action,actor,old_values,new_values)
 VALUES('category',OLD.category_id,'DELETE',COALESCE(@brightbuy_actor,USER()),JSON_OBJECT('name',OLD.name,'description',OLD.description,'parent_category_id',OLD.parent_category_id,'is_active',OLD.is_active),NULL)//
DROP TRIGGER IF EXISTS audit_product_category_insert//
CREATE TRIGGER audit_product_category_insert AFTER INSERT ON product_category FOR EACH ROW
 INSERT INTO catalogue_audit(entity_type,entity_id,action,actor,old_values,new_values)
 VALUES('product_category',NEW.product_id,'INSERT',COALESCE(@brightbuy_actor,USER()),NULL,JSON_OBJECT('product_id',NEW.product_id,'category_id',NEW.category_id))//
DROP TRIGGER IF EXISTS audit_product_category_update//
CREATE TRIGGER audit_product_category_update AFTER UPDATE ON product_category FOR EACH ROW
 INSERT INTO catalogue_audit(entity_type,entity_id,action,actor,old_values,new_values)
 VALUES('product_category',NEW.product_id,'UPDATE',COALESCE(@brightbuy_actor,USER()),JSON_OBJECT('product_id',OLD.product_id,'category_id',OLD.category_id),JSON_OBJECT('product_id',NEW.product_id,'category_id',NEW.category_id))//
DROP TRIGGER IF EXISTS audit_product_category_delete//
CREATE TRIGGER audit_product_category_delete AFTER DELETE ON product_category FOR EACH ROW
 INSERT INTO catalogue_audit(entity_type,entity_id,action,actor,old_values,new_values)
 VALUES('product_category',OLD.product_id,'DELETE',COALESCE(@brightbuy_actor,USER()),JSON_OBJECT('product_id',OLD.product_id,'category_id',OLD.category_id),NULL)//
DROP PROCEDURE IF EXISTS sp_catalogue_create_product_with_variant//
CREATE PROCEDURE sp_catalogue_create_product_with_variant(
 IN p_sku TEXT, IN p_name TEXT, IN p_description TEXT, IN p_image_url TEXT,
 IN p_category_id INT, IN p_warehouse_id INT, IN p_price DECIMAL(10,2), IN p_stock INT,
 OUT p_product_id INT)
SQL SECURITY DEFINER
BEGIN
 DECLARE EXIT HANDLER FOR SQLEXCEPTION BEGIN ROLLBACK; SET p_product_id=NULL; RESIGNAL; END;
 SET p_product_id=NULL;
 IF p_sku IS NULL OR NOT REGEXP_LIKE(TRIM(p_sku),'^[A-Za-z0-9][A-Za-z0-9._-]{0,49}$')
 OR p_name IS NULL OR CHAR_LENGTH(TRIM(p_name)) NOT BETWEEN 1 AND 150
 OR CHAR_LENGTH(p_image_url)>500 OR p_price IS NULL OR p_price<=0 OR p_stock IS NULL OR p_stock<0 THEN
 SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='Invalid product or initial variant'; END IF;
 START TRANSACTION;
 INSERT INTO product(sku,name,description,image_url) VALUES(TRIM(p_sku),TRIM(p_name),p_description,NULLIF(TRIM(p_image_url),''));
 SET p_product_id=LAST_INSERT_ID();
 INSERT INTO product_category(product_id,category_id) VALUES(p_product_id,p_category_id);
 INSERT INTO variant(product_id,warehouse_id,variant_name,price,stock_quantity)
 VALUES(p_product_id,p_warehouse_id,LEFT(TRIM(p_name),100),p_price,p_stock);
 COMMIT;
END//
DELIMITER ;
