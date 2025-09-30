import { ShipStationClient, type ShipStationOrder } from './client';
import { WorkspaceService } from '../workspace/service';
import { db } from '@/lib/db';
import { workspaces } from '@/lib/db/schema/qr-workspace';
import { eq } from 'drizzle-orm';

// Tag IDs from environment
const TAG_MAPPING = {
  FREIGHT_BOOKED: Number(process.env.FREIGHT_BOOKED_TAG_ID || 60447), // Freight Booked
  FREIGHT_READY: Number(process.env.FREIGHT_READY_TAG_ID || 44123),   // Freight Order Ready
  FREIGHT_ORDERS: Number(process.env.FREIGHT_ORDERS_TAG_ID || 19844), // Freight Orders
  HOT_SHIPMENT: 48500,                                                 // HOT SHIPMENT - SHIP TODAY
  DELAY_SHIPMENT: 46283,                                              // Delay Shipment/Don't Ship
  DOCUMENTS_REQUIRED: 51273,                                          // Documents / Certificates Required
};

interface TagWorkflowMapping {
  workflowPhase?: string;
  moduleState?: Record<string, unknown>;
  priority?: string;
  hold?: boolean;
}

// Map tags to workflow phases and module states
const TAG_TO_WORKFLOW_MAPPING: Record<number, TagWorkflowMapping> = {
  [TAG_MAPPING.FREIGHT_BOOKED]: {
    workflowPhase: 'pre_mix',
    moduleState: { planning: { locked: true } }
  },
  [TAG_MAPPING.FREIGHT_READY]: {
    workflowPhase: 'pre_ship',
    moduleState: { pre_ship: { completed: true } }
  },
  [TAG_MAPPING.HOT_SHIPMENT]: {
    priority: 'high',
    moduleState: { shipping: { expedited: true } }
  },
  [TAG_MAPPING.DELAY_SHIPMENT]: {
    hold: true,
    moduleState: { shipping: { hold: true } }
  },
  [TAG_MAPPING.DOCUMENTS_REQUIRED]: {
    moduleState: { documents: { required: true, complete: false } }
  }
};

type WorkspaceUpdate = Partial<typeof workspaces.$inferInsert> & Record<string, unknown>;

interface ActivityLogEntry {
  type: string;
  description: string;
  metadata: Record<string, unknown>;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

export class ShipStationTagSyncService {
  private shipstation: ShipStationClient;
  private workspaceService: WorkspaceService;

  constructor() {
    this.shipstation = new ShipStationClient();
    this.workspaceService = new WorkspaceService();
  }

  /**
   * Sync tags from ShipStation to update workflow phase
   */
  async syncTagsToWorkflow(orderId: number): Promise<void> {
    try {
      // Get current tags from ShipStation
      const order = await this.shipstation.getOrder(orderId);
      const tagIds = this.extractTagIds(order);
      if (!tagIds.length) {
        console.log(`No tags found for order ${orderId}`);
        return;
      }

      console.log(`Order ${orderId} has tags:`, tagIds);

      // Find workspace
      const workspace = await this.workspaceService.repository.findByOrderId(orderId);
      if (!workspace) {
        console.error(`Workspace not found for order ${orderId}`);
        return;
      }

      // Process each tag
      let moduleStates: Record<string, unknown> = isRecord(workspace.moduleStates)
        ? { ...workspace.moduleStates }
        : {};
      const updates: WorkspaceUpdate = {
        moduleStates,
      };
      const activityLogs: ActivityLogEntry[] = [];

      for (const tagId of tagIds) {
        const mapping = TAG_TO_WORKFLOW_MAPPING[tagId];
        if (mapping) {
          // Update workflow phase if specified
          if (mapping.workflowPhase) {
            updates.workflowPhase = mapping.workflowPhase;
            activityLogs.push({
              type: 'workflow_phase_updated',
              description: `Workflow phase changed to ${mapping.workflowPhase} based on ShipStation tag`,
              metadata: { tagId, phase: mapping.workflowPhase }
            });
          }

          // Update module states
          if (mapping.moduleState) {
            moduleStates = {
              ...moduleStates,
              ...mapping.moduleState,
            };
            updates.moduleStates = moduleStates;
          }

          // Handle special flags
          if (mapping.priority) {
            updates.priority = mapping.priority;
          }
          if (mapping.hold !== undefined) {
            updates.onHold = mapping.hold;
          }
        }
      }

      // Apply updates if any changes detected
      if (Object.keys(updates).length > 0) {
        await this.workspaceService.repository.update(workspace.id, updates);
        
        // Log activities
        for (const log of activityLogs) {
          await this.workspaceService.repository.logActivity({
            workspaceId: workspace.id,
            activityType: log.type,
            performedBy: 'shipstation_sync',
            metadata: log.metadata
          });
        }

        console.log(`Updated workspace ${workspace.id} based on ShipStation tags`);
      }
    } catch (error) {
      console.error(`Failed to sync tags for order ${orderId}:`, error);
    }
  }

  /**
   * Handle webhook event for tag changes
   */
  async handleTagUpdate(webhookData: unknown): Promise<void> {
    if (!isRecord(webhookData)) {
      console.warn('Invalid ShipStation webhook payload', webhookData);
      return;
    }

    const rawOrderId = webhookData.order_id ?? webhookData.orderId;
    const orderId = typeof rawOrderId === 'number'
      ? rawOrderId
      : typeof rawOrderId === 'string'
        ? Number(rawOrderId)
        : undefined;
    if (!orderId || Number.isNaN(orderId)) {
      console.warn('Webhook missing order ID', webhookData);
      return;
    }

    const rawTags = webhookData.tag_ids ?? webhookData.tagIds;
    const tagIds = Array.isArray(rawTags)
      ? rawTags.map((tag) => Number(tag)).filter((tag): tag is number => Number.isFinite(tag))
      : [];

    console.log(`Processing tag update for order ${orderId}, tags:`, tagIds);
    
    await this.syncTagsToWorkflow(orderId);
  }

  /**
   * Batch sync all active workspaces
   */
  async syncAllActiveWorkspaces(): Promise<void> {
    try {
      const activeWorkspaces = await db
        .select()
        .from(workspaces)
        .where(eq(workspaces.status, 'active'));

      console.log(`Syncing ${activeWorkspaces.length} active workspaces...`);

      for (const workspace of activeWorkspaces) {
        await this.syncTagsToWorkflow(workspace.orderId);
        
        // Add small delay to avoid rate limiting
        await new Promise(resolve => setTimeout(resolve, 500));
      }

      console.log('Tag sync completed');
    } catch (error) {
      console.error('Failed to sync all workspaces:', error);
    }
  }

  /**
   * Get suggested workflow phase based on current tags
   */
  getSuggestedPhase(tagIds: number[]): string | null {
    // Priority order for phase determination
    if (tagIds.includes(TAG_MAPPING.FREIGHT_READY)) {
      return 'ready_to_ship';
    }
    if (tagIds.includes(TAG_MAPPING.FREIGHT_BOOKED)) {
      return 'pre_ship';
    }
    if (tagIds.includes(TAG_MAPPING.FREIGHT_ORDERS)) {
      return 'pre_mix';
    }
    return null;
  }

  /**
   * Validate tag consistency
   */
  async validateTagConsistency(orderId: number): Promise<{
    consistent: boolean;
    issues: string[];
  }> {
    const issues: string[] = [];
    
    try {
      const order = await this.shipstation.getOrder(orderId);
      const tagIds = this.extractTagIds(order);
      const workspace = await this.workspaceService.repository.findByOrderId(orderId);
      
      if (!order || !workspace) {
        return { consistent: false, issues: ['Order or workspace not found'] };
      }

      // Check for conflicting tags
      if (tagIds.includes(TAG_MAPPING.FREIGHT_BOOKED) &&
          tagIds.includes(TAG_MAPPING.FREIGHT_READY)) {
        issues.push('Order has both BOOKED and READY tags');
      }

      // Check if tags match workflow phase
      if (workspace.workflowPhase === 'pre_mix' && 
          tagIds.includes(TAG_MAPPING.FREIGHT_READY)) {
        issues.push('Order marked as READY but still in pre_mix phase');
      }

      if (workspace.workflowPhase === 'ready_to_ship' && 
          !tagIds.includes(TAG_MAPPING.FREIGHT_READY)) {
        issues.push('Order in ready_to_ship phase but missing READY tag');
      }

      return {
        consistent: issues.length === 0,
        issues
      };
    } catch (error) {
      return {
        consistent: false,
        issues: [`Validation error: ${error}`]
      };
    }
  }

  private extractTagIds(order: ShipStationOrder): number[] {
    const { tagIds } = order;
    if (!Array.isArray(tagIds)) return [];
    return tagIds
      .map((tag) => Number(tag))
      .filter((tag): tag is number => Number.isFinite(tag));
  }
}

// Export singleton instance
export const tagSyncService = new ShipStationTagSyncService();
