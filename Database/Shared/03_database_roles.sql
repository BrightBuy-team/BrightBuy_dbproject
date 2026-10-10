-- =========================================================
-- BrightBuy | Shared | 03 Database roles (SEC-7)
-- Run as an administrator after every table and routine exists. Safe to rerun.
--
-- Creates roles only. It creates no login accounts and holds no passwords:
-- the administrator creates each account privately and grants it one role
-- (example at the end of this file).
--
--   brightbuy_application       the backend service account
--   brightbuy_catalogue_reader  read-only catalogue access (browsing, tests)
--
-- The five user classes (guest, customer, warehouse staff, management,
-- administrator) are enforced by the backend for every request (SEC-5); the
-- database limits what the backend account itself may do.
-- =========================================================
USE brightbuy;

CREATE ROLE IF NOT EXISTS 'brightbuy_application', 'brightbuy_catalogue_reader';
DROP ROLE IF EXISTS 'brightbuy_catalogue_maintainer'; -- retired: staff work goes through the backend

-- Rebuild both roles from nothing so an earlier, broader grant cannot survive.
REVOKE ALL PRIVILEGES, GRANT OPTION FROM 'brightbuy_application';
REVOKE ALL PRIVILEGES, GRANT OPTION FROM 'brightbuy_catalogue_reader';

-- ---------------------------------------------------------
-- brightbuy_application
-- Orders, payments, deliveries, accounts, sign-in attempts, password resets,
-- queued emails, stock and reports are reached only through stored routines.
-- The role has no schema privileges, cannot read password hashes, reset codes
-- or queued messages, and cannot touch either audit table.
-- ---------------------------------------------------------
GRANT EXECUTE ON brightbuy.* TO 'brightbuy_application';

-- Read access used by storefront, order-history, delivery and staff screens.
GRANT SELECT ON brightbuy.category                  TO 'brightbuy_application';
GRANT SELECT ON brightbuy.product                   TO 'brightbuy_application';
GRANT SELECT ON brightbuy.product_category          TO 'brightbuy_application';
GRANT SELECT ON brightbuy.variant                   TO 'brightbuy_application';
GRANT SELECT ON brightbuy.catalogue_public_variants TO 'brightbuy_application';
GRANT SELECT ON brightbuy.warehouse                 TO 'brightbuy_application';
GRANT SELECT ON brightbuy.city                      TO 'brightbuy_application';
GRANT SELECT ON brightbuy.orders                    TO 'brightbuy_application';
GRANT SELECT ON brightbuy.order_item                TO 'brightbuy_application';
GRANT SELECT ON brightbuy.delivery                  TO 'brightbuy_application';
GRANT SELECT ON brightbuy.payment                   TO 'brightbuy_application';

-- A customer's own delivery address: every column except the password hash.
GRANT SELECT (customer_id, first_name, last_name, email, phone, address_line, city_id, created_at),
      UPDATE (address_line, city_id)
      ON brightbuy.customer TO 'brightbuy_application';

-- Catalogue maintenance routines run with the caller's privileges.
GRANT INSERT, UPDATE         ON brightbuy.category         TO 'brightbuy_application';
GRANT INSERT, UPDATE         ON brightbuy.product          TO 'brightbuy_application';
GRANT INSERT, UPDATE, DELETE ON brightbuy.product_category TO 'brightbuy_application';
GRANT INSERT                 ON brightbuy.variant          TO 'brightbuy_application';

-- ---------------------------------------------------------
-- brightbuy_catalogue_reader
-- Browsing, search and product detail only. No writes of any kind.
-- ---------------------------------------------------------
GRANT SELECT ON brightbuy.category                  TO 'brightbuy_catalogue_reader';
GRANT SELECT ON brightbuy.product                   TO 'brightbuy_catalogue_reader';
GRANT SELECT ON brightbuy.product_category          TO 'brightbuy_catalogue_reader';
GRANT SELECT ON brightbuy.variant                   TO 'brightbuy_catalogue_reader';
GRANT SELECT ON brightbuy.catalogue_public_variants TO 'brightbuy_catalogue_reader';
GRANT EXECUTE ON PROCEDURE brightbuy.sp_catalogue_search         TO 'brightbuy_catalogue_reader';
GRANT EXECUTE ON PROCEDURE brightbuy.sp_catalogue_categories     TO 'brightbuy_catalogue_reader';
GRANT EXECUTE ON PROCEDURE brightbuy.sp_catalogue_product_detail TO 'brightbuy_catalogue_reader';

-- Creating the backend account (administrator, outside version control):
--
--   CREATE USER 'brightbuy_app'@'%' IDENTIFIED BY '<choose a private password>';
--   GRANT 'brightbuy_application' TO 'brightbuy_app'@'%';
--   SET DEFAULT ROLE 'brightbuy_application' TO 'brightbuy_app'@'%';
--
-- Check it with: SHOW GRANTS FOR 'brightbuy_app'@'%' USING 'brightbuy_application';
