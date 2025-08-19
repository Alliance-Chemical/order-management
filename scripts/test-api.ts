#!/usr/bin/env node

import { config } from 'dotenv';
config({ path: '.env.local' });

// Import after env is loaded
import { db } from '../lib/db';
import { workspaces } from '../lib/db/schema/qr-workspace';
import { eq } from 'drizzle-orm';

async function testAPI() {
  try {
    console.log('Testing database connection...\n');
    
    // Test 1: Direct query
    const directResult = await db.select().from(workspaces).where(eq(workspaces.orderId, 99001));
    console.log('Direct query result:', directResult.length > 0 ? 'Found' : 'Not found');
    if (directResult.length > 0) {
      console.log('  Order ID:', directResult[0].orderId);
      console.log('  Order Number:', directResult[0].orderNumber);
    }
    
    // Test 2: Query with relations (like the service does)
    const withRelations = await db.query.workspaces.findFirst({
      where: eq(workspaces.orderId, 99001),
      with: {
        qrCodes: true,
        documents: true,
        alertConfigs: true,
      },
    });
    console.log('\nQuery with relations:', withRelations ? 'Found' : 'Not found');
    if (withRelations) {
      console.log('  Order ID:', withRelations.orderId);
      console.log('  QR Codes:', withRelations.qrCodes?.length || 0);
    }
    
    process.exit(0);
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

testAPI();