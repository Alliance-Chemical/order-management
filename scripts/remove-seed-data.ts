#!/usr/bin/env npx tsx
/**
 * Remove the sample freight data that was incorrectly added
 */

import { getDb } from '@/src/data/db/client';
import { freightClassifications, products, productFreightLinks } from '@/lib/db/schema/freight';
import { inArray, eq } from 'drizzle-orm';

const db = getDb();

async function removeSeedData() {
  console.log('🧹 Removing sample freight data...');

  try {
    // Remove sample SKUs that were added
    const sampleSKUs = ['CHEM001', 'CHEM002', 'LAB003', 'SOLV004', 'PKG005'];
    
    // Get product IDs to remove
    const productsToRemove = await db
      .select({ id: products.id })
      .from(products)
      .where(inArray(products.sku, sampleSKUs));
    
    if (productsToRemove.length > 0) {
      const productIds = productsToRemove.map(p => p.id);
      
      // Remove product links first (foreign key constraint)
      await db
        .delete(productFreightLinks)
        .where(inArray(productFreightLinks.productId, productIds));
      
      // Remove products
      await db
        .delete(products)
        .where(inArray(products.sku, sampleSKUs));
      
      console.log(`✅ Removed ${productsToRemove.length} sample products and their links`);
    }
    
    // Remove sample freight classifications
    const sampleDescriptions = [
      'Chemical Compounds - Non-Hazardous',
      'Petroleum Products - Class 3 Flammable',
      'Sulfuric Acid - Class 8 Corrosive',
      'Laboratory Reagents - Mixed',
      'Acetone - Class 3 Flammable'
    ];
    
    const result = await db
      .delete(freightClassifications)
      .where(inArray(freightClassifications.description, sampleDescriptions));
    
    console.log('✅ Removed sample freight classifications');
    console.log('🎯 Sample data cleanup complete');
    
    process.exit(0);
  } catch (error) {
    console.error('❌ Error removing seed data:', error);
    process.exit(1);
  }
}

removeSeedData().catch(console.error);