-- ========================================
-- Database Creation and User Management
-- ========================================

-- Create database
CREATE DATABASE "05-abd-crud-postgres";

-- Create users
CREATE USER HR WITH PASSWORD 'HR';
CREATE USER COOT WITH PASSWORD 'COOT';
CREATE USER CDPC WITH PASSWORD 'CDPC';

THROW EXCEPTION 'HASTA AQUÍ DEBE EJECUTARSE ESTE SCRIPT Y LUEGO DEBE CONECTARSE A LA BASE DE DATOS "05-abd-crud-postgres" PARA EJECUTAR EL RESTO DEL SCRIPT';
-- ========================================
-- 1. Tabla: regions
-- ========================================
CREATE TABLE regions (
    region_id SERIAL PRIMARY KEY,
    region_name VARCHAR(50) NOT NULL
);

INSERT INTO regions (region_id, region_name) VALUES 
(1, 'Europe'),
(2, 'Americas'),
(3, 'Asia'),
(4, 'Middle East and Africa'),
(5, 'Oceania');

-- ========================================
-- 2. Tabla: countries
-- ========================================
CREATE TABLE countries (
    country_id VARCHAR(2) PRIMARY KEY,
    country_name VARCHAR(40) NOT NULL,
    region_id INTEGER REFERENCES regions(region_id)
);

INSERT INTO countries (country_id, country_name, region_id) VALUES 
('IT', 'Italy', 1),
('US', 'United States of America', 2),
('IN', 'India', 3),
('SA', 'Saudi Arabia', 4),
('AU', 'Australia', 5);

-- ========================================
-- 3. Tabla: locations
-- ========================================
CREATE TABLE locations (
    location_id SERIAL PRIMARY KEY,
    address VARCHAR(255) NOT NULL,
    postal_code VARCHAR(20),
    city VARCHAR(50),
    state VARCHAR(50),
    country_id VARCHAR(2) REFERENCES countries(country_id)
);

INSERT INTO locations (location_id, address, postal_code, city, state, country_id) VALUES
(1, 'Via Delle Capeletti 52', '00198', 'Roma', NULL, 'IT'),
(2, '835 Heister Ln', '19605', 'Reading', NULL, 'US'),
(3, '5643 N 5Th St', '19137', 'Philadelphia', NULL, 'US'),
(4, 'Ruella Delle Spiriti', '00198', 'Roma', NULL, 'IT'),
(5, 'Via Del Disegno 194', '00198', 'Roma', NULL, 'IT');

-- ========================================
-- 4. Tabla: warehouses
-- ========================================
CREATE TABLE warehouses (
    warehouse_id SERIAL PRIMARY KEY,
    warehouse_name VARCHAR(255),
    location_id INTEGER REFERENCES locations(location_id)
);

INSERT INTO warehouses (warehouse_id, warehouse_name, location_id) VALUES
(1, 'Roma Warehouse', 1),
(2, 'Reading Warehouse', 2),
(3, 'Philadelphia Warehouse', 3),
(4, 'Second Roma Warehouse', 4),
(5, 'Third Roma Warehouse', 5);

-- ========================================
-- 5. Tabla: employees
-- ========================================
CREATE TABLE employees (
    employee_id SERIAL PRIMARY KEY,
    first_name VARCHAR(255) NOT NULL,
    last_name VARCHAR(255) NOT NULL,
    email VARCHAR(255) NOT NULL UNIQUE,
    phone VARCHAR(50) NOT NULL,
    hire_date DATE NOT NULL,
    manager_id INTEGER REFERENCES employees(employee_id),
    job_title VARCHAR(255) NOT NULL
);

INSERT INTO employees (employee_id, first_name, last_name, email, phone, hire_date, manager_id, job_title) VALUES
(1, 'Jude', 'Rivera', 'jude.rivera@example.com', '515.123.4568', '2016-09-21', NULL, 'Administration Vice President'),
(2, 'Blake', 'Cooper', 'blake.cooper@example.com', '515.123.4569', '2016-01-13', 1, 'Administration Vice President'),
(3, 'Rose', 'Stephens', 'rose.stephens@example.com', '515.123.8080', '2016-06-07', 2, 'Accounting Manager'),
(4, 'Louie', 'Richardson', 'louie.richardson@example.com', '590.423.4567', '2016-01-03', 3, 'Programmer'),
(5, 'Nathan', 'Cox', 'nathan.cox@example.com', '590.423.4568', '2016-05-21', 4, 'Programmer');

-- ========================================
-- 6. Tabla: customers
-- ========================================
CREATE TABLE customers (
    customer_id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    address VARCHAR(255),
    credit_limit NUMERIC(10,2),
    website VARCHAR(255)
);

INSERT INTO customers (customer_id, name, address, credit_limit, website) VALUES
(108, 'Cardinal Health', 'Via Delle Capeletti 52, Roma, ', 1400, 'http://www.cardinal.com'),
(109, 'Express Scripts Holding', '100 N Peach St, Philadelphia, PA', 1400, 'http://www.express-scripts.com'),
(110, 'J.P. Morgan Chase', '835 Heister Ln, Reading, PA', 1400, 'http://www.jpmorganchase.com'),
(251, 'Yum Brands', 'Ruella Delle Spiriti, Roma, ', 500, 'http://www.yum.com'),
(252, 'Texas Instruments', 'Via Del Disegno 194, Roma, ', 500, 'http://www.ti.com');

-- ========================================
-- 7. Tabla: contacts
-- ========================================
CREATE TABLE contacts (
    contact_id SERIAL PRIMARY KEY,
    first_name VARCHAR(255) NOT NULL,
    last_name VARCHAR(255) NOT NULL,
    email VARCHAR(255) NOT NULL UNIQUE,
    phone VARCHAR(20),
    customer_id INTEGER REFERENCES customers(customer_id)
);

INSERT INTO contacts (contact_id, first_name, last_name, email, phone, customer_id) VALUES
(108, 'Ronny', 'Sykes', 'ronny.sykes@cardinal.com', '+1 814 123 4706', 108),
(109, 'Ocie', 'Walton', 'ocie.walton@express-scripts.com', '+1 215 123 4708', 109),
(110, 'Reva', 'Fuller', 'reva.fuller@jpmorganchase.com', '+1 610 123 4714', 110),
(111, 'John', 'Doe', 'john.doe@yum.com', '+1 610 123 4715', 251),
(112, 'Jane', 'Smith', 'jane.smith@ti.com', '+1 610 123 4716', 252);

-- ========================================
-- 8. Tabla: orders
-- ========================================
CREATE TABLE orders (
    order_id SERIAL PRIMARY KEY,
    customer_id INTEGER NOT NULL REFERENCES customers(customer_id),
    status VARCHAR(20) NOT NULL,
    salesman_id INTEGER REFERENCES employees(employee_id),
    order_date DATE NOT NULL
);

INSERT INTO orders (order_id, customer_id, status, salesman_id, order_date) VALUES
(15, 108, 'Shipped', NULL, '2017-09-27'),
(16, 109, 'Pending', NULL, '2016-09-27'),
(17, 110, 'Shipped', NULL, '2017-09-27'),
(18, 251, 'Shipped', NULL, '2016-08-16'),
(19, 252, 'Shipped', NULL, '2016-05-27');

-- ========================================
-- 9. Tabla: product_categories
-- ========================================
CREATE TABLE product_categories (
    category_id SERIAL PRIMARY KEY,
    category_name VARCHAR(255)
);

INSERT INTO product_categories (category_id, category_name) VALUES
(1, 'Peripherals'),
(2, 'Displays'),
(3, 'Computers'),
(4, 'Accessories');

-- ========================================
-- 10. Tabla: products
-- ========================================
CREATE TABLE products (
    product_id SERIAL PRIMARY KEY,
    product_name VARCHAR(255) NOT NULL,
    description TEXT,
    standard_cost NUMERIC(10,2),
    list_price NUMERIC(10,2),
    category_id INTEGER REFERENCES product_categories(category_id)
);

INSERT INTO products (product_id, product_name, description, standard_cost, list_price, category_id) VALUES
(174, 'Mouse Wireless', 'Wireless Mouse', 10.50, 14.99, 1),
(175, 'Keyboard USB', 'USB Keyboard', 15.00, 19.99, 1),
(182, 'Monitor 24"', 'LCD Monitor 24"', 100.00, 149.99, 2),
(184, 'Laptop', 'Portable Laptop Computer', 500.00, 799.99, 3),
(185, 'Printer Ink', 'Ink Cartridge', 10.00, 14.99, 4);

-- ========================================
-- 11. Tabla: order_items
-- ========================================
CREATE TABLE order_items (
    order_id INTEGER REFERENCES orders(order_id),
    product_id INTEGER REFERENCES products(product_id),
    quantity INTEGER NOT NULL,
    unit_price NUMERIC(10,2) NOT NULL,
    PRIMARY KEY (order_id, product_id)
);

INSERT INTO order_items (order_id, product_id, quantity, unit_price) VALUES
(15, 174, 5, 14.99),
(15, 175, 2, 19.99),
(16, 182, 3, 24.99),
(17, 184, 4, 12.99),
(18, 185, 1, 9.99);

-- Grant privileges after tables are created (will be executed after all table creation)
-- HR: Read-only access
GRANT CONNECT ON DATABASE "05-abd-crud-postgres" TO HR;
GRANT USAGE ON SCHEMA public TO HR;
GRANT SELECT ON ALL TABLES IN SCHEMA public TO HR;
GRANT SELECT ON ALL SEQUENCES IN SCHEMA public TO HR;

-- COOT: Read, Insert, Update access
GRANT CONNECT ON DATABASE "05-abd-crud-postgres" TO COOT;
GRANT USAGE ON SCHEMA public TO COOT;
GRANT SELECT, INSERT, UPDATE ON ALL TABLES IN SCHEMA public TO COOT;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO COOT;

-- CDPC: All privileges
GRANT CONNECT ON DATABASE "05-abd-crud-postgres" TO CDPC;
GRANT USAGE ON SCHEMA public TO CDPC;
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO CDPC;
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO CDPC;

-- Ensure future tables also get the appropriate permissions
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT ON TABLES TO HR;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT ON SEQUENCES TO HR;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT, INSERT, UPDATE ON TABLES TO COOT;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT USAGE, SELECT ON SEQUENCES TO COOT;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL PRIVILEGES ON TABLES TO CDPC;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL PRIVILEGES ON SEQUENCES TO CDPC;
