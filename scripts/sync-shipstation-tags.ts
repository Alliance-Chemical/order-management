#!/usr/bin/env node

import { config } from 'dotenv';
import path from 'path';
import { tagSyncService } from '../lib/services/shipstation/tag-sync';
import { db } from '../lib/db';
import { workspaces } from '../lib/db/schema/qr-workspace';
import { eq } from 'drizzle-orm';

// Load .env.local file
config({ path: path.resolve(process.cwd(), '.env.local') });

async function syncSingleOrder(orderId: number) {
  console.log(`\n📦 Syncing order ${orderId}...`);
  
  try {
    await tagSyncService.syncTagsToWorkflow(orderId);
    
    // Validate consistency
    const validation = await tagSyncService.validateTagConsistency(orderId);
    
    if (validation.consistent) {
      console.log(`✅ Order ${orderId} synced successfully`);
    } else {
      console.log(`⚠️  Order ${orderId} has consistency issues:`);
      validation.issues.forEach(issue => {
        console.log(`   - ${issue}`);
      });
    }
  } catch (error) {
    console.error(`❌ Failed to sync order ${orderId}:`, error);
  }
}

async function syncAllOrders() {
  console.log('🔄 Syncing all active workspaces with ShipStation tags...\n');
  
  try {
    const activeWorkspaces = await db
      .select()
      .from(workspaces)
      .where(eq(workspaces.status, 'active'));

    console.log(`Found ${activeWorkspaces.length} active workspaces to sync\n`);

    let successCount = 0;
    let errorCount = 0;
    const issues: { orderId: number; issues: string[] }[] = [];

    for (const workspace of activeWorkspaces) {
      try {
        await tagSyncService.syncTagsToWorkflow(workspace.orderId);
        
        // Validate consistency
        const validation = await tagSyncService.validateTagConsistency(workspace.orderId);
        
        if (validation.consistent) {
          successCount++;
          console.log(`✅ ${workspace.orderNumber} (${workspace.orderId})`);
        } else {
          issues.push({
            orderId: workspace.orderId,
            issues: validation.issues
          });
          console.log(`⚠️  ${workspace.orderNumber} (${workspace.orderId}) - has issues`);
        }
        
        // Small delay to avoid rate limiting
        await new Promise(resolve => setTimeout(resolve, 200));
      } catch (error) {
        errorCount++;
        console.log(`❌ ${workspace.orderNumber} (${workspace.orderId}) - failed`);
      }
    }

    console.log('\n═══════════════════════════════════════');
    console.log(`\n📊 Sync Summary:`);
    console.log(`   ✅ Successfully synced: ${successCount}`);
    console.log(`   ⚠️  With issues: ${issues.length}`);
    console.log(`   ❌ Failed: ${errorCount}`);
    
    if (issues.length > 0) {
      console.log('\n📋 Issues found:');
      issues.forEach(({ orderId, issues }) => {
        console.log(`\n   Order ${orderId}:`);
        issues.forEach(issue => {
          console.log(`     - ${issue}`);
        });
      });
    }
  } catch (error) {
    console.error('Failed to sync workspaces:', error);
    process.exit(1);
  }
}

async function showTagMapping() {
  console.log('\n🏷️  Tag to Workflow Mapping:\n');
  console.log('═══════════════════════════════════════');
  console.log('Tag ID | Tag Name                  | Workflow Effect');
  console.log('-------|---------------------------|------------------');
  console.log('60447  | Freight Booked            | → pre_mix phase, planning.locked = true');
  console.log('44123  | Freight Order Ready       | → pre_ship phase, pre_ship.completed = true');
  console.log('48500  | HOT SHIPMENT              | → priority = high, shipping.expedited = true');
  console.log('46283  | Delay Shipment            | → onHold = true, shipping.hold = true');
  console.log('51273  | Documents Required        | → documents.required = true');
  console.log('═══════════════════════════════════════\n');
}

async function main() {
  const args = process.argv.slice(2);
  
  if (args.length === 0 || args[0] === '--help') {
    console.log('ShipStation Tag Sync Tool\n');
    console.log('Usage:');
    console.log('  npx tsx scripts/sync-shipstation-tags.ts           # Sync all active orders');
    console.log('  npx tsx scripts/sync-shipstation-tags.ts <orderId> # Sync specific order');
    console.log('  npx tsx scripts/sync-shipstation-tags.ts --mapping # Show tag mapping');
    console.log('  npx tsx scripts/sync-shipstation-tags.ts --help    # Show this help');
    process.exit(0);
  }
  
  if (args[0] === '--mapping') {
    await showTagMapping();
    process.exit(0);
  }
  
  const orderId = parseInt(args[0]);
  
  if (!isNaN(orderId)) {
    await syncSingleOrder(orderId);
  } else {
    await syncAllOrders();
  }
  
  process.exit(0);
}

main().catch(error => {
  console.error('Script error:', error);
  process.exit(1);
});
