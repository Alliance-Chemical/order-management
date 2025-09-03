#!/usr/bin/env tsx

/**
 * Migrate existing JSON hazmat data to PostgreSQL RAG database
 * This populates the rag.documents table with CFR HMT, ERG, and historical data
 */

import { neon } from '@neondatabase/serverless';
import * as dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';

// Load environment variables
dotenv.config({ path: '.env.local' });

const DATABASE_URL = process.env.DATABASE_URL || process.env.NEON_DATABASE_URL;

if (!DATABASE_URL) {
  console.error('❌ DATABASE_URL not found in environment variables');
  process.exit(1);
}

const db = neon(DATABASE_URL);

// Helper to generate text hash
function hashText(text: string): string {
  return crypto.createHash('sha256').update(text).digest('hex');
}

// Helper to load JSON file
function loadJSON(filename: string): any {
  const filepath = path.join(process.cwd(), 'data', filename);
  if (!fs.existsSync(filepath)) {
    console.warn(`⚠️  File not found: ${filepath}`);
    return null;
  }
  return JSON.parse(fs.readFileSync(filepath, 'utf8'));
}

async function migrateHMTData() {
  console.log('📦 Migrating CFR Hazmat Table (HMT) data...');
  
  const hmtData = loadJSON('hmt-172101.json');
  if (!hmtData || !Array.isArray(hmtData)) {
    console.warn('  ⚠️  No HMT data found or invalid format');
    return 0;
  }

  let count = 0;
  const batchSize = 100;
  
  for (let i = 0; i < hmtData.length; i += batchSize) {
    const batch = hmtData.slice(i, i + batchSize);
    
    for (const entry of batch) {
      try {
        // Build searchable text
        const searchText = [
          entry.base_name,
          entry.qualifier,
          entry.id_number,
          entry.class_or_division,
          entry.subsidiary_risk,
          Array.isArray(entry.label_codes) ? entry.label_codes.join(' ') : '',
        ].filter(Boolean).join(' ');
        
        // Build document text for display
        const docText = `${entry.base_name}${entry.qualifier ? ' — ' + entry.qualifier : ''} | UN: ${entry.id_number} | Class: ${entry.class_or_division}${entry.packing_group ? ' | PG: ' + entry.packing_group : ''}`;
        
        const metadata = {
          type: 'hmt',
          unNumber: entry.id_number,
          hazardClass: entry.class_or_division,
          packingGroup: entry.packing_group,
          labels: entry.label_codes,
          specialProvisions: entry.special_provisions,
          baseName: entry.base_name,
          qualifier: entry.qualifier,
          subsidiaryRisk: entry.subsidiary_risk,
          packagingExceptions: entry.packaging_exceptions,
          nonBulkPackaging: entry.non_bulk_packaging,
          bulkPackaging: entry.bulk_packaging,
          passengerQuantity: entry.passenger_aircraft_quantity,
          cargoQuantity: entry.cargo_aircraft_quantity,
          vesselStowage: entry.vessel_stowage_provisions,
        };

        await db`
          INSERT INTO rag.documents (
            source,
            source_id,
            text,
            text_hash,
            metadata,
            search_vector,
            keywords,
            base_relevance
          ) VALUES (
            'hmt',
            ${entry.id_number},
            ${docText},
            ${hashText(docText)},
            ${JSON.stringify(metadata)},
            ${searchText},
            ${JSON.stringify([entry.base_name, entry.id_number])},
            100
          )
        `;
        
        count++;
      } catch (error) {
        console.error(`  ❌ Failed to insert HMT entry ${entry.id_number}:`, error);
      }
    }
    
    console.log(`  ✅ Processed ${Math.min(i + batchSize, hmtData.length)}/${hmtData.length} HMT entries`);
  }
  
  return count;
}

async function migrateERGData() {
  console.log('🚨 Migrating Emergency Response Guide (ERG) data...');
  
  const ergData = loadJSON('erg-index.json');
  if (!ergData || typeof ergData !== 'object') {
    console.warn('  ⚠️  No ERG data found or invalid format');
    return 0;
  }

  let count = 0;
  
  for (const [unNumber, guideNumber] of Object.entries(ergData)) {
    try {
      const docText = `Emergency Response Guide ${guideNumber} for ${unNumber}`;
      
      const metadata = {
        type: 'erg',
        unNumber: unNumber,
        guideNumber: guideNumber,
        hazardType: determineHazardType(guideNumber as string),
      };

      await db`
        INSERT INTO rag.documents (
          source,
          source_id,
          text,
          text_hash,
          metadata,
          search_vector,
          keywords,
          base_relevance
        ) VALUES (
          'erg',
          ${unNumber},
          ${docText},
          ${hashText(docText)},
          ${JSON.stringify(metadata)},
          ${`${unNumber} guide ${guideNumber}`},
          ${JSON.stringify([unNumber, `guide-${guideNumber}`])},
          80
        )
      `;
      
      count++;
    } catch (error) {
      console.error(`  ❌ Failed to insert ERG entry ${unNumber}:`, error);
    }
  }
  
  console.log(`  ✅ Migrated ${count} ERG entries`);
  return count;
}

async function migrateHistoricalData() {
  console.log('📊 Migrating historical shipping data...');
  
  const histData = loadJSON('historical-shipping.json');
  if (!histData || !Array.isArray(histData)) {
    console.warn('  ⚠️  No historical data found or invalid format');
    return 0;
  }

  let count = 0;
  const uniqueEntries = new Map();
  
  // Deduplicate by product name + UN number
  for (const entry of histData) {
    const key = `${entry.product_name}_${entry.chosen_un}`;
    if (!uniqueEntries.has(key)) {
      uniqueEntries.set(key, entry);
    }
  }
  
  for (const entry of uniqueEntries.values()) {
    try {
      const docText = `Historical: ${entry.product_name} shipped as ${entry.chosen_un} Class ${entry.chosen_class}${entry.chosen_pg ? ' PG ' + entry.chosen_pg : ''}`;
      
      const metadata = {
        type: 'historical',
        sku: entry.sku,
        productName: entry.product_name,
        unNumber: entry.chosen_un,
        hazardClass: entry.chosen_class,
        packingGroup: entry.chosen_pg,
        shippingName: entry.chosen_shipping_name,
        shipmentCount: entry.shipment_count || 1,
      };

      await db`
        INSERT INTO rag.documents (
          source,
          source_id,
          text,
          text_hash,
          metadata,
          search_vector,
          keywords,
          base_relevance
        ) VALUES (
          'historical',
          ${entry.sku || `hist_${count}`},
          ${docText},
          ${hashText(docText)},
          ${JSON.stringify(metadata)},
          ${entry.product_name},
          ${JSON.stringify([entry.product_name, entry.sku, entry.chosen_un])},
          90
        )
      `;
      
      count++;
    } catch (error) {
      console.error(`  ❌ Failed to insert historical entry:`, error);
    }
  }
  
  console.log(`  ✅ Migrated ${count} historical entries`);
  return count;
}

async function migrateProductClassifications() {
  console.log('🏷️  Migrating product classifications...');
  
  // Check for existing product classifications
  const products = await db`
    SELECT 
      p.id, p.sku, p.name, p.is_hazardous, p.un_number, p.cas_number,
      fc.nmfc_code, fc.freight_class, fc.is_hazmat, fc.hazmat_class, fc.packing_group,
      fc.proper_shipping_name, fc.description
    FROM products p
    LEFT JOIN product_freight_links pfl ON p.id = pfl.product_id
    LEFT JOIN freight_classifications fc ON pfl.classification_id = fc.id
    WHERE p.is_hazardous = true OR fc.is_hazmat = true
  `;
  
  if (!products || products.length === 0) {
    console.warn('  ⚠️  No hazardous products found in database');
    return 0;
  }

  let count = 0;
  
  for (const product of products) {
    try {
      const docText = `Product: ${product.name} (${product.sku})${product.un_number ? ' UN: ' + product.un_number : ''}${product.hazmat_class ? ' Class: ' + product.hazmat_class : ''}`;
      
      const metadata = {
        type: 'product',
        sku: product.sku,
        name: product.name,
        casNumber: product.cas_number,
        unNumber: product.un_number,
        hazardClass: product.hazmat_class,
        packingGroup: product.packing_group,
        nmfcCode: product.nmfc_code,
        freightClass: product.freight_class,
        isHazardous: product.is_hazardous || product.is_hazmat,
        properShippingName: product.proper_shipping_name,
      };

      await db`
        INSERT INTO rag.documents (
          source,
          source_id,
          text,
          text_hash,
          metadata,
          search_vector,
          keywords,
          base_relevance,
          is_verified
        ) VALUES (
          'products',
          ${product.sku},
          ${docText},
          ${hashText(docText)},
          ${JSON.stringify(metadata)},
          ${`${product.name} ${product.sku} ${product.cas_number || ''}`},
          ${JSON.stringify([product.name, product.sku, product.un_number].filter(Boolean))},
          95,
          true
        )
      `;
      
      count++;
    } catch (error) {
      console.error(`  ❌ Failed to insert product ${product.sku}:`, error);
    }
  }
  
  console.log(`  ✅ Migrated ${count} product classifications`);
  return count;
}

function determineHazardType(guideNumber: string): string {
  const num = parseInt(guideNumber);
  if (num >= 111 && num <= 119) return 'Explosives';
  if (num >= 120 && num <= 129) return 'Gases';
  if (num >= 130 && num <= 139) return 'Flammable Liquids';
  if (num >= 140 && num <= 149) return 'Flammable Solids';
  if (num >= 150 && num <= 159) return 'Oxidizers';
  if (num >= 160 && num <= 169) return 'Toxic Materials';
  if (num >= 170 && num <= 179) return 'Radioactive';
  return 'Other';
}

async function createIndexes() {
  console.log('🔍 Creating additional indexes for performance...');
  
  try {
    // Create a compound index for common queries
    await db`
      CREATE INDEX IF NOT EXISTS idx_rag_source_verified 
      ON rag.documents(source, is_verified)
      WHERE is_verified = true
    `;
    
    // Create index for product SKU lookups
    await db`
      CREATE INDEX IF NOT EXISTS idx_rag_product_sku 
      ON rag.documents((metadata->>'sku'))
      WHERE source = 'products'
    `;
    
    console.log('  ✅ Indexes created');
  } catch (error) {
    console.error('  ❌ Failed to create indexes:', error);
  }
}

async function verifyMigration() {
  console.log('\n📊 Verifying migration...');
  
  const stats = await db`
    SELECT 
      source,
      COUNT(*) as count,
      COUNT(DISTINCT source_id) as unique_ids,
      AVG(base_relevance) as avg_relevance
    FROM rag.documents
    GROUP BY source
    ORDER BY source
  `;
  
  console.log('\n📈 Migration Statistics:');
  console.log('========================');
  
  let totalDocs = 0;
  for (const stat of stats) {
    console.log(`  ${stat.source}:`);
    console.log(`    - Documents: ${stat.count}`);
    console.log(`    - Unique IDs: ${stat.unique_ids}`);
    console.log(`    - Avg Relevance: ${Math.round(stat.avg_relevance)}`);
    totalDocs += parseInt(stat.count);
  }
  
  console.log('------------------------');
  console.log(`  Total Documents: ${totalDocs}`);
  
  // Check for documents without text_hash
  const missing = await db`
    SELECT COUNT(*) as count 
    FROM rag.documents 
    WHERE text_hash IS NULL
  `;
  
  if (missing[0].count > 0) {
    console.warn(`\n⚠️  Warning: ${missing[0].count} documents missing text_hash`);
  }
}

async function main() {
  console.log('🚀 Starting RAG Database Migration');
  console.log('=' .repeat(50));
  
  try {
    // Run migrations
    const hmtCount = await migrateHMTData();
    const ergCount = await migrateERGData();
    const histCount = await migrateHistoricalData();
    const prodCount = await migrateProductClassifications();
    
    // Create indexes
    await createIndexes();
    
    // Verify
    await verifyMigration();
    
    console.log('\n' + '='.repeat(50));
    console.log('✨ Migration Complete!');
    console.log('='.repeat(50));
    console.log('\nNext steps:');
    console.log('1. Run: npm run rag:generate-embeddings');
    console.log('2. Test: npm run rag:test-search');
    console.log('3. Update APIs to use database RAG\n');
    
  } catch (error) {
    console.error('\n❌ Migration failed:', error);
    process.exit(1);
  }
}

// Run if called directly
if (require.main === module) {
  main().catch(console.error);
}