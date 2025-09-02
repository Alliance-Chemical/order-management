import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { workspaces, qrCodes } from '@/lib/db/schema/qr-workspace';
import { freightOrders } from '@/lib/db/schema/freight';
import { eq, sql } from 'drizzle-orm';

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
      let shipstationData = null;
      let orderNumber = String(orderId);
      let customerName = null;
      
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
          orderNumber = shipstationData.orderNumber || String(orderId);
          customerName = shipstationData.shipTo?.name || null;
          console.log(`[QR] Successfully fetched ShipStation order ${orderNumber} with ${shipstationData.items?.length || 0} items`);
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
          customerName,
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
  const shipstationData = ws[0]?.shipstationData as any;
  
  // Fetch freight order information for enhanced QR context
  const freightOrder = await db
    .select()
    .from(freightOrders)
    .where(eq(freightOrders.workspaceId, workspaceId))
    .limit(1);
  
  const freightData = freightOrder[0] || null;
  console.log(`[QR] Found freight order for workspace: ${freightData ? 'Yes' : 'No'}`, 
              freightData ? { carrier: freightData.carrierName, status: freightData.bookingStatus } : {});

  const now = Date.now();
  const makeCode = (suffix: string) => `QR-${orderId}-${suffix}-${now}-${Math.floor(Math.random() * 1000)}`;
  const makeShort = () => Math.random().toString(36).slice(2, 8).toUpperCase();
  // Use production Vercel URL for QR codes, ensuring it's trimmed
  const baseUrl = (process.env.NEXT_PUBLIC_APP_URL || 'https://order-management-kappa-seven.vercel.app').trim();

  const records: Array<typeof qrCodes.$inferInsert> = [];

  // Process container QRs based on ShipStation data or fetch fresh data
  let items: any[] = [];
  
  // First, try to use data from workspace
  if (shipstationData?.items && Array.isArray(shipstationData.items)) {
    console.log(`[QR] Found ${shipstationData.items.length} total items in workspace shipstationData`);
    
    // Log ALL items before filtering for debugging
    shipstationData.items.forEach((item: any, index: number) => {
      console.log(`[QR] Item ${index + 1}: SKU="${item.sku || 'N/A'}", Name="${item.name}", Price=${item.unitPrice}, Qty=${item.quantity}`);
    });
    
    // Filter out discount items
    items = shipstationData.items.filter((item: any) => {
      const hasNoSku = !item.sku || item.sku === '';
      const isDiscount = item.name?.toLowerCase().includes('discount') || 
                       item.unitPrice < 0 || 
                       item.lineItemKey?.includes('discount');
      if (hasNoSku && isDiscount) {
        console.log(`[QR] ✗ Filtering out discount item: ${item.name} (no SKU + discount indicator)`);
        return false;
      }
      console.log(`[QR] ✓ Including physical item: ${item.name} (SKU: ${item.sku || 'N/A'})`);
      return true;
    });
    console.log(`[QR] Result: ${items.length} physical items from workspace (after filtering ${shipstationData.items.length - items.length} discounts)`);
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
        (orderData.items || []).forEach((item: any, index: number) => {
          console.log(`[QR] Item ${index + 1}: SKU="${item.sku || 'N/A'}", Name="${item.name}", Price=${item.unitPrice}, Qty=${item.quantity}`);
        });
        
        // Filter out discount items
        items = (orderData.items || []).filter((item: any) => {
          const hasNoSku = !item.sku || item.sku === '';
          const isDiscount = item.name?.toLowerCase().includes('discount') || 
                           item.unitPrice < 0 || 
                           item.lineItemKey?.includes('discount');
          if (hasNoSku && isDiscount) {
            console.log(`[QR] ✗ Filtering out discount item: ${item.name} (no SKU + discount indicator)`);
            return false;
          }
          console.log(`[QR] ✓ Including physical item: ${item.name} (SKU: ${item.sku || 'N/A'})`);
          return true;
        });
        console.log(`[QR] Result: ${items.length} physical items from API (after filtering ${orderData.items.length - items.length} discounts)`);
        
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
    
    // Determine container count and type for this specific item
    let totalContainersForThisItem = quantity; // Default to quantity
    let containerType = 'container'; // Default type
    const name = itemName.toLowerCase();
    const sku = (item.sku || '').toLowerCase();
    
    // Smart container logic based on product type
    // Always create at least 1 label per physical item
    if (name.includes('drum') || sku.includes('drum')) {
      totalContainersForThisItem = quantity; // 1 label per drum
      containerType = 'drum';
    } else if (name.includes('tote') || sku.includes('tote')) {
      totalContainersForThisItem = quantity; // 1 label per tote
      containerType = 'tote';
    } else if (name.includes('pail') || sku.includes('pail')) {
      // For pails, assume 1 label per pail for now (can be grouped later)
      totalContainersForThisItem = quantity; 
      containerType = 'pail';
    } else if (name.includes('box') || sku.includes('box')) {
      // For boxes, assume 1 label per box for now
      totalContainersForThisItem = quantity;
      containerType = 'box';
    } else if (name.includes('gallon') || sku.includes('gallon')) {
      // For gallon containers
      totalContainersForThisItem = quantity;
      containerType = 'container';
    } else {
      // Default: 1 label per quantity
      totalContainersForThisItem = quantity;
      containerType = 'container';
    }
    
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
          totalContainers: totalContainersForThisItem, // Total containers for THIS specific item only
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
    console.log('[QR] No items found, creating 1 default container QR');
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
      qrCodesToCreate.push({
        workspaceId,
        code: `QR-${orderId}-SOURCE-${Date.now()}`,
        type: 'master' as const,
        label: `Source Container - Order ${orderId}`,
        scanned: false,
        metadata: { isSource: true },
        createdAt: new Date()
      });
    } else if (type === 'tote') {
      for (let i = 1; i <= (quantity || 1); i++) {
        qrCodesToCreate.push({
          workspaceId,
          code: `QR-${orderId}-TOTE-${i}-${Date.now()}`,
          type: 'container' as const,
          label: `Tote ${i} - Order ${orderId}`,
          scanned: false,
          metadata: { 
            containerNumber: i,
            containerType: 'tote'
          },
          createdAt: new Date()
        });
      }
    } else if (type === 'pallet') {
      for (let i = 1; i <= (quantity || 1); i++) {
        qrCodesToCreate.push({
          workspaceId,
          code: `QR-${orderId}-PALLET-${i}-${Date.now()}`,
          type: 'pallet' as const,
          label: `Pallet ${i} - Order ${orderId}`,
          scanned: false,
          metadata: { 
            palletNumber: i
          },
          createdAt: new Date()
        });
      }
    }

    // Insert the new QR codes
    await db.insert(qrCodes).values(qrCodesToCreate);

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