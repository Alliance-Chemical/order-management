import { NextRequest, NextResponse } from 'next/server';
import { WorkspaceRepository } from '@/lib/services/workspace/repository';
import { ShipStationClient } from '@/lib/services/shipstation/client';
// AWS SNS removed - log notifications instead
import { clearFreightBooked } from '@/lib/services/shipstation/tags';

const repository = new WorkspaceRepository();
const shipstationClient = new ShipStationClient();

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ orderId: string }> }
) {
  try {
    const { orderId } = await params;
    const body = await request.json();
    const { trailerNumber, sealNumbers } = body;

    const workspace = await repository.findByOrderId(parseInt(orderId));
    
    if (!workspace) {
      return NextResponse.json({ error: 'Workspace not found' }, { status: 404 });
    }

    // Update workspace status
    await repository.updateWorkspace(workspace.id, {
      status: 'ready_to_ship',
      workflowPhase: 'shipping',
      shipstationData: {
        ...workspace.shipstationData,
        trailerNumber,
        sealNumbers,
        markedReadyAt: new Date().toISOString(),
      },
    });

    // Add ready-to-ship tag in ShipStation
    const readyToShipTagId = parseInt(process.env.READY_TO_SHIP_TAG || '19845');
    try {
      await shipstationClient.addOrderTag((workspace as any).shipstationOrderId || workspace.orderId, readyToShipTagId);
      
      // Clear Freight Booked tag when shipped
      await clearFreightBooked(workspace.orderId);
      
      // Log tag removal
      await repository.logActivity({
        workspaceId: workspace.id,
        activityType: 'shipstation_tag_removed',
        performedBy: 'system',
        metadata: {
          tag: 'FreightBooked',
          orderId: workspace.orderId,
          trigger: 'order_shipped'
        }
      });
    } catch (error) {
      console.error('Failed to update ShipStation tags:', error);
      // Continue even if ShipStation update fails
    }

    // Log activity
    await repository.logActivity({
      workspaceId: workspace.id,
      activityType: 'marked_ready_to_ship',
      activityDescription: `Order marked as ready to ship.`,
      performedBy: 'system', // Replace with actual user
      module: 'shipping',
      metadata: { trailerNumber, sealNumbers },
    });

    // Send notification
    const alertConfig = await repository.getAlertConfig(workspace.id, 'ready_to_ship');
    if (alertConfig?.enabled) {
      try {
        const message = `Order ${workspace.orderNumber} is ready to ship.${trailerNumber ? `\n\nTrailer: ${trailerNumber}` : ''}${sealNumbers?.length ? `\nSeals: ${sealNumbers.join(', ')}` : ''}`;
        
        console.log('Ship notification:', {
          subject: `Ready to Ship - Order ${workspace.orderNumber}`,
          message,
          orderId: orderId.toString(),
          orderNumber: workspace.orderNumber
        });

        await repository.updateAlertConfig(alertConfig.id, {
          lastTriggeredAt: new Date(),
          triggerCount: (alertConfig.triggerCount || 0) + 1,
        });
      } catch (error) {
        console.error('Failed to send notification:', error);
        // Continue even if notification fails
      }
    }

    return NextResponse.json({
      success: true,
      message: 'Order marked as ready to ship',
      workspace: {
        id: workspace.id,
        orderId: workspace.orderId,
        orderNumber: workspace.orderNumber,
        status: 'ready_to_ship',
        trailerNumber,
        sealNumbers,
      },
    });
  } catch (error) {
    console.error('Error marking order ready to ship:', error);
    return NextResponse.json({ error: 'Failed to update shipping status' }, { status: 500 });
  }
}
