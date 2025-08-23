import { ShipStationClient } from './client';
import { WorkspaceService } from '../workspace/service';
import { db } from '@/lib/db';
import { workspaces } from '@/lib/db/schema/qr-workspace';
import { eq } from 'drizzle-orm';

// Tag IDs from environment
const TAG_MAPPING = {
  FREIGHT_STAGED: Number(process.env.FREIGHT_STAGED_TAG_ID || 44777), // Need Labels
  FREIGHT_READY: Number(process.env.FREIGHT_READY_TAG_ID || 44123),   // Freight Order Ready
  FREIGHT_ORDERS: Number(process.env.FREIGHT_ORDERS_TAG_ID || 19844),  // Freight Orders
  HOT_SHIPMENT: 48500,                                                 // HOT SHIPMENT - SHIP TODAY
  DELAY_SHIPMENT: 46283,                                              // Delay Shipment/Don't Ship
  DOCUMENTS_REQUIRED: 51273,                                          // Documents / Certificates Required
};

// Map tags to workflow phases and module states
const TAG_TO_WORKFLOW_MAPPING = {
  [TAG_MAPPING.FREIGHT_STAGED]: {
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
      if (!order || !order.tagIds) {
        console.log(`No tags found for order ${orderId}`);
        return;
      }

      const tagIds = order.tagIds as number[];
      console.log(`Order ${orderId} has tags:`, tagIds);

      // Find workspace
      const workspace = await this.workspaceService.repository.findByOrderId(orderId);
      if (!workspace) {
        console.error(`Workspace not found for order ${orderId}`);
        return;
      }

      // Process each tag
      let updates: any = {
        moduleStates: workspace.moduleStates || {}
      };
      let activityLogs: any[] = [];

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
            updates.moduleStates = {
              ...updates.moduleStates,
              ...mapping.moduleState
            };
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
  async handleTagUpdate(webhookData: any): Promise<void> {
    const orderId = webhookData.order_id || webhookData.orderId;
    const tagIds = webhookData.tag_ids || webhookData.tagIds || [];
    
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
    if (tagIds.includes(TAG_MAPPING.FREIGHT_STAGED)) {
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
      const workspace = await this.workspaceService.repository.findByOrderId(orderId);
      
      if (!order || !workspace) {
        return { consistent: false, issues: ['Order or workspace not found'] };
      }

      const tagIds = order.tagIds || [];
      
      // Check for conflicting tags
      if (tagIds.includes(TAG_MAPPING.FREIGHT_STAGED) && 
          tagIds.includes(TAG_MAPPING.FREIGHT_READY)) {
        issues.push('Order has both STAGED and READY tags');
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
}

// Export singleton instance
export const tagSyncService = new ShipStationTagSyncService();