#!/usr/bin/env npx tsx

import { db } from '@/lib/db';
import { sql } from 'drizzle-orm';

async function createChemicalSchema() {
  console.log('🧪 Creating chemical classification schema for freight shipping...');
  
  try {
    // Create products table with chemical properties
    console.log('Creating products table...');
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS products (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        sku VARCHAR(100) UNIQUE NOT NULL,
        name TEXT NOT NULL,
        description TEXT,
        
        -- Physical attributes
        weight DECIMAL(10, 2),
        length DECIMAL(10, 2),
        width DECIMAL(10, 2),
        height DECIMAL(10, 2),
        
        -- Packaging info
        packaging_type VARCHAR(50),
        units_per_package INTEGER DEFAULT 1,
        unit_container_type VARCHAR(50),
        
        -- Chemical properties (CRITICAL for DOT compliance)
        is_hazardous BOOLEAN DEFAULT FALSE,
        cas_number VARCHAR(20), -- Chemical Abstract Service number
        un_number VARCHAR(10),  -- United Nations number for hazmat
        
        -- Status
        is_active BOOLEAN DEFAULT TRUE,
        
        -- Timestamps
        created_at TIMESTAMP NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMP NOT NULL DEFAULT NOW()
      );
    `);
    
    // Create freight_classifications table with NMFC codes
    console.log('Creating freight_classifications table...');
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS freight_classifications (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        description TEXT NOT NULL,
        nmfc_code VARCHAR(20), -- National Motor Freight Classification
        freight_class VARCHAR(10) NOT NULL, -- 50, 55, 60, 65, 70, 77.5, 85, 92.5, 100, 110, 125, 150, 175, 200, 250, 300, 400, 500
        
        -- Hazmat information (DOT compliance)
        is_hazmat BOOLEAN DEFAULT FALSE,
        hazmat_class VARCHAR(10), -- Class 1-9 hazmat classifications
        packing_group VARCHAR(5), -- I, II, III
        
        -- Packaging requirements
        packaging_instructions TEXT,
        special_handling TEXT,
        
        -- Density rules for freight class
        min_density DECIMAL(8, 2),
        max_density DECIMAL(8, 2),
        
        created_at TIMESTAMP NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMP NOT NULL DEFAULT NOW()
      );
    `);
    
    // Create product_freight_links table for approved mappings
    console.log('Creating product_freight_links table...');
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS product_freight_links (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        product_id UUID REFERENCES products(id) NOT NULL,
        classification_id UUID REFERENCES freight_classifications(id) NOT NULL,
        
        -- Override values for specific combinations
        override_freight_class VARCHAR(10),
        override_packaging TEXT,
        
        -- Confidence and source tracking
        confidence_score DECIMAL(3, 2),
        link_source VARCHAR(50) DEFAULT 'manual', -- 'manual', 'ai', 'import'
        
        -- CRITICAL: Approval workflow for hazmat compliance
        is_approved BOOLEAN DEFAULT FALSE,
        approved_by VARCHAR(255),
        approved_at TIMESTAMP,
        
        created_at TIMESTAMP NOT NULL DEFAULT NOW(),
        created_by VARCHAR(255),
        updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
        
        -- Prevent duplicate links
        UNIQUE(product_id, classification_id)
      );
    `);
    
    // Create performance indexes
    console.log('Creating performance indexes...');
    await db.execute(sql`
      -- Products indexes
      CREATE INDEX IF NOT EXISTS idx_products_sku ON products(sku);
      CREATE INDEX IF NOT EXISTS idx_products_name ON products(name);
      CREATE INDEX IF NOT EXISTS idx_products_active ON products(is_active);
      CREATE INDEX IF NOT EXISTS idx_products_hazardous ON products(is_hazardous);
      CREATE INDEX IF NOT EXISTS idx_products_cas ON products(cas_number);
      CREATE INDEX IF NOT EXISTS idx_products_un ON products(un_number);
      
      -- Classifications indexes  
      CREATE INDEX IF NOT EXISTS idx_classifications_description ON freight_classifications(description);
      CREATE INDEX IF NOT EXISTS idx_classifications_nmfc ON freight_classifications(nmfc_code);
      CREATE INDEX IF NOT EXISTS idx_classifications_class ON freight_classifications(freight_class);
      CREATE INDEX IF NOT EXISTS idx_classifications_hazmat ON freight_classifications(is_hazmat);
      
      -- Links indexes
      CREATE INDEX IF NOT EXISTS idx_product_freight_product ON product_freight_links(product_id);
      CREATE INDEX IF NOT EXISTS idx_product_freight_classification ON product_freight_links(classification_id);
      CREATE INDEX IF NOT EXISTS idx_product_freight_approved ON product_freight_links(is_approved);
      CREATE INDEX IF NOT EXISTS idx_product_freight_source ON product_freight_links(link_source);
    `);
    
    // Insert essential freight classifications for immediate use
    console.log('Inserting essential freight classifications...');
    await db.execute(sql`
      INSERT INTO freight_classifications (description, freight_class, nmfc_code, is_hazmat, hazmat_class, packaging_instructions) VALUES
        ('General Chemicals - Non-Hazardous, Packaged', '85', '51230', false, null, 'Standard chemical packaging - drums, jugs, or pails'),
        ('Paint, Varnish, Lacquer - Non-Hazardous', '77.5', '46020', false, null, 'Metal containers, not exceeding 5 gallons'),
        ('Adhesives - Non-Hazardous', '100', '17800', false, null, 'Sealed containers, proper labeling required'),
        ('Industrial Chemicals - Corrosive (Class 8)', '100', '51750', true, '8', 'DOT specification packaging required - UN rated containers'),
        ('Flammable Liquids (Class 3)', '100', '51760', true, '3', 'DOT Class 3 packaging - metal drums with proper closures'),
        ('Oxidizers (Class 5.1)', '125', '51770', true, '5.1', 'Separate from flammables - DOT Class 5.1 packaging'),
        ('Compressed Gases (Class 2)', '200', '19990', true, '2', 'DOT cylinder specifications - proper valve protection'),
        ('Cleaning Chemicals - Non-Hazardous', '92.5', '17860', false, null, 'Leak-proof containers - plastic or metal')
      ON CONFLICT (description) DO NOTHING;
    `);
    
    console.log('✅ Chemical classification schema created successfully!');
    console.log('📋 Inserted 8 essential freight classifications for immediate use');
    console.log('⚠️  IMPORTANT: All hazmat shipments require approved product-classification links');
    
  } catch (error) {
    console.error('❌ Error creating chemical schema:', error);
    throw error;
  }
}

// Run the migration
if (require.main === module) {
  createChemicalSchema()
    .then(() => {
      console.log('🎉 Chemical classification system ready for freight shipping!');
      process.exit(0);
    })
    .catch((error) => {
      console.error('💥 Migration failed:', error);
      process.exit(1);
    });
}

export { createChemicalSchema };