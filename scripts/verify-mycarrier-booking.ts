#!/usr/bin/env npx tsx
import { neon } from '@neondatabase/serverless';
import { config } from 'dotenv';

config({ path: '.env.local' });

const sql = neon(process.env.DATABASE_URL!);

async function verifyMyCarrierBooking() {
  try {
    console.log('🔍 Checking MyCarrier booking status...\n');

    // First check what schemas and tables exist
    const schemas = await sql`
      SELECT schema_name 
      FROM information_schema.schemata 
      WHERE schema_name NOT IN ('pg_catalog', 'information_schema', 'pg_toast')
      ORDER BY schema_name
    `;
    
    console.log('Available schemas:', schemas.map(s => s.schema_name).join(', '));

    // Check freight_orders table (primary booking data)
    try {
      const freightOrders = await sql`
        SELECT 
          id,
          order_id,
          order_number,
          mycarrier_order_id,
          tracking_number,
          carrier_name,
          service_type,
          estimated_cost,
          actual_cost,
          origin_address,
          destination_address,
          booking_status,
          booked_at,
          confidence_score,
          decision_source,
          session_id,
          created_at
        FROM public.freight_orders
        ORDER BY created_at DESC
        LIMIT 5
      `;

      if (freightOrders.length > 0) {
        console.log('\n✅ Recent Freight Orders Found:');
        console.log('═══════════════════════════════════════');
        
        freightOrders.forEach((order, index) => {
          const origin = order.origin_address ? order.origin_address.city || order.origin_address.address : 'N/A';
          const dest = order.destination_address ? order.destination_address.city || order.destination_address.address : 'N/A';
          
          console.log(`\n📦 Order #${index + 1}:`);
          console.log(`   Order Number: ${order.order_number}`);
          console.log(`   MyCarrier ID: ${order.mycarrier_order_id || 'Not yet assigned'}`);
          console.log(`   Tracking: ${order.tracking_number || 'Not yet available'}`);
          console.log(`   Carrier: ${order.carrier_name || 'Not specified'}`);
          console.log(`   Service: ${order.service_type || 'Not specified'}`);
          console.log(`   Origin: ${origin}`);
          console.log(`   Destination: ${dest}`);
          console.log(`   Estimated Cost: ${order.estimated_cost ? `$${order.estimated_cost}` : 'N/A'}`);
          console.log(`   Actual Cost: ${order.actual_cost ? `$${order.actual_cost}` : 'N/A'}`);
          console.log(`   Booking Status: ${order.booking_status || 'pending'}`);
          console.log(`   Booked At: ${order.booked_at ? new Date(order.booked_at).toLocaleString() : 'Not booked'}`);
          console.log(`   Confidence: ${order.confidence_score ? `${(order.confidence_score * 100).toFixed(0)}%` : 'N/A'}`);
          console.log(`   Decision Source: ${order.decision_source || 'N/A'}`);
          console.log(`   Session ID: ${order.session_id || 'N/A'}`);
          console.log(`   Created: ${new Date(order.created_at).toLocaleString()}`);
        });
      } else {
        console.log('\n❌ No freight orders found');
      }
    } catch (e) {
      console.log('❌ freight_orders table error:', e.message);
    }

    // Check freight_events table for booking events
    try {
      const freightEvents = await sql`
        SELECT 
          id,
          event_type,
          event_data,
          created_at
        FROM public.freight_events
        WHERE event_type LIKE '%booking%' OR event_type LIKE '%order%'
        ORDER BY created_at DESC
        LIMIT 5
      `;

      if (freightEvents.length > 0) {
        console.log('\n\n📊 Recent Freight Events:');
        console.log('═══════════════════════════════════════');
        
        freightEvents.forEach((event, index) => {
          console.log(`\n🎯 Event #${index + 1}:`);
          console.log(`   Type: ${event.event_type}`);
          console.log(`   Data: ${JSON.stringify(event.event_data).substring(0, 100)}...`);
          console.log(`   Created: ${new Date(event.created_at).toLocaleString()}`);
        });
      }
    } catch (e) {
      console.log('❌ freight_events table not found');
    }

    // Check for related workspaces
    try {
      const workspaces = await sql`
        SELECT 
          w.id,
          w.order_id,
          w.order_number,
          w.workspace_url,
          w.status,
          w.created_at
        FROM qr_workspace.workspaces w
        ORDER BY w.created_at DESC
        LIMIT 5
      `;

      if (workspaces.length > 0) {
        console.log('\n\n🏭 Recent Workspaces:');
        console.log('═══════════════════════════════════════');
        
        workspaces.forEach((ws, index) => {
          console.log(`\n📋 Workspace #${index + 1}:`);
          console.log(`   ID: ${ws.id}`);
          console.log(`   Order: ${ws.order_number}`);
          console.log(`   Status: ${ws.status}`);
          console.log(`   URL: ${ws.workspace_url}`);
          console.log(`   Created: ${new Date(ws.created_at).toLocaleString()}`);
        });
      } else {
        console.log('\n❌ No workspaces found');
      }
    } catch (e) {
      console.log('❌ workspaces table error:', e.message);
    }

    console.log('\n\n📝 Summary:');
    console.log('═══════════════════════════════════════');
    console.log('Check the above sections for booking data.');
    console.log('\nTo verify MyCarrier booking worked, look for:');
    console.log('1. ✅ Freight orders with carrier and service type');
    console.log('2. ✅ Freight events showing booking activity');
    console.log('3. ✅ Workspaces created for the orders');
    console.log('\n💡 If no data found, place a test order through /freight-booking');

  } catch (error) {
    console.error('❌ Error verifying booking:', error);
    console.log('\nTip: Make sure your DATABASE_URL is set correctly in .env.local');
  }
}

// Run the verification
verifyMyCarrierBooking();