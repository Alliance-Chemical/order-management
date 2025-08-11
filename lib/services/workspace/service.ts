import { WorkspaceRepository } from './repository';
import { ShipStationClient } from '../shipstation/client';
import { QRGenerator } from '../qr/generator';
import { getS3BucketName, createOrderFolderPath } from '@/lib/aws/s3-client';
import { sendMessage } from '@/lib/aws/sqs-client';
import { v4 as uuidv4 } from 'uuid';

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
    } catch (error) {
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

  private async fetchShipStationData(orderId: number, orderNumber: string) {
    try {
      const order = await this.shipstation.getOrder(orderId);
      return order;
    } catch {
      // Fallback to order number search
      return await this.shipstation.getOrderByNumber(orderNumber);
    }
  }

  private async queueQRGeneration(workspaceId: string, orderId: number, orderNumber: string, shipstationData: any) {
    const queueUrl = process.env.QR_GENERATION_QUEUE_URL!;
    
    const message = {
      action: 'generate_qr',
      workspaceId,
      orderId,
      orderNumber,
      items: shipstationData?.items || [],
      timestamp: new Date().toISOString(),
    };

    await sendMessage(queueUrl, message, `order-${orderId}`);
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

  async updateModuleState(orderIdStr: string, module: string, state: any, userId: string) {
    const orderId = parseInt(orderIdStr);
    const workspace = await this.repository.findByOrderId(orderId);
    if (!workspace) throw new Error('Workspace not found');

    const currentStates = workspace.moduleStates || {};
    currentStates[module] = state;

    await this.repository.update(workspace.id, {
      moduleStates: currentStates,
      updatedBy: userId,
    });

    await this.logActivity(workspace.id, `module_${module}_updated`, userId, { state });

    // Check for status triggers
    await this.checkStatusTriggers(workspace.id, module, state);
  }

  private async checkStatusTriggers(workspaceId: string, module: string, state: any) {
    // Check if we need to send alerts based on module state changes
    if (module === 'pre_mix' && state.completed) {
      await this.queueAlert(workspaceId, 'ready_to_pump');
    } else if (module === 'pre_ship' && state.completed) {
      await this.queueAlert(workspaceId, 'ready_to_ship');
    }
  }

  private async queueAlert(workspaceId: string, alertType: string) {
    const queueUrl = process.env.ALERT_QUEUE_URL!;
    
    const message = {
      action: 'send_alert',
      workspaceId,
      alertType,
      timestamp: new Date().toISOString(),
    };

    await sendMessage(queueUrl, message);
  }

  private async logActivity(workspaceId: string, type: string, userId: string, metadata?: any) {
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