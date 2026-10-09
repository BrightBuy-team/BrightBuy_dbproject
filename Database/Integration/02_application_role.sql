-- Application role: row access and routines only, never DBA/schema privileges.
-- Provision an actual account and secret outside source control, grant this role,
-- and SET DEFAULT ROLE. Browser roles are independently enforced by Spring.
USE brightbuy;
CREATE ROLE IF NOT EXISTS 'brightbuy_application';
GRANT SELECT, INSERT, UPDATE ON brightbuy.* TO 'brightbuy_application';
GRANT DELETE ON brightbuy.product_category TO 'brightbuy_application';
GRANT EXECUTE ON brightbuy.* TO 'brightbuy_application';
