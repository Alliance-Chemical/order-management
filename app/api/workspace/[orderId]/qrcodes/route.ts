import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { workspaces, qrCodes } from '@/lib/db/schema/qr-workspace';
import { freightOrders } from '@/lib/db/schema/freight';
import { eq } from 'drizzle-orm';
import { filterOutDiscounts } from '@/lib/services/orders/normalize';
import { detectContainer } from '@/lib/services/qr/container-detect';

type ShipStationItem = { sku?: string; name?: string; quantity?: number; orderItemId?: string; unitPrice?: number };
type ShipStationOrder = { orderNumber?: string; items?: ShipStationItem[] };
type Freight = {
  bookingStatus?: string;
  carrierName?: string;
  serviceType?: string;
  trackingNumber?: string;
  estimatedCost?: number;
  bookedAt?: string;
  deliveredAt?: string | null;
  originAddress?: unknown;
  destinationAddress?: unknown;
  specialInstructions?: string;
} | null;

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ orderId: string }> }
) {
  try {
    const params = await context.params;
    const orderIdParam = params.orderId;
    const orderId = Number(orderIdParam);
    if (Number.isNaN(orderId)) {
      console.error('Invalid orderId param for QR fetch:', orderIdParam);
      return NextResponse.json(
        { success: false, error: 'Invalid orderId' },
        { status: 400 }
      );
    }

    console.log(`[QR] Fetching QRs for orderId: ${orderId}`);

    // First find the workspace
    const workspace = await db
      .select()
      .from(workspaces)
      .where(eq(workspaces.orderId, orderId))
      .limit(1);

    if (!workspace || workspace.length === 0) {
      // If no workspace exists, create one first but FETCH ShipStation data immediately
      console.warn(`[QR] Workspace not found for orderId=${orderId}. Creating on-demand with ShipStation data...`);
      
      // Fetch order data from ShipStation FIRST
      let shipstationData: ShipStationOrder | null = null;
      let orderNumber = String(orderId);
      
      try {
        const apiKey = process.env.SHIPSTATION_API_KEY?.trim() || '';
        const apiSecret = process.env.SHIPSTATION_API_SECRET?.trim() || '';
        const auth = Buffer.from(`${apiKey}:${apiSecret}`).toString('base64');
        
        console.log(`[QR] Fetching order ${orderId} from ShipStation...`);
        const response = await fetch(`https://ssapi.shipstation.com/orders/${orderId}`, {
          headers: {
            'Authorization': `Basic ${auth}`,
            'Content-Type': 'application/json',
          },
        });
        
        if (response.ok) {
          shipstationData = await response.json();
          orderNumber = shipstationData?.orderNumber || String(orderId);
          console.log(`[QR] Successfully fetched ShipStation order ${orderNumber} with ${shipstationData?.items?.length || 0} items`);
        } else {
          console.error(`[QR] Failed to fetch from ShipStation: ${response.status} ${response.statusText}`);
        }
      } catch (error) {
        console.error('[QR] Error fetching order from ShipStation:', error);
      }
      
      const newWorkspace = await db
        .insert(workspaces)
        .values({
          orderId,
          orderNumber,
          workspaceUrl: `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/workspace/${orderId}`,
          status: 'pending',
          shipstationData,
          lastShipstationSync: shipstationData ? new Date() : null,
          createdAt: new Date(),
          updatedAt: new Date()
        })
        .returning();

      if (newWorkspace.length === 0) {
        return NextResponse.json(
          { success: false, error: 'Failed to create workspace' },
          { status: 500 }
        );
      }

      // Generate QR codes for the new workspace
      console.log('[QR] --- TRIGGERING ON-DEMAND QR GENERATION (new workspace with ShipStation data) ---');
      await generateQRCodesForWorkspace(newWorkspace[0].id, orderId);
    }

    // Get the workspace ID
    const workspaceRecord = workspace[0] || (await db
      .select()
      .from(workspaces)
      .where(eq(workspaces.orderId, orderId))
      .limit(1))[0];
    if (!workspaceRecord) {
      console.error('[QR] --- BUG --- Workspace not found after creation.');
      return NextResponse.json(
        { success: false, error: 'Workspace not found after creation' },
        { status: 500 }
      );
    }
    console.log(`[QR] Found workspace: ${workspaceRecord.orderNumber}`);
    const workspaceId = workspaceRecord.id;

    // Fetch all QR codes for this workspace
    // Only container QRs now - simple ordering by container number
    const qrCodeRecords = await db
      .select()
      .from(qrCodes)
      .where(eq(qrCodes.workspaceId, workspaceId))
      .orderBy(
        qrCodes.containerNumber,
        qrCodes.chemicalName
      );
    console.log(`[QR] Found ${qrCodeRecords.length} existing QR codes.`);

    // If no QR codes exist, generate them
    if (qrCodeRecords.length === 0) {
      console.log('[QR] --- TRIGGERING ON-DEMAND QR GENERATION (no existing codes) ---');
      await generateQRCodesForWorkspace(workspaceId, orderId);
      
      // Fetch again after generation - simple ordering
      const newQrCodes = await db
        .select()
        .from(qrCodes)
        .where(eq(qrCodes.workspaceId, workspaceId))
        .orderBy(
          qrCodes.containerNumber,
          qrCodes.chemicalName
        );
      
      return NextResponse.json({
        success: true,
        qrCodes: newQrCodes,
        workspaceId,
        message: 'QR codes generated successfully'
      });
    }

    return NextResponse.json({
      success: true,
      qrCodes: qrCodeRecords,
      workspaceId
    });

  } catch (error) {
    console.error('Error fetching QR codes:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch QR codes' },
      { status: 500 }
    );
  }
}

async function generateQRCodesForWorkspace(workspaceId: string, orderId: number) {
  // Fetch existing QR codes first to avoid duplicates
  const existingQRCodes = await db
    .select()
    .from(qrCodes)
    .where(eq(qrCodes.workspaceId, workspaceId));
  
  console.log(`[QR] Found ${existingQRCodes.length} existing QR codes for workspace ${workspaceId}`);
  
  // No longer need to check for master or source QRs
  
  // Attempt to read workspace and freight info to enrich records
  const ws = await db
    .select()
    .from(workspaces)
    .where(eq(workspaces.id, workspaceId))
    .limit(1);
  const orderNumber = ws[0]?.orderNumber || String(orderId);
  const shipstationData = ws[0]?.shipstationData as ShipStationOrder | undefined;
  
  // Fetch freight order information for enhanced QR context (optional)
  let freightData: Freight = null;
  try {
    const freightOrder = await db
      .select()
      .from(freightOrders)
      .where(eq(freightOrders.workspaceId, workspaceId))
      .limit(1);
    freightData = (freightOrder[0] as unknown as Freight) || null;
  } catch (e: unknown) {
    // If freight tables haven't been migrated yet, skip enrichment gracefully
    const err = e as { code?: string; cause?: { code?: string }; message?: string };
    const code = err?.code || err?.cause?.code;
    if (code === '42P01' || /relation \"?freight_orders\"? does not exist/i.test(String(err?.message || ''))) {
      console.warn('[QR] Freight tables not present yet; continuing without freight enrichment');
    } else {
      console.warn('[QR] Freight lookup failed; continuing', e);
    }
  }
  if (freightData) {
    console.log('[QR] Found freight order for workspace', { carrier: freightData.carrierName, status: freightData.bookingStatus });
  } else {
    console.log('[QR] No freight order found for workspace (optional)');
  }

  const now = Date.now();
  const makeCode = (suffix: string) => `QR-${orderId}-${suffix}-${now}-${Math.floor(Math.random() * 1000)}`;
  const makeShort = () => Math.random().toString(36).slice(2, 8).toUpperCase();
  // Use production Vercel URL for QR codes, ensuring it's trimmed
  const baseUrl = (process.env.NEXT_PUBLIC_APP_URL || 'https://order-management-kappa-seven.vercel.app').trim();

  const records: Array<typeof qrCodes.$inferInsert> = [];

  // Process container QRs based on ShipStation data or fetch fresh data
  let items: ShipStationItem[] = [];
  
  // First, try to use data from workspace
  if (shipstationData?.items && Array.isArray(shipstationData.items)) {
    console.log(`[QR] Found ${shipstationData.items.length} total items in workspace shipstationData`);
    
    // Log ALL items before filtering for debugging
    shipstationData.items.forEach((item: ShipStationItem, index: number) => {
      console.log(`[QR] Item ${index + 1}: SKU="${item.sku || 'N/A'}", Name="${item.name}", Price=${item.unitPrice}, Qty=${item.quantity}`);
    });
    
    // Filter out discount items (centralized)
    items = filterOutDiscounts(shipstationData.items);
    console.log(`[QR] Result: ${items.length} physical items from workspace (after filtering ${shipstationData.items.length - items.length} discounts)`);
    
    // ADDITIONAL DEBUG: Log what was filtered out
    if (shipstationData.items.length > items.length) {
      console.log(`[QR] FILTERED OUT ITEMS:`);
      shipstationData.items.filter((item: ShipStationItem) => !items.includes(item)).forEach((filteredItem: ShipStationItem, index: number) => {
        console.log(`[QR] Filtered Item ${index + 1}: SKU="${filteredItem.sku || 'N/A'}", Name="${filteredItem.name}", Price=${filteredItem.unitPrice}, Qty=${filteredItem.quantity}`);
      });
    }
  } else {
    // If no items in workspace, fetch from ShipStation
    console.log('[QR] No items in workspace, fetching from ShipStation API...');
    try {
      const apiKey = process.env.SHIPSTATION_API_KEY?.trim() || '';
      const apiSecret = process.env.SHIPSTATION_API_SECRET?.trim() || '';
      const auth = Buffer.from(`${apiKey}:${apiSecret}`).toString('base64');
      
      console.log(`[QR] Fetching order ${orderId} from ShipStation...`);
      const response = await fetch(`https://ssapi.shipstation.com/orders/${orderId}`, {
        headers: {
          'Authorization': `Basic ${auth}`,
          'Content-Type': 'application/json',
        },
      });
      
      if (response.ok) {
        const orderData = await response.json();
        console.log(`[QR] ShipStation returned ${orderData.items?.length || 0} total items`);
        
        // Log ALL items before filtering
        (orderData.items || []).forEach((item: ShipStationItem, index: number) => {
          console.log(`[QR] Item ${index + 1}: SKU="${item.sku || 'N/A'}", Name="${item.name}", Price=${item.unitPrice}, Qty=${item.quantity}`);
        });
        
        // Filter out discount items (centralized)
        items = filterOutDiscounts(orderData.items || []) as ShipStationItem[];
        console.log(`[QR] Result: ${items.length} physical items from API (after filtering ${(orderData.items?.length || 0) - items.length} discounts)`);
        
        // Update workspace with the fetched data
        await db
          .update(workspaces)
          .set({ 
            shipstationData: orderData,
            lastShipstationSync: new Date()
          })
          .where(eq(workspaces.id, workspaceId));
      } else {
        console.error(`[QR] ShipStation API error: ${response.status} ${response.statusText}`);
      }
    } catch (error) {
      console.error('[QR] Error fetching order details:', error);
    }
  }

  // No master QRs - only generate container QRs for individual items
  console.log('[QR] Generating container QRs only (no master, no source)');

  // Process each item to generate container QRs
  let globalContainerIndex = 0; // Global counter for unique container IDs across the order
  
  for (const item of items) {
    const itemId = item.orderItemId || item.sku || `item-${items.indexOf(item)}`;
    const itemName = item.name || 'Unknown Product';
    const quantity = item.quantity || 1;
    
    // Check if QR codes for this item already exist
    const existingItemQRs = existingQRCodes.filter(qr => 
      qr.qrType === 'container' && 
      (qr.encodedData?.itemId === itemId || qr.encodedData?.sku === item.sku)
    );
    
    if (existingItemQRs.length > 0) {
      console.log(`[QR] Skipping item ${itemName} - ${existingItemQRs.length} QR codes already exist`);
      globalContainerIndex += existingItemQRs.length; // Update global counter to maintain unique IDs
      continue;
    }
    
    // Determine container count and type using strict ordered matcher
    const match = detectContainer(itemName, item.sku, quantity);
    let totalContainersForThisItem = match.labels;
    const containerType = match.type;
    
    // Ensure we always create at least 1 label
    if (totalContainersForThisItem < 1) {
      totalContainersForThisItem = 1;
    }
    
    console.log(`[QR] Creating ${totalContainersForThisItem} ${containerType} label(s) for: "${itemName}" (SKU: ${item.sku || 'N/A'}, Qty: ${quantity})`);
    
    // Generate container labels for THIS SPECIFIC ITEM
    // Each item gets its own numbered sequence (1 of N, 2 of N, etc.)
    for (let containerIndexForThisItem = 1; containerIndexForThisItem <= totalContainersForThisItem; containerIndexForThisItem++) {
      globalContainerIndex++; // Increment global counter for unique database IDs
      
      records.push({
        workspaceId,
        qrType: 'container',
        qrCode: makeCode(`CONTAINER-${globalContainerIndex}`),
        shortCode: makeShort(),
        orderId,
        orderNumber,
        containerNumber: globalContainerIndex, // Global unique ID for database
        chemicalName: itemName, // Store the item name for the label
        encodedData: { 
          type: 'container', 
          orderId, 
          orderNumber, 
          containerType: containerType,
          containerNumber: containerIndexForThisItem, // THIS item's container number (1, 2, 3...)
          totalContainers: totalContainersForThisItem, // Total labels for THIS specific item
          originalQuantity: quantity, // IMPORTANT: Show the actual quantity being shipped
          itemId: itemId,
          sku: item.sku,
          itemName: itemName,
          // Add freight booking context for warehouse workers
          freight: freightData ? {
            status: freightData.bookingStatus,
            carrier: freightData.carrierName,
            serviceType: freightData.serviceType,
            trackingNumber: freightData.trackingNumber,
            estimatedCost: freightData.estimatedCost,
            bookedAt: freightData.bookedAt,
            expectedDelivery: freightData.deliveredAt || 'TBD',
            originAddress: freightData.originAddress,
            destinationAddress: freightData.destinationAddress,
            specialInstructions: freightData.specialInstructions
          } : null
        },
        qrUrl: `${baseUrl}/workspace/${orderId}`,
        scanCount: 0,
        isActive: true,
        createdAt: new Date(),
      });
    }
  }
  
  // If no items were found and no container QRs exist, create a default one
  if (items.length === 0 && !existingQRCodes.some(qr => qr.qrType === 'container')) {
    console.log(`[QR] ⚠️  NO ITEMS FOUND - Creating 1 default container QR. Debug info:`);
    console.log(`[QR] - Workspace has shipstationData: ${!!shipstationData}`);
    console.log(`[QR] - shipstationData has items: ${!!(shipstationData?.items)}`);
    console.log(`[QR] - items is array: ${Array.isArray(shipstationData?.items)}`);
    console.log(`[QR] - Raw items count: ${shipstationData?.items?.length || 0}`);
    console.log(`[QR] - Existing QR codes: ${existingQRCodes.length}`);
    console.log(`[QR] - Container QRs exist: ${existingQRCodes.some(qr => qr.qrType === 'container')}`);
    records.push({
      workspaceId,
      qrType: 'container',
      qrCode: makeCode('CONTAINER-1'),
      shortCode: makeShort(),
      orderId,
      orderNumber,
      containerNumber: 1,
      chemicalName: 'Product', // Generic name when no data available
      encodedData: { 
        type: 'container', 
        orderId, 
        orderNumber, 
        containerType: 'drum', 
        containerNumber: 1,
        totalContainers: 1,
        // Add freight booking context for warehouse workers
        freight: freightData ? {
          status: freightData.bookingStatus,
          carrier: freightData.carrierName,
          serviceType: freightData.serviceType,
          trackingNumber: freightData.trackingNumber,
          estimatedCost: freightData.estimatedCost,
          bookedAt: freightData.bookedAt,
          expectedDelivery: freightData.deliveredAt || 'TBD',
          originAddress: freightData.originAddress,
          destinationAddress: freightData.destinationAddress,
          specialInstructions: freightData.specialInstructions
        } : null
      },
      qrUrl: `${baseUrl}/workspace/${orderId}`,
      scanCount: 0,
      isActive: true,
      createdAt: new Date(),
    });
  }

  if (records.length > 0) {
    console.log(`[QR] Inserting ${records.length} new QR codes`);
    await db.insert(qrCodes).values(records);
  } else {
    console.log('[QR] No new QR codes to create - all already exist');
  }
}

// POST endpoint to regenerate QR codes or add specific types
export async function POST(
  request: NextRequest,
  context: { params: Promise<{ orderId: string }> }
) {
  try {
    const params = await context.params;
    const { type, quantity } = await request.json();
    const orderId = Number(params.orderId);

    // Find the workspace
    const workspace = await db
      .select()
      .from(workspaces)
      .where(eq(workspaces.orderId, orderId))
      .limit(1);

    if (!workspace || workspace.length === 0) {
      return NextResponse.json(
        { success: false, error: 'Workspace not found' },
        { status: 404 }
      );
    }

    const workspaceId = workspace[0].id;
    const qrCodesToCreate = [];

    // Generate QR codes based on type
    if (type === 'source') {
      const qrCode = `QR-${orderId}-SOURCE-${Date.now()}`;
      const shortCode = `S${orderId}-${Date.now() % 100000}`;
      qrCodesToCreate.push({
        workspaceId,
        orderId,
        orderNumber: workspace[0].orderNumber,
        qrType: 'master',
        qrCode,
        shortCode,
        qrUrl: `${process.env.NEXT_PUBLIC_BASE_URL}/workspace/${orderId}?qr=${shortCode}`,
        encodedData: { isSource: true, type: 'master', orderId, shortCode },
        createdAt: new Date()
      });
    } else if (type === 'tote') {
      for (let i = 1; i <= (quantity || 1); i++) {
        const qrCode = `QR-${orderId}-TOTE-${i}-${Date.now()}`;
        const shortCode = `T${orderId}-${i}-${Date.now() % 100000}`;
        qrCodesToCreate.push({
          workspaceId,
          orderId,
          orderNumber: workspace[0].orderNumber,
          qrType: 'container',
          qrCode,
          shortCode,
          qrUrl: `${process.env.NEXT_PUBLIC_BASE_URL}/workspace/${orderId}?qr=${shortCode}`,
          encodedData: {
            containerNumber: i,
            containerType: 'tote',
            type: 'container',
            orderId,
            shortCode
          },
          containerNumber: i,
          createdAt: new Date()
        });
      }
    } else if (type === 'pallet') {
      for (let i = 1; i <= (quantity || 1); i++) {
        const qrCode = `QR-${orderId}-PALLET-${i}-${Date.now()}`;
        const shortCode = `P${orderId}-${i}-${Date.now() % 100000}`;
        qrCodesToCreate.push({
          workspaceId,
          orderId,
          orderNumber: workspace[0].orderNumber,
          qrType: 'pallet',
          qrCode,
          shortCode,
          qrUrl: `${process.env.NEXT_PUBLIC_BASE_URL}/workspace/${orderId}?qr=${shortCode}`,
          encodedData: {
            palletNumber: i,
            type: 'pallet',
            orderId,
            shortCode
          },
          containerNumber: i,
          createdAt: new Date()
        });
      }
    }

    // Insert the new QR codes
    if (qrCodesToCreate.length > 0) {
      await db.insert(qrCodes).values(qrCodesToCreate);
    }

    // Fetch all QR codes for response
    const allQrCodes = await db
      .select()
      .from(qrCodes)
      .where(eq(qrCodes.workspaceId, workspaceId));

    return NextResponse.json({
      success: true,
      qrCodes: allQrCodes,
      message: `Generated ${qrCodesToCreate.length} new QR codes`
    });

  } catch (error) {
    console.error('Error generating QR codes:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to generate QR codes' },
      { status: 500 }
    );
  }
}
