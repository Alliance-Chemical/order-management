#!/usr/bin/env node

import { config } from 'dotenv';
config({ path: '.env.local' });

import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { sql } from 'drizzle-orm';

async function testDemo() {
  const client = postgres(process.env.DATABASE_URL!, {
    prepare: false,
  });
  const db = drizzle(client);

  try {
    console.log('🔍 Checking demo workspaces...\n');
    
    const result = await db.execute(sql`
      SELECT order_id, order_number, status, workflow_type, workflow_phase
      FROM qr_workspace.workspaces
      WHERE order_id >= 99000
      ORDER BY order_id
      LIMIT 5
    `);

    const rows = result as any[];
    if (!rows || rows.length === 0) {
      console.log('❌ No demo workspaces found! Run npm run demo:seed first.');
    } else {
      console.log(`✅ Found ${rows.length} demo workspaces:\n`);
      rows.forEach((row: any) => {
        console.log(`  Order #${row.order_id} (${row.order_number})`);
        console.log(`    Status: ${row.status}`);
        console.log(`    Type: ${row.workflow_type}`);
        console.log(`    Phase: ${row.workflow_phase}`);
        console.log(`    URL: http://localhost:3003/workspace/${row.order_id}\n`);
      });
    }

    // Test API endpoint
    console.log('🔍 Testing API endpoint for order 99001...\n');
    const response = await fetch('http://localhost:3003/api/workspace/99001');
    if (response.ok) {
      console.log('✅ API endpoint working!');
      const data = await response.json();
      console.log(`  Order: ${data.orderNumber}`);
      console.log(`  Status: ${data.status}`);
    } else {
      console.log(`❌ API returned ${response.status}: ${response.statusText}`);
    }

  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await client.end();
  }
}

testDemo();