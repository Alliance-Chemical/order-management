import { db } from '@/lib/db';
import { workspaces, qrCodes, activityLog } from '@/lib/db/schema/qr-workspace';
import { v4 as uuidv4 } from 'uuid';
import { sql, inArray } from 'drizzle-orm';

const DEMO_ORDERS = [
  {
    orderId: 99001,
    orderNumber: 'DEMO-001',
    customerName: 'Acme Chemical Co.',
    workflowType: 'pump_and_fill' as const,
    items: [
      { name: 'D-Limonene 99% - 5 Gallon', quantity: 4, sku: 'DL-99-5GAL' },
      { name: 'Isopropyl Alcohol 70% - 1 Gallon', quantity: 10, sku: 'IPA-70-1GAL' }
    ],
    phase: 'pre_mix' as const
  },
  {
    orderId: 99002,
    orderNumber: 'DEMO-002', 
    customerName: 'Industrial Solutions LLC',
    workflowType: 'direct_resell' as const,
    items: [
      { name: 'Acetone Technical Grade - 55 Gallon', quantity: 2, sku: 'ACE-TG-55GAL' }
    ],
    phase: 'pre_ship' as const
  },
  {
    orderId: 99003,
    orderNumber: 'DEMO-003',
    customerName: 'Green Clean Products',
    workflowType: 'pump_and_fill' as const, 
    items: [
      { name: 'Ethanol 95% - 5 Gallon', quantity: 6, sku: 'ETH-95-5GAL' },
      { name: 'Glycerin USP - 1 Gallon', quantity: 8, sku: 'GLY-USP-1GAL' }
    ],
    phase: 'pending' as const
  },
  {
    orderId: 99004,
    orderNumber: 'DEMO-004',
    customerName: 'Tech Manufacturing Inc.',
    workflowType: 'direct_resell' as const,
    items: [
      { name: 'Methanol Lab Grade - 20L', quantity: 5, sku: 'METH-LG-20L' }
    ],
    phase: 'completed' as const
  },
  {
    orderId: 99005,
    orderNumber: 'DEMO-005',
    customerName: 'BioLabs Research',
    workflowType: 'pump_and_fill' as const,
    items: [
      { name: 'Hydrogen Peroxide 30% - 1 Gallon', quantity: 12, sku: 'HP-30-1GAL' },
      { name: 'Citric Acid Powder - 5kg', quantity: 3, sku: 'CA-PWD-5KG' }
    ],
    phase: 'pre_mix' as const
  }
];

export async function seedDemoData() {
  console.log('🌱 Starting demo seed...');
  
  // Get existing workspace IDs to clean up activity logs
  const existingWorkspaces = await db.select({ id: workspaces.id })
    .from(workspaces)
    .where(sql`order_id >= 99000`);
  
  const workspaceIds = existingWorkspaces.map(w => w.id);
  
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
    const qrTypes = ['source', 'destination', 'order_master'] as const;
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
  
  console.log('✅ Demo seed completed successfully!');
  console.log(`📊 Created ${DEMO_ORDERS.length} demo orders`);
  
  return {
    success: true,
    ordersCreated: DEMO_ORDERS.length,
    orders: DEMO_ORDERS.map(o => ({
      orderId: o.orderId,
      orderNumber: o.orderNumber,
      url: `/workspace/${o.orderId}`
    }))
  };
}