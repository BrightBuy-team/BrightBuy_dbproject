-- Application role: row access and routines only, never DBA/schema privileges.
-- Provision an actual account and secret outside source control, grant this role,
-- and SET DEFAULT ROLE. Browser roles are independently enforced by Spring.
USE brightbuy;
CREATE ROLE IF NOT EXISTS 'brightbuy_application';
-- Rebuild this module-owned role so an earlier broad grant cannot survive.
REVOKE ALL PRIVILEGES, GRANT OPTION FROM 'brightbuy_application';
GRANT SELECT ON brightbuy.* TO 'brightbuy_application';
GRANT INSERT, UPDATE ON brightbuy.category TO 'brightbuy_application';
GRANT INSERT, UPDATE ON brightbuy.product TO 'brightbuy_application';
GRANT INSERT, UPDATE ON brightbuy.product_category TO 'brightbuy_application';
GRANT INSERT, UPDATE ON brightbuy.variant TO 'brightbuy_application';
GRANT INSERT, UPDATE ON brightbuy.customer TO 'brightbuy_application';
GRANT INSERT, UPDATE ON brightbuy.employee TO 'brightbuy_application';
GRANT INSERT ON brightbuy.login_attempts TO 'brightbuy_application';
GRANT INSERT, UPDATE ON brightbuy.orders TO 'brightbuy_application';
GRANT INSERT ON brightbuy.order_item TO 'brightbuy_application';
GRANT INSERT, UPDATE ON brightbuy.delivery TO 'brightbuy_application';
GRANT INSERT, UPDATE ON brightbuy.payment TO 'brightbuy_application';
GRANT INSERT ON brightbuy.report_access_log TO 'brightbuy_application';
GRANT DELETE ON brightbuy.product_category TO 'brightbuy_application';
GRANT EXECUTE ON brightbuy.* TO 'brightbuy_application';
-- sales_summary and both audit tables are written only by definer routines/triggers.
