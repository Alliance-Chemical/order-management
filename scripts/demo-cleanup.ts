#!/usr/bin/env node

import { config } from 'dotenv';
config({ path: '.env.local' });

import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as qrSchema from '../lib/db/schema/qr-workspace';
import { sql, inArray } from 'drizzle-orm';

const client = postgres(process.env.DATABASE_URL!, {
  prepare: false,
});

const schema = { ...qrSchema };
const db = drizzle(client, { schema });

const { workspaces, qrCodes, activityLog } = qrSchema;

async function cleanupDemo() {
  console.log('🧹 Starting demo cleanup...');
  
  try {
    // Get all demo workspace IDs
    const demoWorkspaces = await db.select().from(workspaces).where(sql`order_id >= 99000`);
    const workspaceIds = demoWorkspaces.map(w => w.id);
    
    if (workspaceIds.length === 0) {
      console.log('✅ No demo data found to clean up.');
      await client.end();
      return;
    }
    
    console.log(`Found ${demoWorkspaces.length} demo workspaces to remove...`);
    
    // Delete related data
    if (workspaceIds.length > 0) {
      // Delete activity logs
      const deletedActivities = await db.delete(activityLog)
        .where(inArray(activityLog.workspaceId, workspaceIds));
      console.log('  ✓ Deleted activity logs');
    }
    
    // Delete QR codes
    const deletedQRs = await db.delete(qrCodes).where(sql`order_id >= 99000`);
    console.log('  ✓ Deleted QR codes');
    
    // Delete workspaces
    const deletedWorkspaces = await db.delete(workspaces).where(sql`order_id >= 99000`);
    console.log('  ✓ Deleted workspaces');
    
    console.log('\n✅ Demo cleanup completed successfully!');
    console.log(`   Removed ${demoWorkspaces.length} demo workspaces and all related data.`);
    
    await client.end();
    
  } catch (error) {
    console.error('❌ Demo cleanup failed:', error);
    await client.end();
    process.exit(1);
  }
}

// Run if called directly
if (require.main === module) {
  cleanupDemo().then(() => process.exit(0));
}

export { cleanupDemo };