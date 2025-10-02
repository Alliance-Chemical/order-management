import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { workspaces, qrCodes } from '@/lib/db/schema/qr-workspace';
import { eq } from 'drizzle-orm';
import { filterOutDiscounts } from '@/lib/services/orders/normalize';

interface WorkspaceItem extends Record<string, unknown> {
  orderItemId?: string;
  sku?: string | null;
  name?: string | null;
  quantity?: number;
}

interface WorkspaceShipStationData {
  items?: WorkspaceItem[];
}

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ orderId: string }> }
) {
  try {
    const params = await context.params;
    const { labelQuantities } = (await request.json()) as {
      labelQuantities: Record<string, number>;
    };
    const orderId = Number(params.orderId);
    
    if (Number.isNaN(orderId)) {
      return NextResponse.json(
        { success: false, error: 'Invalid orderId' },
        { status: 400 }
      );
    }

    console.log(`[QR] Regenerating labels with custom quantities for order ${orderId}:`, labelQuantities);

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

    const workspaceRecord = workspace[0];
    const workspaceId = workspaceRecord.id;
    const orderNumber = workspaceRecord.orderNumber;
    const shipstationData = (workspaceRecord.shipstationData ?? {}) as WorkspaceShipStationData;

    // Delete existing QR codes for items that have custom quantities
    const skusToRegenerate = Object.keys(labelQuantities);
    if (skusToRegenerate.length > 0) {
      // Delete existing QRs for these SKUs
      await db
        .delete(qrCodes)
        .where(eq(qrCodes.workspaceId, workspaceId));
    }

    // Generate new QR codes based on custom quantities
    const records: Array<typeof qrCodes.$inferInsert> = [];
    const now = Date.now();
    const makeCode = (suffix: string) => `QR-${orderId}-${suffix}-${now}-${Math.floor(Math.random() * 1000)}`;
    const makeShort = () => Math.random().toString(36).slice(2, 8).toUpperCase();
    const baseUrl = (process.env.NEXT_PUBLIC_APP_URL || 'https://order-management-kappa-seven.vercel.app').trim();

    let globalContainerIndex = 0;

    // Process items from shipstationData
    if (shipstationData?.items && Array.isArray(shipstationData.items)) {
      const items = filterOutDiscounts(shipstationData.items);

      for (const item of items) {
        const itemId = item.orderItemId || item.sku || `item-${items.indexOf(item)}`;
        const itemName = item.name || 'Unknown Product';
        const quantity = item.quantity || 1;
        const sku = item.sku ?? undefined;
        
        // Determine how many labels to create for this item
        const labelsToCreate = sku ? labelQuantities[sku] ?? 1 : 1;
        
        console.log(`[QR] Creating ${labelsToCreate} custom labels for: "${itemName}" (SKU: ${sku}, Qty: ${quantity})`);
        
        // Generate the specified number of labels
        for (let labelIndex = 1; labelIndex <= labelsToCreate; labelIndex++) {
          globalContainerIndex++;
          
          records.push({
            workspaceId,
            qrType: 'container',
            qrCode: makeCode(`CONTAINER-${globalContainerIndex}`),
            shortCode: makeShort(),
            orderId,
            orderNumber,
            containerNumber: globalContainerIndex,
            chemicalName: itemName,
            encodedData: { 
              type: 'container', 
              orderId, 
              orderNumber, 
              containerType: labelsToCreate > 1 ? 'freight-split' : 'freight',
              containerNumber: labelIndex,
              totalContainers: labelsToCreate,
              originalQuantity: quantity,
              itemId: itemId,
              sku: item.sku,
              itemName: itemName,
              splitInfo: labelsToCreate > 1 ? `Pallet ${labelIndex} of ${labelsToCreate}` : null
            },
            qrUrl: `${baseUrl}/workspace/${orderId}`,
            scanCount: 0,
            isActive: true,
            createdAt: new Date(),
          });
        }
      }
    }

    // Insert new QR codes
    if (records.length > 0) {
      console.log(`[QR] Inserting ${records.length} regenerated QR codes`);
      await db.insert(qrCodes).values(records);
    }

    // Fetch all QR codes for response
    const allQrCodes = await db
      .select()
      .from(qrCodes)
      .where(eq(qrCodes.workspaceId, workspaceId))
      .orderBy(qrCodes.containerNumber, qrCodes.chemicalName);

    return NextResponse.json({
      success: true,
      qrCodes: allQrCodes,
      message: `Regenerated ${records.length} labels with custom quantities`
    });

  } catch (error) {
    console.error('Error regenerating QR codes:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to regenerate QR codes' },
      { status: 500 }
    );
  }
}
