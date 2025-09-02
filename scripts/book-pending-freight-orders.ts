#!/usr/bin/env npx tsx
import { neon } from '@neondatabase/serverless';
import { config } from 'dotenv';
import { MyCarrierOrderInterceptor } from '../lib/freight-booking/mycarrier/order-interceptor';
import { classifyWithRAG } from '../lib/hazmat/classify';

config({ path: '.env.local' });

const sql = neon(process.env.DATABASE_URL!);

async function bookPendingOrders() {
  try {
    console.log('🚚 Starting MyCarrier Booking Process...\n');
    
    // Initialize MyCarrier client (use sandbox for testing)
    const useProduction = false; // Set to true for production
    const myCarrier = new MyCarrierOrderInterceptor(useProduction);
    
    console.log(`Environment: ${useProduction ? 'PRODUCTION' : 'SANDBOX'}`);
    
    // Test connection first
    console.log('Testing MyCarrier API connection...');
    const isConnected = await myCarrier.testConnection();
    
    if (!isConnected) {
      console.error('❌ Failed to connect to MyCarrier API');
      console.log('Please check your environment variables:');
      console.log('  - MYCARRIER_BASE_SANDBOX_URL');
      console.log('  - MYCARRIER_API_KEY_SANDBOX');
      console.log('  - MYCARRIER_USERNAME_SANDBOX');
      return;
    }
    
    console.log('✅ MyCarrier API connection successful!\n');
    
    // Fetch pending freight orders
    const pendingOrders = await sql`
      SELECT 
        id,
        order_id,
        order_number,
        carrier_name,
        service_type,
        origin_address,
        destination_address,
        package_details,
        special_instructions,
        estimated_cost
      FROM public.freight_orders
      WHERE booking_status = 'pending'
        AND mycarrier_order_id IS NULL
      ORDER BY created_at DESC
      LIMIT 1
    `;
    
    if (pendingOrders.length === 0) {
      console.log('📭 No pending orders to book');
      return;
    }
    
    console.log(`Found ${pendingOrders.length} pending order(s) to book\n`);
    
    for (const order of pendingOrders) {
      console.log(`\n📦 Processing Order: ${order.order_number}`);
      console.log(`   Carrier: ${order.carrier_name}`);
      console.log(`   Service: ${order.service_type}`);
      
      try {
        // Try to fetch real items from ShipStation for accurate SKUs
        const ssOrder = await fetchShipStationOrder(order.order_number);

        let myCarrierOrder: any;
        if (ssOrder) {
          const shipstationOrder = mapShipStationToInternal(ssOrder);
          myCarrierOrder = await MyCarrierOrderInterceptor.buildOrderFromFreightSelectionWithSavedClass(
            shipstationOrder,
            { carrier: order.carrier_name || 'SAIA', service: order.service_type || 'Standard', mode: 'LTL' },
            {}
          );
          // Override addresses from freight_order if present
          myCarrierOrder.originStop = {
            companyName: 'Alliance Chemical',
            streetLine1: order.origin_address?.address || myCarrierOrder.originStop?.streetLine1,
            city: order.origin_address?.city || myCarrierOrder.originStop?.city,
            state: order.origin_address?.state || myCarrierOrder.originStop?.state,
            zip: order.origin_address?.zipCode || myCarrierOrder.originStop?.zip,
            country: 'USA',
            locationType: 'Business',
            contactFirstName: 'Warehouse',
            contactLastName: 'Manager',
            contactPhone: '(555) 555-1234',
          };
          myCarrierOrder.destinationStop = {
            companyName: order.destination_address?.company || myCarrierOrder.destinationStop?.companyName,
            streetLine1: order.destination_address?.address || myCarrierOrder.destinationStop?.streetLine1,
            city: order.destination_address?.city || myCarrierOrder.destinationStop?.city,
            state: order.destination_address?.state || myCarrierOrder.destinationStop?.state,
            zip: order.destination_address?.zipCode || myCarrierOrder.destinationStop?.zip,
            country: 'USA',
            locationType: 'Business',
            contactFirstName: order.destination_address?.contactName?.split(' ')[0] || myCarrierOrder.destinationStop?.contactFirstName,
            contactLastName: order.destination_address?.contactName?.split(' ')[1] || myCarrierOrder.destinationStop?.contactLastName,
            contactPhone: order.destination_address?.phone || myCarrierOrder.destinationStop?.contactPhone,
          };
          myCarrierOrder.quoteReferenceID = order.order_number;
          myCarrierOrder.specialInstructions = order.special_instructions || '';
          myCarrierOrder.readyToDispatch = 'NO';
        } else {
          // Fallback: prior path building a single pallet with hazmat classification
          const quoteUnits = await buildQuoteUnitsWithHazmat(order);
          myCarrierOrder = {
            quoteReferenceID: order.order_number,
            serviceType: order.service_type || 'LTL',
            pickupDate: new Date().toISOString().split('T')[0],
            paymentDirection: 'Prepaid',
            carrier: order.carrier_name || 'SAIA',
            carrierService: order.service_type || 'Standard',
            specialInstructions: order.special_instructions || '',
            readyToDispatch: 'NO',
            originStop: {
              companyName: 'Alliance Chemical',
              streetLine1: order.origin_address?.address || '598 Virginia Street',
              city: order.origin_address?.city || 'River Grove',
              state: order.origin_address?.state || 'IL',
              zip: order.origin_address?.zipCode || '60171',
              country: 'USA',
              locationType: 'Business',
              contactFirstName: 'Warehouse',
              contactLastName: 'Manager',
              contactPhone: '(555) 555-1234',
            },
            destinationStop: {
              companyName: order.destination_address?.company || 'Customer',
              streetLine1: order.destination_address?.address || '123 Main St',
              city: order.destination_address?.city || 'Charlotte',
              state: order.destination_address?.state || 'NC',
              zip: order.destination_address?.zipCode || '28202',
              country: 'USA',
              locationType: 'Business',
              contactFirstName: order.destination_address?.contactName?.split(' ')[0] || 'Contact',
              contactLastName: order.destination_address?.contactName?.split(' ')[1] || 'Person',
              contactPhone: order.destination_address?.phone || '(555) 555-5678',
            },
            originAccessorials: { insidePickup: 'NO', liftgatePickup: 'NO', protectFromFreeze: 'NO' },
            destinationAccessorials: { notifyBeforeDelivery: 'YES', liftgateDelivery: 'NO', insideDelivery: 'NO', deliveryAppointment: 'NO' },
            quoteUnits,
          };
        }
        
        console.log('\n📡 Sending order to MyCarrier API...');
        
        // Send to MyCarrier with capture for AI learning
        const result = await myCarrier.createOrderWithCapture(
          myCarrierOrder,
          `booking-script-${Date.now()}`
        );
        
        if (result.isSuccess) {
          console.log('✅ Order successfully booked with MyCarrier!');
          
          // Extract the MyCarrier order ID and tracking info from response
          const myCarrierOrderId = result.orderId || result.confirmationNumber || `MC-${Date.now()}`;
          const trackingNumber = result.trackingNumber || result.proNumber || null;
          
          console.log(`   MyCarrier Order ID: ${myCarrierOrderId}`);
          if (trackingNumber) {
            console.log(`   Tracking Number: ${trackingNumber}`);
          }
          
          // Update the database with booking confirmation
          await sql`
            UPDATE public.freight_orders
            SET 
              mycarrier_order_id = ${myCarrierOrderId},
              tracking_number = ${trackingNumber},
              booking_status = 'booked',
              booked_at = NOW(),
              actual_cost = ${result.totalCost || order.estimated_cost},
              updated_at = NOW(),
              updated_by = 'booking-script'
            WHERE id = ${order.id}
          `;
          
          console.log('✅ Database updated with booking confirmation');
          
          // Also log the full response for debugging
          console.log('\n📋 Full MyCarrier Response:');
          console.log(JSON.stringify(result, null, 2));
          
        } else {
          console.error('❌ Failed to book order with MyCarrier');
          console.error('Error messages:', result.errorMessages);
          
          // Update database with failure status
          await sql`
            UPDATE public.freight_orders
            SET 
              booking_status = 'failed',
              internal_notes = ${JSON.stringify(result.errorMessages)},
              updated_at = NOW(),
              updated_by = 'booking-script'
            WHERE id = ${order.id}
          `;
        }
        
      } catch (error) {
        console.error(`❌ Error booking order ${order.order_number}:`, error);
        
        // Update database with error status
        await sql`
          UPDATE public.freight_orders
          SET 
            booking_status = 'error',
            internal_notes = ${error instanceof Error ? error.message : 'Unknown error'},
            updated_at = NOW(),
            updated_by = 'booking-script'
          WHERE id = ${order.id}
        `;
      }
    }
    
    console.log('\n\n✅ Booking process complete!');
    console.log('Run "npx tsx scripts/verify-mycarrier-booking.ts" to see updated status');
    
  } catch (error) {
    console.error('❌ Fatal error in booking process:', error);
  }
}

// Run the booking process
bookPendingOrders();

// Helpers
async function fetchShipStationOrder(orderNumber: string): Promise<any | null> {
  try {
    const apiKey = process.env.SHIPSTATION_API_KEY?.trim() || '';
    const apiSecret = process.env.SHIPSTATION_API_SECRET?.trim() || '';
    if (!apiKey || !apiSecret) return null;
    const auth = Buffer.from(`${apiKey}:${apiSecret}`).toString('base64');
    const params = new URLSearchParams({ orderNumber });
    const res = await fetch(`https://ssapi.shipstation.com/orders?${params.toString()}`, {
      headers: { 'Authorization': `Basic ${auth}`, 'Content-Type': 'application/json' },
    });
    if (!res.ok) return null;
    const data = await res.json();
    return (data.orders && data.orders[0]) || null;
  } catch {
    return null;
  }
}

function mapShipStationToInternal(ss: any) {
  return {
    orderId: ss.orderId,
    orderNumber: ss.orderNumber,
    customerEmail: ss.customerEmail || '',
    customerName: ss.billTo?.name || '',
    billTo: {
      name: ss.billTo?.name || '',
      company: ss.billTo?.company || '',
      street1: ss.billTo?.street1 || '',
      city: ss.billTo?.city || '',
      state: ss.billTo?.state || '',
      postalCode: ss.billTo?.postalCode || '',
    },
    shipTo: {
      name: ss.shipTo?.name || '',
      company: ss.shipTo?.company || '',
      street1: ss.shipTo?.street1 || '',
      city: ss.shipTo?.city || '',
      state: ss.shipTo?.state || '',
      postalCode: ss.shipTo?.postalCode || '',
    },
    items: (ss.items || []).map((it: any) => ({
      sku: it.sku,
      name: it.name,
      quantity: it.quantity,
      unitPrice: it.unitPrice || 0,
      weight: { value: it.weight?.value || it.weight || 0, units: (it.weight?.units || 'lbs') },
    })),
    orderTotal: ss.orderTotal || 0,
    shippingAmount: ss.shippingAmount || 0,
    orderDate: ss.orderDate,
    orderStatus: ss.orderStatus,
  };
}

async function buildQuoteUnitsWithHazmat(order: any) {
  const units: any[] = [];
  const description = order.package_details?.description || 'Chemical Product';
  const sku = `SKU-${order.order_number}`;
  const pieces = (order.package_details?.packageCount || 1).toString();
  const weight = (order.package_details?.weight?.value || 500).toString();
  const freightClass = order.package_details?.freightClass || '85';

  const cls = await classifyWithRAG(sku, description);
  const isHazmat = Boolean(cls.hazard_class && cls.un_number);

  const commodity: any = {
    productID: sku,
    commodityDescription: description,
    commodityPieces: pieces,
    commodityWeight: weight,
    commodityClass: freightClass,
    commodityHazMat: isHazmat ? 'YES' : 'NO',
  };
  if (isHazmat) {
    commodity.hazmatIDNumber = cls.un_number || undefined;
    commodity.hazmatProperShippingName = cls.proper_shipping_name || undefined;
    commodity.hazmatHazardClass = cls.hazard_class || undefined;
    commodity.hazmatPackingGroup = cls.packing_group || 'NONE';
  }

  if (isHazmat) {
    console.log('🔎 Hazmat classification:', {
      sku,
      un: cls.un_number,
      name: cls.proper_shipping_name,
      class: cls.hazard_class,
      pg: cls.packing_group,
      confidence: cls.confidence,
    });
  }

  units.push({
    shippingUnitType: 'Pallet',
    shippingUnitCount: '1',
    unitStackable: 'NO',
    quoteCommodities: [commodity],
  });

  return units;
}
