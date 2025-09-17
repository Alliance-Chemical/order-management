import { NextRequest, NextResponse } from 'next/server';
import { withErrorHandler } from '@/lib/error-handler';
import { tagSyncService } from '@/lib/services/shipstation/ensure-phase';
import { WorkspaceRepository } from '@/lib/services/workspace/repository';

const repository = new WorkspaceRepository();

/**
 * Webhook handler for ShipStation tag changes
 * This syncs tag changes from ShipStation back to our database
 */
export const POST = withErrorHandler(async (request: NextRequest) => {
  const body = await request.json();
  
  // Validate webhook secret if configured
  const _secret = request.headers.get('x-shipstation-hmac-sha256');
  if (process.env.SHIPSTATION_WEBHOOK_SECRET) {
    // TODO: Validate HMAC signature
  }
  
  const { resource_type, resource_url: _resourceUrl, action } = body;
  
  // We only care about order updates
  if (resource_type !== 'ORDER_NOTIFY') {
    return NextResponse.json({ received: true });
  }
  
  // Extract orderId from resource_url or body
  const orderId = body.resource?.orderId || body.orderId;
  if (!orderId) {
    console.warn('No orderId in webhook payload');
    return NextResponse.json({ received: true });
  }
  
  try {
    // Sync the current state from ShipStation
    const phase = await tagSyncService.syncFromShipStation(orderId);
    
    // Find workspace
    const workspace = await repository.findByOrderId(orderId);
    if (workspace) {
      // Log the sync activity
      await repository.logActivity({
        workspaceId: workspace.id,
        activityType: 'shipstation_webhook_sync',
        performedBy: 'system',
        metadata: {
          action,
          phase,
          orderId
        }
      });
    }
    
    return NextResponse.json({ 
      received: true,
      phase,
      orderId
    });
  } catch (error) {
    console.error('Failed to sync from ShipStation webhook:', error);
    return NextResponse.json({ 
      received: true,
      error: 'Sync failed but webhook acknowledged' 
    });
  }
});
