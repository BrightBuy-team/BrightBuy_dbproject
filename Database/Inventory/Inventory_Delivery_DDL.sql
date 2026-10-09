-- City Table
CREATE TABLE city (
    city_id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(100),
    is_main_city BOOLEAN
);

-- Warehouse Table
CREATE TABLE warehouse (
    warehouse_id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(100),
    location VARCHAR(255)
);

-- Variant Table (Includes Catalog details + Inventory details)
CREATE TABLE variant (
    variant_id INT AUTO_INCREMENT PRIMARY KEY,
    product_id INT, 
    warehouse_id INT,
    variant_name VARCHAR(100),
    colour VARCHAR(50),
    memory_size VARCHAR(50),
    price DECIMAL(10,2) NOT NULL CHECK (price >= 0),
    stock_quantity INT NOT NULL CHECK (stock_quantity >= 0),
    FOREIGN KEY (warehouse_id) REFERENCES warehouse(warehouse_id),
    FOREIGN KEY (product_id) REFERENCES product(product_id) -- Links to Mihisara's domain
);

-- Checkout owns the single delivery table, created after customer and orders.

-- Variant Audit Table (SAF-7) (all changes in varient stock shall be written to this table)
CREATE TABLE variant_audit (
    audit_id INT AUTO_INCREMENT PRIMARY KEY,
    variant_id INT,
    old_stock_quantity INT,
    new_stock_quantity INT,
    changed_by VARCHAR(100),
    changed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (variant_id) REFERENCES variant(variant_id)
);

-- Run the catalogue product table first. Run checkout after city and auth.
