import { db } from '../lib/db';
import { workspaces, qrCodes, sourceContainers, activityLog } from '../lib/db/schema/qr-workspace';
import { v4 as uuidv4 } from 'uuid';
import { sql } from 'drizzle-orm';

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
    await db.delete(activityLog).where(sql`order_id >= 99000`);
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
        
        await db.insert(qrCodes).values({
          id: uuidv4(),
          orderId: order.orderId,
          orderNumber: order.orderNumber,
          type: type as any,
          shortCode,
          url: `${process.env.NEXT_PUBLIC_APP_URL}/workspace/${order.orderId}?qr=${shortCode}`,
          metadata: {
            workspaceId,
            customerName: order.customerName,
            items: order.items
          }
        });
      }
      
      // Add initial activity
      await db.insert(activityLog).values({
        id: uuidv4(),
        workspaceId,
        orderId: order.orderId,
        action: 'workspace_created',
        description: `Demo workspace created for order ${order.orderNumber}`,
        metadata: { demo: true },
        userId: 'demo-user'
      });
    }
    
    // Create demo source containers
    const demoContainers = [
      { id: 'DEMO-100', chemical: 'D-Limonene 99%', capacity: 275, currentVolume: 250 },
      { id: 'DEMO-101', chemical: 'Isopropyl Alcohol 70%', capacity: 275, currentVolume: 180 },
      { id: 'DEMO-102', chemical: 'Acetone Technical Grade', capacity: 55, currentVolume: 55 },
      { id: 'DEMO-103', chemical: 'Citrus Degreaser Concentrate', capacity: 275, currentVolume: 200 },
      { id: 'DEMO-104', chemical: 'Mineral Spirits', capacity: 275, currentVolume: 150 }
    ];
    
    for (const container of demoContainers) {
      await db.insert(sourceContainers).values({
        id: uuidv4(),
        containerNumber: container.id,
        chemicalName: container.chemical,
        capacity: container.capacity,
        currentVolume: container.currentVolume,
        location: 'Demo Warehouse - Rack A',
        status: 'active',
        lastInspected: new Date()
      });
    }
    
    console.log('✅ Demo seed completed successfully!');
    console.log(`📊 Created ${DEMO_ORDERS.length} demo orders`);
    console.log(`🏭 Created ${demoContainers.length} source containers`);
    
  } catch (error) {
    console.error('❌ Demo seed failed:', error);
    process.exit(1);
  }
}

// Run if called directly
if (require.main === module) {
  seedDemoData().then(() => process.exit(0));
}

export { seedDemoData };