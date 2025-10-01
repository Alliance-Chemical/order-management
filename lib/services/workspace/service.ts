import { WorkspaceRepository } from './repository';
import { ShipStationClient, type ShipStationOrder } from '../shipstation/client';
import { QRGenerator } from '../qr/generator';
import { getS3BucketName, createOrderFolderPath } from '@/lib/aws/s3-client';
import { workspaces } from '@/lib/db/schema/qr-workspace';
import { markFreightBooked, markFreightReady } from '../shipstation/tags';

type ModuleState = Record<string, unknown>;
type ActivityMetadata = Record<string, unknown>;

export class WorkspaceService {
  public repository: WorkspaceRepository;
  private shipstation: ShipStationClient;
  private qrGenerator: QRGenerator;

  constructor() {
    this.repository = new WorkspaceRepository();
    this.shipstation = new ShipStationClient();
    this.qrGenerator = new QRGenerator();
  }

  async createWorkspace(orderId: number, orderNumber: string, userId: string, workflowType: 'pump_and_fill' | 'direct_resell' = 'pump_and_fill') {
    // Try to fetch ShipStation data with timeout (non-blocking)
    const shipstationOrder = await this.fetchShipStationData(orderId, orderNumber);

    if (!shipstationOrder) {
      console.log(`[WorkspaceService] Creating workspace ${orderId} without ShipStation data (API unavailable or timeout)`);
    }

    // Create workspace with whatever data we have
    const workspaceUrl = `/workspace/${orderId}`;
    const s3BucketName = getS3BucketName();
    const s3FolderPath = createOrderFolderPath(orderNumber);

    const creationResult = await this.repository.createOrGet({
      orderId,
      orderNumber,
      workspaceUrl,
      s3BucketName,
      s3FolderPath,
      workflowType,
      shipstationOrderId: shipstationOrder?.orderId,
      shipstationData: shipstationOrder || undefined, // Convert null to undefined
      lastShipstationSync: shipstationOrder ? new Date() : undefined, // Only set if we got data
      syncStatus: shipstationOrder ? 'synced' : 'pending', // Mark as pending sync if no data
      createdBy: userId,
    });

    let workspace = creationResult.workspace;

    if (creationResult.created) {
      // Queue QR generation only for brand-new workspaces
      await this.queueQRGeneration(workspace.id, orderId, orderNumber, shipstationOrder);

      // Log activity for new workspace
      await this.logActivity(workspace.id, 'workspace_created', userId, {
        orderId,
        orderNumber,
        hasShipStationData: Boolean(shipstationOrder),
      });

      // Queue background ShipStation sync if we don't have data yet
      if (!shipstationOrder) {
        await this.queueShipStationSync(workspace.id, orderId, orderNumber);
      }
    } else {
      // Refresh key ShipStation fields so mirrored data stays current
      const updatePayload: Partial<typeof workspaces.$inferInsert> = {
        lastShipstationSync: shipstationOrder ? new Date() : workspace.lastShipstationSync,
        updatedBy: userId,
      };

      if (shipstationOrder) {
        updatePayload.shipstationData = shipstationOrder;
        updatePayload.shipstationOrderId = shipstationOrder.orderId;
        updatePayload.syncStatus = 'synced';
      }

      workspace = await this.repository.update(workspace.id, updatePayload);
      console.log(`Workspace already existed for order ${orderNumber}; refreshed metadata instead of creating.`);
    }

    return workspace;
  }

  /**
   * Fetch ShipStation data with timeout
   * Always returns null on any error to avoid blocking workspace creation
   */
  private async fetchShipStationData(orderId: number, orderNumber: string): Promise<ShipStationOrder | null> {
    try {
      // Try by orderId first (3s timeout)
      let order = await this.shipstation.getOrder(orderId, 3000);
      if (order) {
        return order;
      }

      // Fallback to order number search (3s timeout)
      order = await this.shipstation.getOrderByNumber(orderNumber, 3000);
      return order;
    } catch (error) {
      // Log but don't throw - gracefully degrade
      console.error(`[WorkspaceService] Failed to fetch ShipStation data for order ${orderId}:`, error);
      return null;
    }
  }

  /**
   * Queue background sync for ShipStation data
   */
  private async queueShipStationSync(workspaceId: string, orderId: number, orderNumber: string) {
    try {
      const { kvQueue } = await import('@/lib/queue/kv-queue');
      await kvQueue.enqueue(
        'jobs',
        'shipstation_sync',
        {
          action: 'sync_shipstation',
          workspaceId,
          orderId,
          orderNumber,
        },
        {
          fingerprint: `shipstation_sync_${orderId}`,
          maxRetries: 5, // More retries for sync
        }
      );
      console.log(`[WorkspaceService] Queued background ShipStation sync for order ${orderId}`);
    } catch (error) {
      console.error(`[WorkspaceService] Failed to queue ShipStation sync:`, error);
      // Don't throw - this is a background job
    }
  }

  private async queueQRGeneration(
    workspaceId: string,
    orderId: number,
    orderNumber: string,
    shipstationData: ShipStationOrder | null
  ) {
    // Queue QR generation using improved KV queue with deduplication
    const { kvQueue } = await import('@/lib/queue/kv-queue');
    await kvQueue.enqueue(
      'jobs',
      'qr_generation',
      {
        action: 'generate_qr',
        workspaceId,
        orderId,
        orderNumber,
        items: shipstationData?.items || [],
      },
      {
        fingerprint: `qr_gen_${orderId}`, // Prevent duplicate QR generation for same order
        maxRetries: 3,
      }
    );
  }

  async syncWithShipStation(workspaceId: string, orderId: number) {
    const order = await this.shipstation.getOrder(orderId);
    
    await this.repository.update(workspaceId, {
      shipstationData: order,
      lastShipstationSync: new Date(),
      syncStatus: 'synced',
    });

    return order;
  }

  async updateModuleState(orderIdStr: string, module: string, state: ModuleState, userId: string) {
    const orderId = parseInt(orderIdStr);
    const workspace = await this.repository.findByOrderId(orderId);
    if (!workspace) throw new Error('Workspace not found');

    const currentStates = (workspace.moduleStates as Record<string, unknown> | undefined) || {};
    const updatedStates = {
      ...currentStates,
      [module]: state,
    };

    await this.repository.update(workspace.id, {
      moduleStates: updatedStates,
      updatedBy: userId,
    });

    await this.logActivity(workspace.id, `module_${module}_updated`, userId, { state });

    // Check for status triggers
    await this.checkStatusTriggers(workspace.id, workspace.orderId, module, state);
  }

  private async checkStatusTriggers(workspaceId: string, orderId: number, module: string, state: ModuleState) {
    // We already have both workspaceId (UUID) and orderId (number)
    
    const completed = typeof state === 'object' && state !== null && 'completed' in state
      ? Boolean((state as { completed?: boolean }).completed)
      : false;

    // Check if we need to send alerts based on module state changes
    if (module === 'pre_mix' && completed) {
      await this.queueAlert(workspaceId, 'ready_to_pump');
    } else if (module === 'pre_ship' && completed) {
      await this.queueAlert(workspaceId, 'ready_to_ship');
      // Mark freight as ready when pre-ship inspection passes
      try {
        await markFreightReady(orderId);
        await this.logActivity(workspaceId, 'shipstation_tag_added', 'system', {
          tag: 'FreightOrderReady',
          orderId,
          trigger: 'pre_ship_inspection_passed'
        });
      } catch (error) {
        console.error('Failed to mark freight ready:', error);
      }
    }
    
    // Check for planning locked state
    const locked = typeof state === 'object' && state !== null && 'locked' in state
      ? (state as { locked?: boolean }).locked === true
      : false;

    if (module === 'planning' && locked) {
      try {
        await markFreightBooked(orderId);
        await this.logActivity(workspaceId, 'shipstation_tag_added', 'system', {
          tag: 'FreightBooked',
          orderId,
          trigger: 'planning_locked'
        });
      } catch (error) {
        console.error('Failed to mark freight staged:', error);
      }
    }
  }

  private async queueAlert(workspaceId: string, alertType: string) {
    // Queue alert using improved KV queue
    const { kvQueue } = await import('@/lib/queue/kv-queue');
    await kvQueue.enqueue(
      'alerts',
      'alert',
      {
        workspaceId,
        alertType,
      },
      {
        fingerprint: `alert_${workspaceId}_${alertType}_${Date.now() / 60000 | 0}`, // Dedupe within same minute
        maxRetries: 2,
      }
    );
    
    await this.repository.logActivity({
      workspaceId,
      activityType: 'alert_triggered',
      performedBy: 'system',
      metadata: { alertType }
    });
  }

  private async logActivity(workspaceId: string, type: string, userId: string, metadata?: ActivityMetadata) {
    await this.repository.logActivity({
      workspaceId,
      activityType: type,
      performedBy: userId,
      metadata,
    });
  }
}

// Export a singleton instance for compatibility
export const workspaceService = new WorkspaceService();
