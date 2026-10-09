-- BrightBuy catalogue database roles (SRS SEC-5, SEC-7, BR-14), MySQL 8.0.19+.
-- Run as an administrator after 06 and 08. Safe to rerun.
-- Creates two roles and their grants. It creates no login accounts and stores
-- no passwords: the administrator creates accounts and assigns a role (see end).
--
-- The catalogue view and routines use SQL SECURITY INVOKER, so a caller needs
-- both EXECUTE on the routine and the table privileges the routine uses.
USE brightbuy;

CREATE ROLE IF NOT EXISTS 'brightbuy_catalogue_reader', 'brightbuy_catalogue_maintainer';
GRANT EXECUTE ON PROCEDURE brightbuy.sp_catalogue_create_product_with_variant TO 'brightbuy_catalogue_maintainer';

-- Storefront/API account: read-only browsing, search and product detail.
GRANT SELECT ON brightbuy.category                  TO 'brightbuy_catalogue_reader';
GRANT SELECT ON brightbuy.product                   TO 'brightbuy_catalogue_reader';
GRANT SELECT ON brightbuy.product_category          TO 'brightbuy_catalogue_reader';
GRANT SELECT ON brightbuy.variant                   TO 'brightbuy_catalogue_reader';
GRANT SELECT ON brightbuy.catalogue_public_variants TO 'brightbuy_catalogue_reader';
GRANT EXECUTE ON PROCEDURE brightbuy.sp_catalogue_search         TO 'brightbuy_catalogue_reader';
GRANT EXECUTE ON PROCEDURE brightbuy.sp_catalogue_categories     TO 'brightbuy_catalogue_reader';
GRANT EXECUTE ON PROCEDURE brightbuy.sp_catalogue_product_detail TO 'brightbuy_catalogue_reader';

-- Warehouse-staff account: everything the reader has, plus catalogue upkeep.
-- No DELETE on product or category: products are retired, never removed (BR-18).
-- No privileges on variant stock/price, orders, payments or customer data.
GRANT 'brightbuy_catalogue_reader' TO 'brightbuy_catalogue_maintainer';
GRANT INSERT, UPDATE ON brightbuy.category         TO 'brightbuy_catalogue_maintainer';
GRANT INSERT, UPDATE ON brightbuy.product          TO 'brightbuy_catalogue_maintainer';
GRANT INSERT, UPDATE, DELETE ON brightbuy.product_category TO 'brightbuy_catalogue_maintainer';
GRANT EXECUTE ON PROCEDURE brightbuy.sp_catalogue_create_category    TO 'brightbuy_catalogue_maintainer';
GRANT EXECUTE ON PROCEDURE brightbuy.sp_catalogue_update_category    TO 'brightbuy_catalogue_maintainer';
GRANT EXECUTE ON PROCEDURE brightbuy.sp_catalogue_create_product     TO 'brightbuy_catalogue_maintainer';
GRANT EXECUTE ON PROCEDURE brightbuy.sp_catalogue_update_product     TO 'brightbuy_catalogue_maintainer';
GRANT EXECUTE ON PROCEDURE brightbuy.sp_catalogue_set_product_active TO 'brightbuy_catalogue_maintainer';
GRANT EXECUTE ON PROCEDURE brightbuy.sp_catalogue_assign_category    TO 'brightbuy_catalogue_maintainer';
GRANT EXECUTE ON PROCEDURE brightbuy.sp_catalogue_unassign_category  TO 'brightbuy_catalogue_maintainer';

-- Account setup is done by the administrator, outside version control.
-- Choose your own account names and passwords; never commit them:
--
--   CREATE USER 'catalogue_app'@'localhost' IDENTIFIED BY '<choose a password>';
--   GRANT 'brightbuy_catalogue_reader' TO 'catalogue_app'@'localhost';
--   SET DEFAULT ROLE 'brightbuy_catalogue_reader' TO 'catalogue_app'@'localhost';
--
-- Use 'brightbuy_catalogue_maintainer' in the same way for a warehouse-staff
-- account. Check the result with: SHOW GRANTS FOR 'catalogue_app'@'localhost'
-- USING 'brightbuy_catalogue_reader';
