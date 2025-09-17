import { WorkspaceRepository } from './repository';
import { ShipStationClient, type ShipStationOrder } from '../shipstation/client';
import { QRGenerator } from '../qr/generator';
import { getS3BucketName, createOrderFolderPath } from '@/lib/aws/s3-client';
import { markFreightStaged, markFreightReady } from '../shipstation/tags';

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
    // Check if workspace exists
    try {
      const existing = await this.repository.findByOrderId(orderId);
      if (existing) {
        console.log(`Workspace already exists for order ${orderNumber}`);
        return existing;
      }
    } catch {
      console.log(`No existing workspace for order ${orderNumber}, creating new one`);
    }

    // Fetch ShipStation data
    const shipstationOrder = await this.fetchShipStationData(orderId, orderNumber);
    
    // Create workspace
    const workspaceUrl = `/workspace/${orderId}`;
    const s3BucketName = getS3BucketName();
    const s3FolderPath = createOrderFolderPath(orderNumber);
    
    const workspace = await this.repository.create({
      orderId,
      orderNumber,
      workspaceUrl,
      s3BucketName,
      s3FolderPath,
      workflowType, // Add workflow type
      shipstationOrderId: shipstationOrder?.orderId,
      shipstationData: shipstationOrder,
      lastShipstationSync: new Date(),
      createdBy: userId,
    });

    // Queue QR generation
    await this.queueQRGeneration(workspace.id, orderId, orderNumber, shipstationOrder);

    // Log activity
    await this.logActivity(workspace.id, 'workspace_created', userId, {
      orderId,
      orderNumber,
    });

    return workspace;
  }

  private async fetchShipStationData(orderId: number, orderNumber: string): Promise<ShipStationOrder | null> {
    try {
      const order = await this.shipstation.getOrder(orderId);
      return order;
    } catch {
      // Fallback to order number search
      return await this.shipstation.getOrderByNumber(orderNumber);
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
        await markFreightStaged(orderId);
        await this.logActivity(workspaceId, 'shipstation_tag_added', 'system', {
          tag: 'FreightStaged',
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
