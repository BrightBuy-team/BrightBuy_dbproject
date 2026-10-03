BrightBuy Project File Structure
This document outlines the file and directory structure of the BrightBuy project, along with a brief description of each component.

Root Directory
Backend/: Contains the Java Spring Boot backend application.
Database/: Contains SQL scripts for database schemas, procedures, and initial seed data, organized by domain.
Docs/: Contains project documentation.
Frontend/: Contains the React-based frontend application.
work_log.md: A log file tracking the work done on the project.
1. Backend (/Backend)
The backend is a Java Spring Boot application managed with Maven.

src/main/: The main Java source code for the backend API.
src/test/: Unit and integration tests for the backend.
CATALOGUE_API.md: Documentation specifying the Catalogue API endpoints and usage.
README-team.txt: Notes and instructions specifically for the backend development team.
pom.xml: Maven Project Object Model file, defining dependencies and build configurations.
mvnw / mvnw.cmd: Maven wrapper scripts for Unix and Windows, ensuring the correct Maven version is used without requiring a local installation.
target/: Automatically generated directory containing the compiled classes and packaged application (e.g., .jar files).
2. Database (/Database)
The database folder contains all SQL scripts required to initialize, populate, and test the MySQL database. It is divided into submodules:

2.1 Catalogue (/Database/Catalogue)
Scripts for the product catalogue.

00_create_database.sql: Initial script to create the main database schema.
01_catalogue_tables.sql: DDL for creating the catalogue tables (products, categories, etc.).
02_catalogue_indexes.sql: Scripts for adding indexes to optimize catalogue queries.
03_catalogue_seed_data.sql: Initial sample data for the catalogue.
04_catalogue_queries.sql: Common or complex SQL queries used by the catalogue module.
05_variant_integration.sql & 05b_catalogue_variant_seed.sql: Scripts for handling product variants and their seed data.
06_catalogue_procedures.sql: Stored procedures and functions for the catalogue.
07_catalogue_tests.sql: SQL test scripts for verifying catalogue logic.
PROCEDURES.md & README.md: Documentation for the catalogue database components.
2.2 Checkout (/Database/Checkout)
Scripts for the shopping cart and checkout process.

01_checkout_schema.sql: DDL for creating checkout-related tables (orders, cart items).
02_checkout_procedures.sql: Stored procedures for handling checkout logic.
03_checkout_seed_data.sql: Sample data for testing the checkout process.
04_checkout_test.sql: SQL test scripts for checkout.
2.3 Inventory (/Database/Inventory)
Scripts for inventory management and delivery.

Inventory_Delivery_DDL.sql: Schema definition for inventory and delivery tracking.
Inventory_Delivery_logic.sql: Stored procedures and triggers for inventory updates.
Inventory_Delivery_sample_data.sql: Seed data for inventory and deliveries.
2.4 Management Reporting (/Database/Management reporting)
Scripts for generating business reports.

01_management_reporting_tables.sql: Tables for storing aggregated reporting data.
02_management_reporting_procedures.sql: Procedures to generate and populate reports.
README.md: Documentation for the reporting module.
2.5 User and Auth (/Database/User and Auth)
Scripts for user management and authentication.

user auth schema.sql: Tables for users, roles, and authentication details.
user auth procedures.sql: Logic for user registration, login, and access control.
user auth seed.sql: Sample users and roles for testing.
user auth tests.sql: Tests for authentication logic.
README.md: Documentation for the user auth module.
3. Frontend (/Frontend)
The frontend is built using React, TypeScript, and Vite.

src/: Contains the main React source code (components, hooks, pages, etc.).
App.tsx & main.tsx: Entry points for the React application.
App.css & index.css: Global stylesheets.
catalogue/: Components specific to the catalogue UI.
public/: Static assets that are served directly (e.g., favicon.svg, icons.svg).
tests/: Contains UI tests and integration tests (e.g., .test.mjs files).
CATALOGUE_UI.md: Documentation detailing the frontend UI architecture for the catalogue.
README.md & README-team.txt: General frontend documentation and team notes.
package.json & package-lock.json: NPM configuration detailing dependencies and scripts.
vite.config.ts & vite.catalogue.config.ts: Vite configuration files for building and serving the app.
tsconfig.*.json: TypeScript configuration files defining compiler options.
eslint.config.js: ESLint configuration for code linting and formatting rules.
4. Docs (/Docs)
Documentation specific to developer environments and general guidelines.

Induru_dev.md: Developer-specific notes and setup instructions for Induru.
file_structure.md: This document, outlining the project structure.