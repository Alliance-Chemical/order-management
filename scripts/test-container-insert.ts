import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

import { db } from '@/lib/db';
import { containerTypes } from '@/lib/db/schema/qr-workspace';

export async function testInsert() {
  console.log('Testing container insertion...');
  
  try {
    // Insert a simple test record
    const result = await db.insert(containerTypes).values({
      shopifyProductId: 'test-product-123',
      shopifyVariantId: 'test-variant-456',
      shopifyTitle: '100% Pure Castor Oil ACS Grade',
      shopifyVariantTitle: '100% Pure Castor Oil ACS Grade - 55 Gallon Drum',
      shopifySku: 'CASTOR-OIL-DRUM-55',
      containerMaterial: 'metal',
      containerType: 'drum',
      capacity: '55',
      capacityUnit: 'gallons',
      freightClass: '85',
      isActive: true,
      createdBy: 'test-script',
      updatedBy: 'test-script',
    }).returning();
    
    console.log('Successfully inserted:', result);
    return result;
  } catch (error) {
    console.error('Insert failed:', error);
    throw error;
  }
}

if (require.main === module) {
  testInsert()
    .then(() => process.exit(0))
    .catch((error) => {
      console.error('Test failed:', error);
      process.exit(1);
    });
}