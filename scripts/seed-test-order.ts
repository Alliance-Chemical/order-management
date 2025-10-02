import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { eq } from 'drizzle-orm';
import { config } from 'dotenv';
import { workspaces, qrCodes } from '../lib/db/schema/qr-workspace';
import { v4 as uuidv4 } from 'uuid';

// Load test environment variables
config({ path: '.env.test' });

if (!process.env.DATABASE_URL) {
  throw new Error('DATABASE_URL not found in .env.test');
}

const sql = postgres(process.env.DATABASE_URL);
const db = drizzle(sql);

async function seedTestData() {
  console.log('🌱 Seeding test database...');

  try {
    // Create test workspace with specific order ID that Playwright test expects
    const testOrderId = 67890;
    const testOrderNumber = 'TEST-ORDER-67890';
    const workspaceId = uuidv4();

    // Insert test workspace
    const [workspace] = await db.insert(workspaces).values({
      id: workspaceId,
      orderId: testOrderId,
      orderNumber: testOrderNumber,
      workspaceUrl: `http://localhost:3000/workspace/${testOrderId}`,
      status: 'active',
      workflowPhase: 'pre_mix',
      activeModules: {
        preMix: true,
        warehouse: true,
        documents: true
      },
      moduleStates: {
        preMix: {
          status: 'in_progress',
          inspection: {
            chemical1: { 
              name: 'Sodium Hydroxide',
              quantity: '50 gallons',
              checked: false 
            },
            chemical2: { 
              name: 'Citric Acid',
              quantity: '25 kg',
              checked: false 
            },
            chemical3: { 
              name: 'D-Limonene',
              quantity: '100 liters',
              checked: false 
            }
          }
        },
        warehouse: {
          status: 'pending'
        },
        documents: {
          status: 'pending',
          uploaded: []
        }
      },
      shipstationData: {
        customerName: 'Acme Chemical Co.',
        customerEmail: 'orders@acmechemical.com',
        shipTo: {
          name: 'Acme Chemical Co.',
          street1: '123 Industrial Way',
          city: 'Houston',
          state: 'TX',
          postalCode: '77001'
        },
        items: [
          {
            sku: 'SH-50',
            name: 'Sodium Hydroxide',
            quantity: 50,
            unitPrice: 25.00,
            weight: { value: 500, units: 'pounds' }
          },
          {
            sku: 'CA-25',
            name: 'Citric Acid',
            quantity: 25,
            unitPrice: 35.00,
            weight: { value: 55, units: 'pounds' }
          },
          {
            sku: 'DL-100',
            name: 'D-Limonene',
            quantity: 100,
            unitPrice: 15.00,
            weight: { value: 220, units: 'pounds' }
          }
        ],
        orderTotal: 3625.00,
        orderDate: new Date().toISOString()
      },
      createdBy: 'test-seeder'
    }).returning();

    console.log(`✅ Created test workspace: ${workspace.orderNumber}`);

    // Create QR codes for the workspace
    const masterQrId = uuidv4();
    await db.insert(qrCodes).values({
      id: masterQrId,
      workspaceId: workspace.id,
      qrType: 'master',
      qrCode: `QR-${testOrderId}-MASTER`,
      shortCode: `M-${testOrderId}`,
      orderId: testOrderId,
      orderNumber: testOrderNumber,
      encodedData: {
        type: 'master',
        orderId: testOrderId,
        orderNumber: testOrderNumber,
        timestamp: new Date().toISOString()
      },
      qrUrl: `http://localhost:3000/qr/scan?code=QR-${testOrderId}-MASTER`,
      isActive: true
    });

    // Note: masterQrId field removed from schema - QR linked via workspaceId foreign key

    console.log('✅ Created QR codes for test workspace');

    console.log('\n🎉 Test data seeding complete!');
    console.log(`\n📋 Test Order Details:`);
    console.log(`   Order ID: ${testOrderId}`);
    console.log(`   Order Number: ${testOrderNumber}`);
    console.log(`   Customer: Acme Chemical Co.`);
    console.log(`   Workspace URL: http://localhost:3000/workspace/${testOrderId}`);
    
  } catch (error) {
    console.error('❌ Error seeding test data:', error);
    throw error;
  } finally {
    await sql.end();
  }
}

// Run the seeder
seedTestData().catch(console.error);