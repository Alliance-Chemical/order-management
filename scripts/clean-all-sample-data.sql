-- Clean out ALL sample data from test database

-- Delete all product-freight links first (foreign key constraints)
DELETE FROM product_freight_links;

-- Delete all products
DELETE FROM products;

-- Delete all freight classifications
DELETE FROM freight_classifications;

-- Reset the tables to clean state
-- (keeping the schema intact for future use)