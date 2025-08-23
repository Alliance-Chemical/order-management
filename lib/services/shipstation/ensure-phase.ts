import { ShipStationClient } from './client';
import { WorkspaceRepository } from '../workspace/repository';
import { derivePhase, calculateTagDelta, Phase } from './tag-map';

export class TagSyncService {
  private client: ShipStationClient;
  private repository: WorkspaceRepository;

  constructor() {
    this.client = new ShipStationClient();
    this.repository = new WorkspaceRepository();
  }

  /**
   * Ensure an order reaches the target phase by managing ShipStation tags
   * This is the main entry point for all phase transitions
   */
  async ensurePhase(
    orderId: number | bigint, 
    targetPhase: Phase,
    userId: string = 'system'
  ): Promise<{
    success: boolean;
    finalTags: number[];
    finalPhase: Phase;
    error?: string;
  }> {
    try {
      const oid = Number(orderId);
      
      // Get current order state from ShipStation
      const order = await this.client.getOrder(oid);
      if (!order) {
        return {
          success: false,
          finalTags: [],
          finalPhase: 'planning',
          error: 'Order not found in ShipStation'
        };
      }

      // Extract current tag IDs
      const currentTagIds = (order.tagIds || []) as number[];
      const currentPhase = derivePhase(currentTagIds, order.orderStatus);

      // Check if already at or past target phase
      if (this.isPhaseAchieved(currentPhase, targetPhase)) {
        return {
          success: true,
          finalTags: currentTagIds,
          finalPhase: currentPhase
        };
      }

      // Calculate what tags to add/remove
      const { add, remove } = calculateTagDelta(currentTagIds, targetPhase);

      // Apply tag changes to ShipStation
      if (add.length > 0) {
        for (const tagId of add) {
          await this.client.addOrderTag(oid, tagId);
          await this.logTagActivity(orderId, 'tag_added', tagId, targetPhase, userId);
        }
      }

      if (remove.length > 0) {
        for (const tagId of remove) {
          await this.client.removeOrderTag(oid, tagId);
          await this.logTagActivity(orderId, 'tag_removed', tagId, targetPhase, userId);
        }
      }

      // Refetch to confirm final state
      const updatedOrder = await this.client.getOrder(oid);
      const finalTagIds = (updatedOrder.tagIds || []) as number[];
      const finalPhase = derivePhase(finalTagIds, updatedOrder.orderStatus);

      // Update our database mirror
      await this.updateWorkspaceMirror(orderId, finalTagIds, finalPhase);

      return {
        success: true,
        finalTags: finalTagIds,
        finalPhase
      };

    } catch (error) {
      console.error('Failed to ensure phase:', error);
      return {
        success: false,
        finalTags: [],
        finalPhase: 'planning',
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Sync current ShipStation state to our database (for webhooks)
   */
  async syncFromShipStation(orderId: number | bigint): Promise<Phase> {
    const oid = Number(orderId);
    
    try {
      const order = await this.client.getOrder(oid);
      if (!order) {
        console.warn(`Order ${oid} not found in ShipStation`);
        return 'planning';
      }

      const tagIds = (order.tagIds || []) as number[];
      const phase = derivePhase(tagIds, order.orderStatus);

      await this.updateWorkspaceMirror(orderId, tagIds, phase);
      
      return phase;
    } catch (error) {
      console.error('Failed to sync from ShipStation:', error);
      return 'planning';
    }
  }

  private isPhaseAchieved(current: Phase, target: Phase): boolean {
    const phaseOrder: Phase[] = ['planning', 'pre_mix', 'pre_ship', 'ready_to_ship', 'shipped'];
    return phaseOrder.indexOf(current) >= phaseOrder.indexOf(target);
  }

  private async updateWorkspaceMirror(
    orderId: number | bigint, 
    tagIds: number[], 
    phase: Phase
  ) {
    const workspace = await this.repository.findByOrderId(orderId);
    if (!workspace) return;

    await this.repository.update(workspace.id, {
      shipstationTags: tagIds,
      workflowPhase: phase,
      lastShipstationSync: new Date()
    });
  }

  private async logTagActivity(
    orderId: number | bigint,
    action: 'tag_added' | 'tag_removed',
    tagId: number,
    targetPhase: Phase,
    userId: string
  ) {
    const workspace = await this.repository.findByOrderId(orderId);
    if (!workspace) return;

    await this.repository.logActivity({
      workspaceId: workspace.id,
      activityType: `shipstation_${action}`,
      performedBy: userId,
      metadata: {
        tagId,
        targetPhase,
        orderId: Number(orderId)
      }
    });
  }
}

// Export singleton for convenience
export const tagSyncService = new TagSyncService();