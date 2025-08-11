#!/usr/bin/env node
/**
 * Test script to create a workspace in pre_mix phase for testing the worker view
 * Run with: npx tsx scripts/test-worker-view.ts
 */

import { db } from '../lib/db';
import { workspaces } from '../lib/db/schema/qr-workspace';
import { eq } from 'drizzle-orm';

async function createTestWorkspace() {
  const orderId = 12345;
  
  try {
    // Check if workspace exists
    const existing = await db
      .select()
      .from(workspaces)
      .where(eq(workspaces.orderId, orderId))
      .limit(1);

    if (existing.length > 0) {
      // Update existing to pre_mix phase
      await db
        .update(workspaces)
        .set({
          workflowPhase: 'pre_mix',
          status: 'active',
          shipstationData: {
            orderNumber: orderId.toString(),
            orderDate: new Date().toISOString(),
            shipTo: {
              name: 'Test Customer Inc.',
              company: 'Alliance Chemical Test',
              street1: '123 Test Street',
              city: 'Test City',
              state: 'TX',
              postalCode: '12345',
              country: 'US',
              phone: '555-0123'
            },
            items: [
              {
                name: 'D-Limonene 99%',
                quantity: 5,
                sku: 'DL-99-5GAL',
                unitPrice: 45.00,
                weight: { value: 40, units: 'pounds' }
              },
              {
                name: 'Isopropyl Alcohol 70%',
                quantity: 10,
                sku: 'IPA-70-1GAL',
                unitPrice: 15.00,
                weight: { value: 8, units: 'pounds' }
              }
            ],
            weight: { value: 280, units: 'pounds' },
            customerNotes: 'Please handle with care',
            internalNotes: 'Rush order - priority customer'
          },
          moduleStates: {},
          updatedAt: new Date()
        })
        .where(eq(workspaces.orderId, orderId));
      
      console.log(`✅ Updated workspace ${orderId} to pre_mix phase`);
    } else {
      // Create new workspace
      await db.insert(workspaces).values({
        orderId: orderId,
        orderNumber: orderId.toString(),
        status: 'active',
        workflowPhase: 'pre_mix',
        shipstationData: {
          orderNumber: orderId.toString(),
          orderDate: new Date().toISOString(),
          shipTo: {
            name: 'Test Customer Inc.',
            company: 'Alliance Chemical Test',
            street1: '123 Test Street',
            city: 'Test City',
            state: 'TX',
            postalCode: '12345',
            country: 'US',
            phone: '555-0123'
          },
          items: [
            {
              name: 'D-Limonene 99%',
              quantity: 5,
              sku: 'DL-99-5GAL',
              unitPrice: 45.00,
              weight: { value: 40, units: 'pounds' }
            },
            {
              name: 'Isopropyl Alcohol 70%',
              quantity: 10,
              sku: 'IPA-70-1GAL',
              unitPrice: 15.00,
              weight: { value: 8, units: 'pounds' }
            }
          ],
          weight: { value: 280, units: 'pounds' },
          customerNotes: 'Please handle with care',
          internalNotes: 'Rush order - priority customer'
        },
        moduleStates: {},
        createdAt: new Date(),
        updatedAt: new Date()
      });
      
      console.log(`✅ Created new workspace ${orderId} in pre_mix phase`);
    }

    console.log(`\n🚀 Test the worker view at: http://localhost:3000/workspace/${orderId}`);
    console.log('   The page should default to the Worker View with Pre-Mix Inspection');
    console.log('\n📋 Test scenarios:');
    console.log('   1. Click "START PRE-MIX INSPECTION" to begin');
    console.log('   2. Test PASS/FAIL buttons for each item');
    console.log('   3. When you click FAIL, test the issue reporting modal');
    console.log('   4. Complete all items to see the completion screen');
    console.log('   5. Use "Switch to Supervisor View" link to see the original interface');
    
    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
}

createTestWorkspace();