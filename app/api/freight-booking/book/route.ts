import { NextRequest, NextResponse } from 'next/server';
import { MyCarrierOrderInterceptor } from '@/lib/freight-booking/mycarrier/order-interceptor';
import { workspaceFreightLinker } from '@/lib/services/workspace-freight-linking';
import { getEdgeDb } from '@/lib/db/neon-edge';
import { freightOrders } from '@/lib/db/schema/freight';
import { workspaces } from '@/lib/db/schema/qr-workspace';
import { tagSyncService } from '@/lib/services/shipstation/ensure-phase';
import { eq } from 'drizzle-orm';

export const runtime = 'edge';
export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { shipstationOrder, carrierSelection, userOverrides, estimatedCost } = body || {};

    if (!shipstationOrder?.orderId || !shipstationOrder?.orderNumber || !carrierSelection?.carrier) {
      return NextResponse.json({ success: false, error: 'Missing shipstationOrder (orderId, orderNumber) or carrierSelection.carrier' }, { status: 400 });
    }

    // Persist hazmat override if requested
    if (userOverrides?.hazmat?.persist === true && shipstationOrder?.items?.length) {
      try {
        const sku = shipstationOrder.items[0]?.sku; // simple: persist for primary SKU; can be extended per-item
        if (sku) {
          const { isHazmat, unNumber, hazardClass, packingGroup, properShippingName } = userOverrides.hazmat;
          const sql = getEdgeDb();
          // Resolve product id by sku
          const prod = await sql.query.products.findFirst({ where: (p, { eq }) => eq(p.sku, sku) });
          if (prod) {
            await sql.execute(
              // @ts-ignore drizzle neon-http execute raw
              sql.sql`
                INSERT INTO product_hazmat_overrides (
                  id, product_id, is_hazmat, un_number, hazard_class, packing_group, proper_shipping_name,
                  is_approved, approved_by, approved_at, created_at, created_by, updated_at, updated_by
                ) VALUES (
                  gen_random_uuid(),
                  ${prod.id}, ${isHazmat ?? null}, ${unNumber ?? null}, ${hazardClass ?? null}, ${packingGroup ?? null}, ${properShippingName ?? null},
                  true, 'api/freight-booking/book', NOW(), NOW(), 'api/freight-booking/book', NOW(), 'api/freight-booking/book'
                )
                ON CONFLICT (product_id) DO UPDATE SET
                  is_hazmat = EXCLUDED.is_hazmat,
                  un_number = EXCLUDED.un_number,
                  hazard_class = EXCLUDED.hazard_class,
                  packing_group = EXCLUDED.packing_group,
                  proper_shipping_name = EXCLUDED.proper_shipping_name,
                  is_approved = EXCLUDED.is_approved,
                  approved_by = EXCLUDED.approved_by,
                  approved_at = EXCLUDED.approved_at,
                  updated_at = NOW(),
                  updated_by = 'api/freight-booking/book'
              `
            );
          }
        }
      } catch (e) {
        console.warn('Failed to persist hazmat override (continuing):', e);
      }
    }

    // Persist per-line hazmat overrides (by SKU)
    if (userOverrides?.hazmatBySku && shipstationOrder?.items?.length) {
      try {
        const bySku: Record<string, any> = userOverrides.hazmatBySku || {};
        const sql = getEdgeDb();
        const seen = new Set<string>();
        for (const it of shipstationOrder.items as any[]) {
          const sku = (it?.sku || '').trim();
          if (!sku || seen.has(sku)) continue;
          seen.add(sku);
          const o = bySku[sku];
          if (!o || o.persist !== true) continue;
          const { isHazmat, unNumber, hazardClass, packingGroup, properShippingName } = o;
          const prod = await sql.query.products.findFirst({ where: (p, { eq }) => eq(p.sku, sku) });
          if (!prod) continue;
          await sql.execute(
            // @ts-ignore drizzle neon-http execute raw
            sql.sql`
              INSERT INTO product_hazmat_overrides (
                id, product_id, is_hazmat, un_number, hazard_class, packing_group, proper_shipping_name,
                is_approved, approved_by, approved_at, created_at, created_by, updated_at, updated_by
              ) VALUES (
                gen_random_uuid(),
                ${prod.id}, ${isHazmat ?? null}, ${unNumber ?? null}, ${hazardClass ?? null}, ${packingGroup ?? null}, ${properShippingName ?? null},
                true, 'api/freight-booking/book', NOW(), NOW(), 'api/freight-booking/book', NOW(), 'api/freight-booking/book'
              )
              ON CONFLICT (product_id) DO UPDATE SET
                is_hazmat = EXCLUDED.is_hazmat,
                un_number = EXCLUDED.un_number,
                hazard_class = EXCLUDED.hazard_class,
                packing_group = EXCLUDED.packing_group,
                proper_shipping_name = EXCLUDED.proper_shipping_name,
                is_approved = EXCLUDED.is_approved,
                approved_by = EXCLUDED.approved_by,
                approved_at = EXCLUDED.approved_at,
                updated_at = NOW(),
                updated_by = 'api/freight-booking/book'
            `
          );
        }
      } catch (e) {
        console.warn('Failed to persist hazmatBySku overrides (continuing):', e);
      }
    }

    // Build MyCarrier order using saved per-SKU classification (freight class / NMFC)
    const mcOrder = await MyCarrierOrderInterceptor.buildOrderFromFreightSelectionWithSavedClass(
      shipstationOrder,
      carrierSelection,
      userOverrides || {},
    );

    const useProduction = process.env.MYCARRIER_ENV === 'production';
    const myCarrier = new MyCarrierOrderInterceptor(useProduction);

    // Place order with capture
    const result = await myCarrier.createOrderWithCapture(mcOrder, `ui-booking-${Date.now()}`);

    if (!result?.isSuccess) {
      return NextResponse.json({ success: false, error: 'Booking failed', details: result?.errorMessages || null }, { status: 502 });
    }

    const mcOrderId = result.orderId || result.confirmationNumber || null;
    const tracking = result.trackingNumber || result.proNumber || null;
    const actualCost = result.totalCost || null;

    // Check if workspace already exists for this order
    const db = getEdgeDb();
    const existingWorkspace = await db.query.workspaces.findFirst({
      where: (workspaces, { eq }) => eq(workspaces.orderId, shipstationOrder.orderId)
    });

    let workspace, freightOrder;
    
    if (existingWorkspace) {
      // Use existing workspace and link freight order to it
      console.log(`Using existing workspace ${existingWorkspace.id} for order ${shipstationOrder.orderNumber}`);
      
      // Ensure freight module is enabled in existing workspace
      const currentModules = existingWorkspace.activeModules || {};
      if (!currentModules.freight) {
        await db.update(workspaces)
          .set({
            activeModules: { ...currentModules, freight: true },
            updatedAt: new Date()
          })
          .where(eq(workspaces.id, existingWorkspace.id));
      }
      
      workspace = existingWorkspace;
      freightOrder = await workspaceFreightLinker.linkFreightToWorkspace(
        workspace.id,
        {
          orderId: shipstationOrder.orderId,
          orderNumber: shipstationOrder.orderNumber,
          carrierName: carrierSelection.carrier,
          serviceType: carrierSelection.service || 'Standard',
          estimatedCost: estimatedCost || null,
          originAddress: {
            address: shipstationOrder.billTo?.street1,
            city: shipstationOrder.billTo?.city,
            state: shipstationOrder.billTo?.state,
            zipCode: shipstationOrder.billTo?.postalCode,
          },
          destinationAddress: {
            address: shipstationOrder.shipTo?.street1,
            city: shipstationOrder.shipTo?.city,
            state: shipstationOrder.shipTo?.state,
            zipCode: shipstationOrder.shipTo?.postalCode,
          },
          packageDetails: {
            weight: {
              value: shipstationOrder.items?.reduce((sum: number, it: any) => sum + (it.weight?.value || 0) * (it.quantity || 1), 0) || 0,
              units: 'lbs',
            },
            dimensions: { length: 48, width: 40, height: 48, units: 'in' },
            packageCount: shipstationOrder.items?.length || 1,
            description: shipstationOrder.items?.map((i: any) => i.name).join(', '),
          },
          specialInstructions: userOverrides?.instructions || '',
          aiSuggestions: [],
          confidenceScore: 1.0,
          sessionId: null,
          telemetryData: {},
        }
      );
    } else {
      // Create new workspace + freight order
      console.log(`Creating new workspace for order ${shipstationOrder.orderNumber}`);
      const workspaceUrl = workspaceFreightLinker.generateWorkspaceUrl(shipstationOrder.orderNumber);
      const result = await workspaceFreightLinker.createWorkspaceWithFreight(
        {
          orderId: shipstationOrder.orderId,
          orderNumber: shipstationOrder.orderNumber,
          workspaceUrl,
          status: 'active',
          shipstationData: { ...shipstationOrder },
        },
        {
          orderId: shipstationOrder.orderId,
          orderNumber: shipstationOrder.orderNumber,
          carrierName: carrierSelection.carrier,
          serviceType: carrierSelection.service || 'Standard',
          estimatedCost: estimatedCost || null,
          originAddress: {
            address: shipstationOrder.billTo?.street1,
            city: shipstationOrder.billTo?.city,
            state: shipstationOrder.billTo?.state,
            zipCode: shipstationOrder.billTo?.postalCode,
          },
          destinationAddress: {
            address: shipstationOrder.shipTo?.street1,
            city: shipstationOrder.shipTo?.city,
            state: shipstationOrder.shipTo?.state,
            zipCode: shipstationOrder.shipTo?.postalCode,
          },
          packageDetails: {
            weight: {
              value: shipstationOrder.items?.reduce((sum: number, it: any) => sum + (it.weight?.value || 0) * (it.quantity || 1), 0) || 0,
              units: 'lbs',
            },
            dimensions: { length: 48, width: 40, height: 48, units: 'in' },
            packageCount: shipstationOrder.items?.length || 1,
            description: shipstationOrder.items?.map((i: any) => i.name).join(', '),
          },
          specialInstructions: userOverrides?.instructions || '',
          aiSuggestions: [],
          confidenceScore: 1.0,
          sessionId: null,
          telemetryData: {},
        }
      );
      workspace = result.workspace;
      freightOrder = result.freightOrder;
    }

    // Update freight order row with MyCarrier details
    await db.update(freightOrders)
      .set({
        myCarrierOrderId: mcOrderId || undefined,
        trackingNumber: tracking || undefined,
        bookingStatus: 'booked',
        actualCost: actualCost?.toString() || undefined,
        bookedAt: new Date(),
        updatedAt: new Date(),
        updatedBy: 'api/freight-booking/book',
      })
      .where(eq(freightOrders.id, freightOrder.id));

    // Update ShipStation tags to mark freight as booked/staged
    try {
      const tagSyncResult = await tagSyncService.ensurePhase(
        shipstationOrder.orderId,
        'pre_mix', // This adds FREIGHT_STAGED tag (60447 - "Freight Staged")
        'api/freight-booking/book'
      );
      
      console.log(`Freight booking tagged: ${JSON.stringify(tagSyncResult.finalTags)}`);
    } catch (error) {
      console.error('Failed to update ShipStation tags after freight booking:', error);
      // Don't fail the entire booking if tagging fails
    }

    return NextResponse.json({
      success: true,
      message: 'Freight booked and workspace created',
      workspace: {
        id: workspace.id,
        orderId: workspace.orderId,
        orderNumber: workspace.orderNumber,
        workspaceUrl: workspace.workspaceUrl,
        status: workspace.status,
      },
      freightOrder: {
        id: freightOrder.id,
        bookingStatus: 'booked',
        carrierName: carrierSelection.carrier,
        serviceType: carrierSelection.service || 'Standard',
        myCarrierOrderId: mcOrderId,
        trackingNumber: tracking,
      },
      myCarrier: {
        orderId: mcOrderId,
        trackingNumber: tracking,
        raw: result,
      },
      workspaceLink: `/workspace/${workspace.orderId}`,
    });
  } catch (error) {
    console.error('freight-booking/book error:', error);
    return NextResponse.json({ success: false, error: 'Failed to book freight' }, { status: 500 });
  }
}

export async function GET() {
  return NextResponse.json({ success: true, message: 'POST shipstationOrder + carrierSelection to book freight with saved classifications' });
}
