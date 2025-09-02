-- Remove sample data that was incorrectly added

-- Delete product-freight links for sample products
DELETE FROM product_freight_links 
WHERE product_id IN (
  SELECT id FROM products 
  WHERE sku IN ('CHEM001', 'CHEM002', 'LAB003', 'SOLV004', 'PKG005')
);

-- Delete sample products
DELETE FROM products 
WHERE sku IN ('CHEM001', 'CHEM002', 'LAB003', 'SOLV004', 'PKG005');

-- Delete sample freight classifications
DELETE FROM freight_classifications 
WHERE description IN (
  'Chemical Compounds - Non-Hazardous',
  'Petroleum Products - Class 3 Flammable',
  'Sulfuric Acid - Class 8 Corrosive',
  'Laboratory Reagents - Mixed',
  'Acetone - Class 3 Flammable'
);