#!/usr/bin/env npx tsx
// Script to check and fix freight order tags in ShipStation

import { config } from 'dotenv';
config();

async function checkFreightTags() {
  const apiKey = process.env.SHIPSTATION_API_KEY?.trim() || '';
  const apiSecret = process.env.SHIPSTATION_API_SECRET?.trim() || '';
  const auth = Buffer.from(`${apiKey}:${apiSecret}`).toString('base64');
  
  const FREIGHT_ORDER_TAG = parseInt(process.env.FREIGHT_ORDER_TAG || '19844');
  const FREIGHT_READY_TAG = parseInt(process.env.FREIGHT_READY_TAG_ID || '44123');
  
  console.log('Checking freight order tags...');
  console.log(`FREIGHT_ORDER_TAG: ${FREIGHT_ORDER_TAG}`);
  console.log(`FREIGHT_READY_TAG: ${FREIGHT_READY_TAG}`);
  console.log('---');
  
  try {
    // Fetch orders with FREIGHT_ORDER_TAG
    console.log(`\nFetching orders with FREIGHT_ORDER_TAG (${FREIGHT_ORDER_TAG})...`);
    const freightOrdersResponse = await fetch(
      `https://ssapi.shipstation.com/orders/listbytag?` + 
      `orderStatus=awaiting_shipment&` +
      `tagId=${FREIGHT_ORDER_TAG}&` +
      `page=1&` +
      `pageSize=100`,
      {
        headers: {
          'Authorization': `Basic ${auth}`,
          'Content-Type': 'application/json',
        },
      }
    );
    
    if (!freightOrdersResponse.ok) {
      throw new Error(`ShipStation API error: ${freightOrdersResponse.statusText}`);
    }
    
    const freightOrdersData = await freightOrdersResponse.json();
    const freightOrders = freightOrdersData.orders || [];
    console.log(`Found ${freightOrders.length} orders with FREIGHT_ORDER_TAG`);
    
    // Fetch orders with FREIGHT_READY_TAG
    console.log(`\nFetching orders with FREIGHT_READY_TAG (${FREIGHT_READY_TAG})...`);
    const readyOrdersResponse = await fetch(
      `https://ssapi.shipstation.com/orders/listbytag?` + 
      `orderStatus=awaiting_shipment&` +
      `tagId=${FREIGHT_READY_TAG}&` +
      `page=1&` +
      `pageSize=100`,
      {
        headers: {
          'Authorization': `Basic ${auth}`,
          'Content-Type': 'application/json',
        },
      }
    );
    
    if (!readyOrdersResponse.ok) {
      throw new Error(`ShipStation API error: ${readyOrdersResponse.statusText}`);
    }
    
    const readyOrdersData = await readyOrdersResponse.json();
    const readyOrders = readyOrdersData.orders || [];
    console.log(`Found ${readyOrders.length} orders with FREIGHT_READY_TAG`);
    
    // List orders that have FREIGHT_ORDER_TAG but not FREIGHT_READY_TAG
    console.log('\n=== Orders Analysis ===');
    
    if (freightOrders.length > 0) {
      console.log('\nOrders with FREIGHT_ORDER_TAG:');
      for (const order of freightOrders.slice(0, 10)) {
        const hasReadyTag = order.tagIds?.includes(FREIGHT_READY_TAG);
        console.log(`- Order ${order.orderNumber} (ID: ${order.orderId})`);
        console.log(`  Tags: ${order.tagIds?.join(', ') || 'none'}`);
        console.log(`  Has FREIGHT_READY_TAG: ${hasReadyTag ? 'YES ✓' : 'NO ✗'}`);
        console.log(`  Customer: ${order.shipTo?.name || 'Unknown'}`);
        console.log(`  Date: ${order.orderDate}`);
      }
    }
    
    // Check if we need to update any orders
    const ordersNeedingUpdate = freightOrders.filter((order: any) => 
      !order.tagIds?.includes(FREIGHT_READY_TAG)
    );
    
    if (ordersNeedingUpdate.length > 0) {
      console.log(`\n⚠️  Found ${ordersNeedingUpdate.length} orders that need FREIGHT_READY_TAG`);
      console.log('These orders have FREIGHT_ORDER_TAG but lack FREIGHT_READY_TAG');
      console.log('They should have their pre-ship inspection completed to get the FREIGHT_READY_TAG');
      
      // Check our database for workspace status
      console.log('\nChecking workspace database for these orders...');
      const { db } = await import('@/lib/db');
      const { workspaces } = await import('@/lib/db/schema/qr-workspace');
      const { inArray } = await import('drizzle-orm');
      
      const orderIds = ordersNeedingUpdate.map((o: any) => o.orderId);
      const workspaceRecords = await db
        .select()
        .from(workspaces)
        .where(inArray(workspaces.orderId, orderIds));
      
      for (const workspace of workspaceRecords) {
        const moduleStates = workspace.moduleStates as any || {};
        const preShipCompleted = moduleStates.preShip?.completed;
        console.log(`\nWorkspace for Order ${workspace.orderNumber}:`);
        console.log(`  Pre-ship completed: ${preShipCompleted ? 'YES ✓' : 'NO ✗'}`);
        console.log(`  Workflow phase: ${workspace.workflowPhase}`);
        console.log(`  Status: ${workspace.status}`);
        
        if (preShipCompleted && workspace.workflowPhase !== 'ready_to_ship') {
          console.log(`  ⚠️  Pre-ship is completed but phase is not 'ready_to_ship'`);
          console.log(`     This order should have FREIGHT_READY_TAG!`);
        }
      }
    } else {
      console.log('\n✅ All orders with FREIGHT_ORDER_TAG also have FREIGHT_READY_TAG');
    }
    
  } catch (error) {
    console.error('Error checking tags:', error);
  }
}

// Run the check
checkFreightTags();