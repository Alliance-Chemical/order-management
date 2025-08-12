import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { workspaces, qrCodes } from '@/lib/db/schema/qr-workspace';
import { eq, sql } from 'drizzle-orm';

export async function GET(
  request: NextRequest,
  { params }: { params: { orderId: string } }
) {
  try {
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
      // If no workspace exists, create one first (populate required fields)
      console.warn(`[QR] Workspace not found for orderId=${orderId}. Creating on-demand...`);
      const newWorkspace = await db
        .insert(workspaces)
        .values({
          orderId,
          orderNumber: String(orderId),
          workspaceUrl: `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/workspace/${orderId}`,
          status: 'pending',
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
      console.log('[QR] --- TRIGGERING ON-DEMAND QR GENERATION (new workspace) ---');
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

    // Fetch all QR codes for this workspace - master first, then source, then containers
    const qrCodeRecords = await db
      .select()
      .from(qrCodes)
      .where(eq(qrCodes.workspaceId, workspaceId))
      .orderBy(
        sql`CASE 
          WHEN ${qrCodes.qrType} = 'order_master' AND (${qrCodes.encodedData}->>'isSource')::boolean IS NOT TRUE THEN 1
          WHEN ${qrCodes.qrType} = 'source' THEN 2
          WHEN ${qrCodes.qrType} = 'order_master' AND (${qrCodes.encodedData}->>'isSource')::boolean = TRUE THEN 2
          ELSE 3
        END`,
        qrCodes.containerNumber
      );
    console.log(`[QR] Found ${qrCodeRecords.length} existing QR codes.`);

    // If no QR codes exist, generate them
    if (qrCodeRecords.length === 0) {
      console.log('[QR] --- TRIGGERING ON-DEMAND QR GENERATION (no existing codes) ---');
      await generateQRCodesForWorkspace(workspaceId, orderId);
      
      // Fetch again after generation - with proper ordering
      const newQrCodes = await db
        .select()
        .from(qrCodes)
        .where(eq(qrCodes.workspaceId, workspaceId))
        .orderBy(
          sql`CASE 
            WHEN ${qrCodes.qrType} = 'order_master' AND (${qrCodes.encodedData}->>'isSource')::boolean IS NOT TRUE THEN 1
            WHEN ${qrCodes.qrType} = 'source' THEN 2
            WHEN ${qrCodes.qrType} = 'order_master' AND (${qrCodes.encodedData}->>'isSource')::boolean = TRUE THEN 2
            ELSE 3
          END`,
          qrCodes.containerNumber
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
  
  // Check if master QR already exists
  const hasMasterQR = existingQRCodes.some(qr => qr.qrType === 'order_master' && !qr.encodedData?.isSource);
  const hasSourceQR = existingQRCodes.some(qr => qr.qrType === 'order_master' && qr.encodedData?.isSource);
  
  // Attempt to read workspace to enrich records
  const ws = await db
    .select()
    .from(workspaces)
    .where(eq(workspaces.id, workspaceId))
    .limit(1);
  const orderNumber = ws[0]?.orderNumber || String(orderId);
  const shipstationData = ws[0]?.shipstationData as any;

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
    // Filter out discount items
    items = shipstationData.items.filter((item: any) => {
      const hasNoSku = !item.sku || item.sku === '';
      const isDiscount = item.name?.toLowerCase().includes('discount') || 
                       item.unitPrice < 0 || 
                       item.lineItemKey?.includes('discount');
      if (hasNoSku && isDiscount) {
        console.log(`[QR] Filtering out discount item: ${item.name}`);
        return false;
      }
      return true;
    });
    console.log(`[QR] Using ${items.length} physical items from workspace shipstationData (after filtering discounts)`);
  } else {
    // If no items in workspace, fetch from ShipStation
    try {
      const apiKey = process.env.SHIPSTATION_API_KEY?.trim() || '';
      const apiSecret = process.env.SHIPSTATION_API_SECRET?.trim() || '';
      const auth = Buffer.from(`${apiKey}:${apiSecret}`).toString('base64');
      
      const response = await fetch(`https://ssapi.shipstation.com/orders/${orderId}`, {
        headers: {
          'Authorization': `Basic ${auth}`,
          'Content-Type': 'application/json',
        },
      });
      
      if (response.ok) {
        const orderData = await response.json();
        // Filter out discount items
        items = (orderData.items || []).filter((item: any) => {
          const hasNoSku = !item.sku || item.sku === '';
          const isDiscount = item.name?.toLowerCase().includes('discount') || 
                           item.unitPrice < 0 || 
                           item.lineItemKey?.includes('discount');
          if (hasNoSku && isDiscount) {
            console.log(`[QR] Filtering out discount item: ${item.name}`);
            return false;
          }
          return true;
        });
        console.log(`[QR] Fetched ${items.length} physical items from ShipStation API (after filtering discounts)`);
        
        // Update workspace with the fetched data
        await db
          .update(workspaces)
          .set({ 
            shipstationData: orderData,
            lastShipstationSync: new Date()
          })
          .where(eq(workspaces.id, workspaceId));
      }
    } catch (error) {
      console.error('Error fetching order details for QR generation:', error);
    }
  }

  // Only create master label if it doesn't exist - ALWAYS FIRST
  if (!hasMasterQR) {
    console.log('[QR] Creating new master QR code');
    records.push({
      workspaceId,
      qrType: 'order_master',
      qrCode: makeCode('MASTER'),
      shortCode: makeShort(),
      orderId,
      orderNumber,
      containerNumber: null,
      chemicalName: null,
      encodedData: { type: 'master', orderId, orderNumber },
      qrUrl: `${baseUrl}/workspace/${orderId}`,
      scanCount: 0,
      isActive: true,
      createdAt: new Date(),
    });
  }

  // NOTE: Source QRs are now created on-demand when supervisors assign sources
  // This ensures each source container has a unique QR with the correct chemical name

  // Process each item to generate container QRs - AFTER MASTER
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
    if (name.includes('drum') || sku.includes('drum')) {
      totalContainersForThisItem = quantity; // 1 label per drum
      containerType = 'drum';
    } else if (name.includes('tote') || sku.includes('tote')) {
      totalContainersForThisItem = quantity; // 1 label per tote
      containerType = 'tote';
    } else if (name.includes('pail') || sku.includes('pail')) {
      // For pails, we create labels per pallet (36 pails per pallet)
      totalContainersForThisItem = Math.ceil(quantity / 36); 
      containerType = 'pallet';
    } else if (name.includes('box') || sku.includes('box')) {
      // For boxes, we create labels per pallet (144 boxes per pallet)
      totalContainersForThisItem = Math.ceil(quantity / 144);
      containerType = 'pallet';
    }
    
    console.log(`[QR] Creating ${totalContainersForThisItem} ${containerType} QRs for item: ${itemName} (qty: ${quantity})`);
    
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
          itemName: itemName
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
        totalContainers: 1
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
  { params }: { params: { orderId: string } }
) {
  try {
    const { type, quantity } = await request.json();
    const orderId = params.orderId;

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