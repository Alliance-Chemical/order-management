#!/usr/bin/env npx tsx

import { db } from '@/lib/db';
import { sql } from 'drizzle-orm';

async function createChemicalTables() {
  console.log('Creating chemical classification tables...');
  
  try {
    // Create products table
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS products (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        sku VARCHAR(100) UNIQUE NOT NULL,
        name TEXT NOT NULL,
        description TEXT,
        weight DECIMAL(10, 2),
        length DECIMAL(10, 2),
        width DECIMAL(10, 2),
        height DECIMAL(10, 2),
        packaging_type VARCHAR(50),
        units_per_package INTEGER DEFAULT 1,
        unit_container_type VARCHAR(50),
        is_hazardous BOOLEAN DEFAULT FALSE,
        cas_number VARCHAR(20),
        un_number VARCHAR(10),
        is_active BOOLEAN DEFAULT TRUE,
        created_at TIMESTAMP NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMP NOT NULL DEFAULT NOW()
      );
    `);
    
    // Create freight_classifications table
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS freight_classifications (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        description TEXT NOT NULL,
        nmfc_code VARCHAR(20),
        freight_class VARCHAR(10) NOT NULL,
        is_hazmat BOOLEAN DEFAULT FALSE,
        hazmat_class VARCHAR(10),
        packing_group VARCHAR(5),
        packaging_instructions TEXT,
        special_handling TEXT,
        min_density DECIMAL(8, 2),
        max_density DECIMAL(8, 2),
        created_at TIMESTAMP NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMP NOT NULL DEFAULT NOW()
      );
    `);
    
    // Create product_freight_links table
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS product_freight_links (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        product_id UUID REFERENCES products(id) NOT NULL,
        classification_id UUID REFERENCES freight_classifications(id) NOT NULL,
        override_freight_class VARCHAR(10),
        override_packaging TEXT,
        confidence_score DECIMAL(3, 2),
        link_source VARCHAR(50) DEFAULT 'manual',
        is_approved BOOLEAN DEFAULT FALSE,
        approved_by VARCHAR(255),
        approved_at TIMESTAMP,
        created_at TIMESTAMP NOT NULL DEFAULT NOW(),
        created_by VARCHAR(255),
        updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
        UNIQUE(product_id, classification_id)
      );
    `);
    
    // Create indexes
    await db.execute(sql`CREATE INDEX IF NOT EXISTS idx_products_sku ON products(sku);`);
    await db.execute(sql`CREATE INDEX IF NOT EXISTS idx_products_name ON products(name);`);
    await db.execute(sql`CREATE INDEX IF NOT EXISTS idx_products_active ON products(is_active);`);
    await db.execute(sql`CREATE INDEX IF NOT EXISTS idx_products_hazardous ON products(is_hazardous);`);
    await db.execute(sql`CREATE INDEX IF NOT EXISTS idx_classifications_description ON freight_classifications(description);`);
    await db.execute(sql`CREATE INDEX IF NOT EXISTS idx_classifications_class ON freight_classifications(freight_class);`);
    await db.execute(sql`CREATE INDEX IF NOT EXISTS idx_product_freight_product ON product_freight_links(product_id);`);
    await db.execute(sql`CREATE INDEX IF NOT EXISTS idx_product_freight_classification ON product_freight_links(classification_id);`);
    
    console.log('✅ Chemical classification tables created successfully!');
    
    // Insert some sample freight classifications
    await db.execute(sql`
      INSERT INTO freight_classifications (description, freight_class, is_hazmat) VALUES
        ('General Chemicals - Packaged', '85', false),
        ('Hazardous Materials Class 3 - Flammable Liquids', '100', true),
        ('Hazardous Materials Class 8 - Corrosive', '100', true),
        ('Paint and Coatings', '77.5', false),
        ('Industrial Chemicals - Bulk', '70', false)
      ON CONFLICT DO NOTHING;
    `);
    
    console.log('✅ Sample freight classifications inserted!');
    
  } catch (error) {
    console.error('❌ Error creating chemical tables:', error);
    process.exit(1);
  }
}

createChemicalTables().then(() => {
  console.log('Done!');
  process.exit(0);
});