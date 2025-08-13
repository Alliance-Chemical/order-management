import { db } from '../lib/db';
import { workspaces } from '../lib/db/schema/qr-workspace';
import { eq } from 'drizzle-orm';

async function checkTestData() {
  const testWorkspaceId = '12345678-1234-1234-1234-123456789abc';
  console.log(`Checking for test workspace with ID ${testWorkspaceId}...`);
  
  const workspace = await db.select().from(workspaces).where(eq(workspaces.id, testWorkspaceId));
  
  if (workspace.length > 0) {
    console.log('✅ Test workspace exists:', workspace[0]);
  } else {
    console.log('❌ Test workspace does not exist. Creating it...');
    
    // Create test workspace
    await db.insert(workspaces).values({
      id: testWorkspaceId,
      orderId: 67890,
      orderNumber: 'TEST-ORDER-67890',
      workspaceUrl: `/workspace/${testWorkspaceId}`,
      status: 'active',
      workflowType: 'pump_and_fill',
      workflowPhase: 'pre_mix',
      shipstationData: {
        customer_name: 'Test Customer',
        order_date: '2024-01-01',
        ship_date: '2024-01-05',
        items: [
          {
            id: '1',
            sku: 'TEST-SKU-001',
            description: 'Test Product 1',
            quantity: 1,
            workflow_type: 'pump_fill',
            requires_source: true,
          },
          {
            id: '2',
            sku: 'TEST-SKU-002',
            description: 'Test Product 2', 
            quantity: 1,
            workflow_type: 'direct_resell',
            requires_source: false,
          },
        ],
      },
    });
    
    console.log('✅ Test workspace created');
  }
  
  process.exit(0);
}

checkTestData().catch(console.error);