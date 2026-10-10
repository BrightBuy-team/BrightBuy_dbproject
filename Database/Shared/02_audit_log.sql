-- =========================================================
-- BrightBuy | Shared | 02 Audit log (SEC-11)
-- Tables: audit_log
-- Run after the seeds, so only real maintenance is recorded.
-- Safe to rerun: the table is kept, the triggers are replaced.
--
-- Records who changed what, and when, for administrative and warehouse
-- actions: products, categories, category assignments, variant details and
-- employee accounts. Stock quantities have their own trail, variant_audit
-- (SAF-7). The actor is the signed-in user that the backend puts in
-- @brightbuy_actor, or the database account for direct SQL.
-- Rows are written only by these triggers; the application role cannot
-- insert, change or delete them.
-- =========================================================
USE brightbuy;

CREATE TABLE IF NOT EXISTS audit_log (
    audit_id    BIGINT AUTO_INCREMENT PRIMARY KEY,
    entity_type VARCHAR(30)  NOT NULL,   -- product, category, product_category, variant, employee
    entity_id   INT          NOT NULL,   -- product_id for a category assignment
    action      VARCHAR(10)  NOT NULL,   -- INSERT, UPDATE or DELETE
    actor       VARCHAR(100) NOT NULL,
    changed_at  TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
    old_values  JSON,
    new_values  JSON,
    INDEX idx_audit_entity (entity_type, entity_id),
    INDEX idx_audit_changed_at (changed_at)
) ENGINE=InnoDB;

DROP TRIGGER IF EXISTS audit_product_insert;
DROP TRIGGER IF EXISTS audit_product_update;
DROP TRIGGER IF EXISTS audit_product_delete;
DROP TRIGGER IF EXISTS audit_category_insert;
DROP TRIGGER IF EXISTS audit_category_update;
DROP TRIGGER IF EXISTS audit_category_delete;
DROP TRIGGER IF EXISTS audit_product_category_insert;
DROP TRIGGER IF EXISTS audit_product_category_update;
DROP TRIGGER IF EXISTS audit_product_category_delete;
DROP TRIGGER IF EXISTS audit_variant_insert;
DROP TRIGGER IF EXISTS audit_variant_update;
DROP TRIGGER IF EXISTS audit_employee_insert;
DROP TRIGGER IF EXISTS audit_employee_update;

DELIMITER //

-- ---------------- product ----------------
CREATE TRIGGER audit_product_insert AFTER INSERT ON product FOR EACH ROW
    INSERT INTO audit_log (entity_type, entity_id, action, actor, old_values, new_values)
    VALUES ('product', NEW.product_id, 'INSERT', COALESCE(@brightbuy_actor, USER()), NULL,
            JSON_OBJECT('sku', NEW.sku, 'name', NEW.name, 'description', NEW.description,
                        'image_url', NEW.image_url, 'is_active', NEW.is_active))//

CREATE TRIGGER audit_product_update AFTER UPDATE ON product FOR EACH ROW
    INSERT INTO audit_log (entity_type, entity_id, action, actor, old_values, new_values)
    VALUES ('product', NEW.product_id, 'UPDATE', COALESCE(@brightbuy_actor, USER()),
            JSON_OBJECT('sku', OLD.sku, 'name', OLD.name, 'description', OLD.description,
                        'image_url', OLD.image_url, 'is_active', OLD.is_active),
            JSON_OBJECT('sku', NEW.sku, 'name', NEW.name, 'description', NEW.description,
                        'image_url', NEW.image_url, 'is_active', NEW.is_active))//

CREATE TRIGGER audit_product_delete AFTER DELETE ON product FOR EACH ROW
    INSERT INTO audit_log (entity_type, entity_id, action, actor, old_values, new_values)
    VALUES ('product', OLD.product_id, 'DELETE', COALESCE(@brightbuy_actor, USER()),
            JSON_OBJECT('sku', OLD.sku, 'name', OLD.name, 'description', OLD.description,
                        'image_url', OLD.image_url, 'is_active', OLD.is_active), NULL)//

-- ---------------- category ----------------
CREATE TRIGGER audit_category_insert AFTER INSERT ON category FOR EACH ROW
    INSERT INTO audit_log (entity_type, entity_id, action, actor, old_values, new_values)
    VALUES ('category', NEW.category_id, 'INSERT', COALESCE(@brightbuy_actor, USER()), NULL,
            JSON_OBJECT('name', NEW.name, 'description', NEW.description,
                        'parent_category_id', NEW.parent_category_id, 'is_active', NEW.is_active))//

CREATE TRIGGER audit_category_update AFTER UPDATE ON category FOR EACH ROW
    INSERT INTO audit_log (entity_type, entity_id, action, actor, old_values, new_values)
    VALUES ('category', NEW.category_id, 'UPDATE', COALESCE(@brightbuy_actor, USER()),
            JSON_OBJECT('name', OLD.name, 'description', OLD.description,
                        'parent_category_id', OLD.parent_category_id, 'is_active', OLD.is_active),
            JSON_OBJECT('name', NEW.name, 'description', NEW.description,
                        'parent_category_id', NEW.parent_category_id, 'is_active', NEW.is_active))//

CREATE TRIGGER audit_category_delete AFTER DELETE ON category FOR EACH ROW
    INSERT INTO audit_log (entity_type, entity_id, action, actor, old_values, new_values)
    VALUES ('category', OLD.category_id, 'DELETE', COALESCE(@brightbuy_actor, USER()),
            JSON_OBJECT('name', OLD.name, 'description', OLD.description,
                        'parent_category_id', OLD.parent_category_id, 'is_active', OLD.is_active), NULL)//

-- ---------------- product_category ----------------
CREATE TRIGGER audit_product_category_insert AFTER INSERT ON product_category FOR EACH ROW
    INSERT INTO audit_log (entity_type, entity_id, action, actor, old_values, new_values)
    VALUES ('product_category', NEW.product_id, 'INSERT', COALESCE(@brightbuy_actor, USER()), NULL,
            JSON_OBJECT('product_id', NEW.product_id, 'category_id', NEW.category_id))//

CREATE TRIGGER audit_product_category_update AFTER UPDATE ON product_category FOR EACH ROW
    INSERT INTO audit_log (entity_type, entity_id, action, actor, old_values, new_values)
    VALUES ('product_category', NEW.product_id, 'UPDATE', COALESCE(@brightbuy_actor, USER()),
            JSON_OBJECT('product_id', OLD.product_id, 'category_id', OLD.category_id),
            JSON_OBJECT('product_id', NEW.product_id, 'category_id', NEW.category_id))//

CREATE TRIGGER audit_product_category_delete AFTER DELETE ON product_category FOR EACH ROW
    INSERT INTO audit_log (entity_type, entity_id, action, actor, old_values, new_values)
    VALUES ('product_category', OLD.product_id, 'DELETE', COALESCE(@brightbuy_actor, USER()),
            JSON_OBJECT('product_id', OLD.product_id, 'category_id', OLD.category_id), NULL)//

-- ---------------- variant (details and price; stock is in variant_audit) ----------------
CREATE TRIGGER audit_variant_insert AFTER INSERT ON variant FOR EACH ROW
    INSERT INTO audit_log (entity_type, entity_id, action, actor, old_values, new_values)
    VALUES ('variant', NEW.variant_id, 'INSERT', COALESCE(@brightbuy_actor, USER()), NULL,
            JSON_OBJECT('product_id', NEW.product_id, 'variant_name', NEW.variant_name, 'colour', NEW.colour,
                        'memory_size', NEW.memory_size, 'price', NEW.price))//

CREATE TRIGGER audit_variant_update AFTER UPDATE ON variant FOR EACH ROW
BEGIN
    IF NOT (OLD.variant_name <=> NEW.variant_name AND OLD.colour <=> NEW.colour
            AND OLD.memory_size <=> NEW.memory_size AND OLD.price <=> NEW.price
            AND OLD.product_id <=> NEW.product_id) THEN
        INSERT INTO audit_log (entity_type, entity_id, action, actor, old_values, new_values)
        VALUES ('variant', NEW.variant_id, 'UPDATE', COALESCE(@brightbuy_actor, USER()),
                JSON_OBJECT('product_id', OLD.product_id, 'variant_name', OLD.variant_name, 'colour', OLD.colour,
                            'memory_size', OLD.memory_size, 'price', OLD.price),
                JSON_OBJECT('product_id', NEW.product_id, 'variant_name', NEW.variant_name, 'colour', NEW.colour,
                            'memory_size', NEW.memory_size, 'price', NEW.price));
    END IF;
END//

-- ---------------- employee (password hashes are never copied here) ----------------
CREATE TRIGGER audit_employee_insert AFTER INSERT ON employee FOR EACH ROW
    INSERT INTO audit_log (entity_type, entity_id, action, actor, old_values, new_values)
    VALUES ('employee', NEW.employee_id, 'INSERT', COALESCE(@brightbuy_actor, USER()), NULL,
            JSON_OBJECT('email', NEW.email, 'role', NEW.role, 'is_active', NEW.is_active))//

CREATE TRIGGER audit_employee_update AFTER UPDATE ON employee FOR EACH ROW
    INSERT INTO audit_log (entity_type, entity_id, action, actor, old_values, new_values)
    VALUES ('employee', NEW.employee_id, 'UPDATE', COALESCE(@brightbuy_actor, USER()),
            JSON_OBJECT('email', OLD.email, 'role', OLD.role, 'is_active', OLD.is_active),
            JSON_OBJECT('email', NEW.email, 'role', NEW.role, 'is_active', NEW.is_active,
                        'password_changed', NOT (OLD.password_hash <=> NEW.password_hash)))//

DELIMITER ;
