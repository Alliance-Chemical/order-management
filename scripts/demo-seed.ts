#!/usr/bin/env node

// Load environment variables first, before any other imports
import { config } from 'dotenv';
config({ path: '.env.local' });

// Now verify the env is loaded
if (!process.env.DATABASE_URL) {
  console.error('❌ DATABASE_URL not found in environment variables');
  console.error('Please ensure .env.local contains DATABASE_URL');
  process.exit(1);
}

// Now we can safely import modules that depend on env vars
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as qrSchema from '../lib/db/schema/qr-workspace';
import { v4 as uuidv4 } from 'uuid';
import { sql, inArray } from 'drizzle-orm';

// Create our own database connection for the seed script
const client = postgres(process.env.DATABASE_URL, {
  prepare: false,
});

const schema = { ...qrSchema };
const db = drizzle(client, { schema });

// Destructure what we need from the schema
const { workspaces, qrCodes, activityLog } = qrSchema;

const DEMO_ORDERS = [
  {
    orderId: 99001,
    orderNumber: 'DEMO-001',
    customerName: 'Acme Chemical Co.',
    workflowType: 'pump_and_fill',
    items: [
      { name: 'D-Limonene 99% - 5 Gallon', quantity: 4, sku: 'DL-99-5GAL' },
      { name: 'Isopropyl Alcohol 70% - 1 Gallon', quantity: 10, sku: 'IPA-70-1GAL' }
    ],
    phase: 'pre_mix'
  },
  {
    orderId: 99002,
    orderNumber: 'DEMO-002', 
    customerName: 'Industrial Solutions LLC',
    workflowType: 'direct_resell',
    items: [
      { name: 'Acetone Technical Grade - 55 Gallon', quantity: 2, sku: 'ACE-TG-55GAL' }
    ],
    phase: 'pre_ship'
  },
  {
    orderId: 99003,
    orderNumber: 'DEMO-003',
    customerName: 'Green Clean Products',
    workflowType: 'pump_and_fill',
    items: [
      { name: 'Citrus Degreaser Concentrate - 5 Gallon', quantity: 6, sku: 'CD-CON-5GAL' },
      { name: 'Pine Oil Cleaner - 1 Gallon', quantity: 12, sku: 'PO-CL-1GAL' }
    ],
    phase: 'pre_mix'
  },
  {
    orderId: 99004,
    orderNumber: 'DEMO-004',
    customerName: 'Lab Supply Direct',
    workflowType: 'direct_resell',
    items: [
      { name: 'Ethanol 95% - 4 Liter', quantity: 8, sku: 'ETH-95-4L' }
    ],
    phase: 'pending'
  },
  {
    orderId: 99005,
    orderNumber: 'DEMO-005',
    customerName: 'Manufacturing Partners Inc.',
    workflowType: 'pump_and_fill',
    items: [
      { name: 'Mineral Spirits - 5 Gallon', quantity: 5, sku: 'MS-5GAL' },
      { name: 'Xylene - 1 Gallon', quantity: 15, sku: 'XYL-1GAL' },
      { name: 'Toluene - 1 Gallon', quantity: 10, sku: 'TOL-1GAL' }
    ],
    phase: 'pre_ship'
  }
];

async function seedDemoData() {
  console.log('🌱 Starting demo seed...');
  
  try {
    // Clear existing demo data
    console.log('🧹 Cleaning existing demo data...');
    
    // First get workspace IDs for demo orders
    const demoWorkspaces = await db.select().from(workspaces).where(sql`order_id >= 99000`);
    const workspaceIds = demoWorkspaces.map(w => w.id);
    
    // Delete related data if exists
    if (workspaceIds.length > 0) {
      await db.delete(activityLog).where(inArray(activityLog.workspaceId, workspaceIds));
    }
    
    await db.delete(qrCodes).where(sql`order_id >= 99000`);
    await db.delete(workspaces).where(sql`order_id >= 99000`);
    
    // Create demo workspaces
    for (const order of DEMO_ORDERS) {
      console.log(`📦 Creating order ${order.orderNumber}...`);
      
      const workspaceId = uuidv4();
      
      // Create workspace
      await db.insert(workspaces).values({
        id: workspaceId,
        orderId: order.orderId,
        orderNumber: order.orderNumber,
        workspaceUrl: `/workspace/${order.orderId}`,
        status: order.phase === 'pending' ? 'pending' : 'active',
        workflowPhase: order.phase,
        workflowType: order.workflowType,
        shipstationData: {
          orderId: order.orderId,
          orderNumber: order.orderNumber,
          orderDate: new Date().toISOString(),
          shipTo: {
            name: order.customerName,
            company: order.customerName,
            street1: '123 Demo Street',
            city: 'Demo City',
            state: 'TX',
            postalCode: '75001',
            country: 'US',
            phone: '555-DEMO-' + order.orderId
          },
          items: order.items
        },
        moduleStates: {
          sourceAssignments: order.workflowType === 'pump_and_fill' ? 
            order.items.map(item => ({
              productName: item.name.split(' - ')[0],
              productSku: item.sku,
              containerType: '275 Gallon Tote',
              containerNumber: `DEMO-${Math.floor(Math.random() * 1000)}`,
              workflowType: 'pump_and_fill'
            })) : []
        }
      });
      
      // Generate QR codes for each order
      const qrTypes = ['source', 'destination', 'order_master'];
      for (const type of qrTypes) {
        const shortCode = Math.random().toString(36).substring(2, 8).toUpperCase();
        const qrCode = `QR-${order.orderId}-${type}-${shortCode}`;
        
        await db.insert(qrCodes).values({
          id: uuidv4(),
          workspaceId,
          qrType: type,
          qrCode,
          shortCode,
          orderId: order.orderId,
          orderNumber: order.orderNumber,
          encodedData: {
            workspaceId,
            orderId: order.orderId,
            customerName: order.customerName,
            items: order.items,
            type
          },
          qrUrl: `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3003'}/workspace/${order.orderId}?qr=${shortCode}`
        });
      }
      
      // Add initial activity
      await db.insert(activityLog).values({
        id: uuidv4(),
        workspaceId,
        activityType: 'workspace_created',
        activityDescription: `Demo workspace created for order ${order.orderNumber}`,
        performedBy: 'demo-user',
        metadata: { demo: true, orderId: order.orderId }
      });
    }
    
    // Note: Source containers require Shopify product data which we don't have for demo
    // In a real scenario, these would be created via Shopify sync
    
    console.log('✅ Demo seed completed successfully!');
    console.log(`📊 Created ${DEMO_ORDERS.length} demo orders`);
    console.log('');
    console.log('📝 Demo Orders:');
    DEMO_ORDERS.forEach(order => {
      console.log(`  - ${order.orderNumber}: ${order.customerName} (${order.workflowType})`);
      console.log(`    URL: http://localhost:3003/workspace/${order.orderId}`);
    });
    console.log('');
    console.log('🚀 Access the demo at: http://localhost:3003');
    
    // Close the database connection
    await client.end();
    
  } catch (error) {
    console.error('❌ Demo seed failed:', error);
    await client.end();
    process.exit(1);
  }
}

// Run if called directly
if (require.main === module) {
  seedDemoData().then(() => process.exit(0));
}

export { seedDemoData };