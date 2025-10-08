import { getEdgeDb, withEdgeRetry } from '@/lib/db/neon-edge';
import { KVCache } from '@/lib/cache/kv-cache';
import { workspaces } from '@/lib/db/schema/qr-workspace';
import { freightOrders, freightEvents } from '@/lib/db/schema/freight';
import { eq } from 'drizzle-orm';

type JsonMap = Record<string, unknown>;
type JsonArray = JsonMap[];

interface FreightBookingData {
  orderId: number;
  orderNumber: string;
  carrierName?: string;
  serviceType?: string;
  estimatedCost?: number;
  originAddress?: any;
  destinationAddress?: any;
  packageDetails?: any;
  specialInstructions?: string;
  aiSuggestions?: JsonArray;
  confidenceScore?: number;
  sessionId?: string;
  telemetryData?: JsonMap;
}

interface WorkspaceData {
  orderId: number;
  orderNumber: string;
  status?: string;
  workspaceUrl: string;
  shipstationData?: JsonMap;
  activeModules?: {
    preMix: boolean;
    warehouse: boolean;
    documents: boolean;
    freight?: boolean;
  };
}

export class WorkspaceFreightLinkingService {
  private db = getEdgeDb();

  /**
   * Create a freight order linked to an existing workspace
   */
  async linkFreightToWorkspace(workspaceId: string, freightData: FreightBookingData) {
    const cacheKey = `workspace-freight:${workspaceId}`;
    
    try {
      const result = await withEdgeRetry(async () => {
        // Create freight order linked to workspace
        const freightOrderInsert: typeof freightOrders.$inferInsert = {
          orderId: freightData.orderId,
          orderNumber: freightData.orderNumber,
          carrierName: freightData.carrierName,
          serviceType: freightData.serviceType,
          estimatedCost: freightData.estimatedCost?.toString(),
          originAddress: freightData.originAddress ?? null,
          destinationAddress: freightData.destinationAddress ?? null,
          packageDetails: freightData.packageDetails ?? null,
          bookingStatus: 'pending',
          aiSuggestions: freightData.aiSuggestions ?? [],
          confidenceScore: freightData.confidenceScore?.toString(),
          decisionSource: 'ai',
          sessionId:
            freightData.sessionId && freightData.sessionId.length === 36
              ? freightData.sessionId
              : null,
          telemetryData: freightData.telemetryData ?? {},
          specialInstructions: freightData.specialInstructions,
        };

        const [freightOrder] = await this.db
          .insert(freightOrders)
          .values(freightOrderInsert)
          .returning();

        // Create initial freight event
        await this.db
          .insert(freightEvents)
          .values({
            freightOrderId: freightOrder.id,
            eventType: 'freight_booked',
            eventDescription: `Freight booking created for order ${freightData.orderNumber}`,
            eventData: {
              carrier: freightData.carrierName,
              service: freightData.serviceType,
              cost: freightData.estimatedCost,
            },
            performedBy: 'system',
            performedAt: new Date(),
          });

        return freightOrder;
      });

      // Clear cache to ensure fresh data
      await KVCache.delete(cacheKey);
      await KVCache.delete(`freight-order:${freightData.orderId}`);

      return result;
    } catch (error) {
      console.error('Error linking freight to workspace:', error);
      throw error;
    }
  }

  /**
   * Create both workspace and freight order in a single transaction
   */
  async createWorkspaceWithFreight(workspaceData: WorkspaceData, freightData: FreightBookingData) {
    try {
      const result = await withEdgeRetry(async () => {
        // Create workspace first
        const [workspace] = await this.db
          .insert(workspaces)
          .values({
            orderId: workspaceData.orderId,
            orderNumber: workspaceData.orderNumber,
            status: workspaceData.status || 'active',
            workspaceUrl: workspaceData.workspaceUrl,
            shipstationData: workspaceData.shipstationData || {},
            shipstationTags: ['Freight'],
            activeModules: workspaceData.activeModules || {
              preMix: true,
              warehouse: true,
              documents: true,
              freight: true, // Add freight module
            },
            workflowPhase: 'pending',
            createdAt: new Date(),
            updatedAt: new Date(),
          })
          .returning();

        // Link freight order to the new workspace
        const freightOrder = await this.linkFreightToWorkspace(workspace.id, freightData);

        return { workspace, freightOrder };
      });

      return result;
    } catch (error) {
      console.error('Error creating workspace with freight:', error);
      throw error;
    }
  }

  /**
   * Get unified workspace + freight data
   */
  async getWorkspaceWithFreight(workspaceId: string) {
    const cacheKey = `workspace-freight:${workspaceId}`;
    
    // Check cache first
    const cached = await KVCache.get(cacheKey);
    if (cached) {
      return cached;
    }

    try {
      const result = await withEdgeRetry(async () => {
        const workspace = await this.db.query.workspaces.findFirst({
          where: eq(workspaces.id, workspaceId),
        });

        if (!workspace) {
          return null;
        }

        // Note: workspaceId was removed from freight_orders schema
        // This query would need to be updated to use orderId instead
        const orders = await this.db.query.freightOrders.findMany({
          where: eq(freightOrders.orderId, workspace.orderId),
          with: {
            quotes: true,
            events: true,
          },
        });

        return {
          ...workspace,
          freightOrders: orders,
        };
      });

      // Cache for 5 minutes
      if (result) {
        await KVCache.set(cacheKey, result, 300);
      }

      return result;
    } catch (error) {
      console.error('Error getting workspace with freight:', error);
      throw error;
    }
  }

  /**
   * Update freight booking status and sync with workspace
   */
  async updateFreightStatus(freightOrderId: string, status: string, eventData?: JsonMap) {
    try {
      const result = await withEdgeRetry(async () => {
        // Update freight order status
        const [freightOrder] = await this.db
          .update(freightOrders)
          .set({
            bookingStatus: status,
            updatedAt: new Date(),
            ...(status === 'booked' && { bookedAt: new Date() }),
            ...(status === 'shipped' && { shippedAt: new Date() }),
            ...(status === 'delivered' && { deliveredAt: new Date() }),
          })
          .where(eq(freightOrders.id, freightOrderId))
          .returning();

        // Create freight event
        if (freightOrder) {
          await this.db
            .insert(freightEvents)
            .values({
              freightOrderId,
              eventType: `freight_${status}`,
              eventDescription: `Freight order status changed to ${status}`,
              eventData: eventData || {},
              performedBy: 'system',
              performedAt: new Date(),
            });

          // Update workspace workflow phase if freight is delivered
          if (status === 'delivered' && freightOrder.workspaceId) {
            await this.db
              .update(workspaces)
              .set({
                workflowPhase: 'pre_mix', // Move to pre-mix phase when freight arrives
                updatedAt: new Date(),
              })
              .where(eq(workspaces.id, freightOrder.workspaceId));

            // Clear workspace cache
            await KVCache.delete(`workspace-freight:${freightOrder.workspaceId}`);
          }
        }

        return freightOrder;
      });

      // Clear related caches
      await KVCache.delete(`freight-order:${freightOrderId}`);

      return result;
    } catch (error) {
      console.error('Error updating freight status:', error);
      throw error;
    }
  }

  /**
   * Get freight order by order ID
   */
  async getFreightOrderByOrderId(orderId: number) {
    const cacheKey = `freight-order:${orderId}`;
    
    // Check cache first
    const cached = await KVCache.get(cacheKey);
    if (cached) {
      return cached;
    }

    try {
      const result = await withEdgeRetry(async () => {
        const [freightOrder] = await this.db
          .select()
          .from(freightOrders)
          .where(eq(freightOrders.orderId, orderId))
          .limit(1);
        
        if (!freightOrder) return null;
        
        // Get associated workspace
        const [workspace] = await this.db
          .select()
          .from(workspaces)
          .where(eq(workspaces.id, freightOrder.workspaceId!))
          .limit(1);
          
        return {
          ...freightOrder,
          workspace: workspace || null,
        };
      });

      // Cache for 10 minutes
      if (result) {
        await KVCache.set(cacheKey, result, 600);
      }

      return result;
    } catch (error) {
      console.error('Error getting freight order by order ID:', error);
      throw error;
    }
  }

  /**
   * Check if an order has freight booking
   */
  async hasFreightBooking(orderId: number): Promise<boolean> {
    try {
      const freightOrder = await this.getFreightOrderByOrderId(orderId);
      return !!freightOrder;
    } catch (error) {
      console.error('Error checking freight booking:', error);
      return false;
    }
  }

  /**
   * Generate workspace URL from order number
   */
  generateWorkspaceUrl(orderNumber: string): string {
    return orderNumber.toLowerCase().replace(/[^a-z0-9]/g, '-');
  }
}

// Singleton instance
export const workspaceFreightLinker = new WorkspaceFreightLinkingService();
