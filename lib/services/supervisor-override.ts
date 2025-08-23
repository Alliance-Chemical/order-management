/**
 * Supervisor Override System
 * Provides controlled override capabilities with full audit trail
 */

export interface OverrideRequest {
  type: 'skip_step' | 'approve_failure' | 'manual_pass' | 'unlock_inspection';
  orderId: string;
  workflowPhase: string;
  stepId?: string;
  reason: string;
  requestedBy: string;
  metadata?: Record<string, any>;
}

export interface OverrideResponse {
  approved: boolean;
  overrideId: string;
  approvedBy?: string;
  approvedAt?: string;
  expiresAt?: string;
  conditions?: string[];
}

class SupervisorOverrideService {
  /**
   * Request supervisor override
   */
  async requestOverride(request: OverrideRequest, workspaceId: string): Promise<OverrideResponse> {
    try {
      const response = await fetch('/api/overrides/request', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...request,
          workspaceId
        })
      });

      if (!response.ok) {
        throw new Error('Failed to request override');
      }

      const data = await response.json();
      return {
        approved: data.approved,
        overrideId: data.id,
        expiresAt: new Date(data.expiresAt).toISOString(),
        conditions: data.approved ? [] : ['Awaiting supervisor approval']
      };
    } catch (error) {
      console.error('Failed to request override:', error);
      throw error;
    }
  }

  /**
   * Approve pending override
   */
  async approveOverride(
    overrideId: string, 
    approvedBy: string,
    workspaceId: string,
    conditions?: string[]
  ): Promise<OverrideResponse> {
    try {
      const response = await fetch('/api/overrides/approve', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          overrideId,
          approvedBy,
          workspaceId,
          conditions
        })
      });

      if (!response.ok) {
        throw new Error('Failed to approve override');
      }

      const data = await response.json();
      return {
        approved: true,
        overrideId,
        approvedBy,
        approvedAt: new Date().toISOString(),
        conditions
      };
    } catch (error) {
      console.error('Failed to approve override:', error);
      throw error;
    }
  }

  /**
   * Check if override is valid
   */
  async isOverrideValid(overrideId: string, workspaceId: string): Promise<boolean> {
    try {
      const response = await fetch('/api/overrides/check', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ overrideId, workspaceId })
      });

      if (!response.ok) {
        return false;
      }

      const data = await response.json();
      return data.valid;
    } catch (error) {
      console.error('Failed to check override validity:', error);
      return false;
    }
  }

  /**
   * Use override (consumes it if single-use)
   */
  async useOverride(overrideId: string, usedBy: string, workspaceId: string): Promise<boolean> {
    try {
      const response = await fetch('/api/overrides/use', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          overrideId,
          usedBy,
          workspaceId
        })
      });

      if (!response.ok) {
        return false;
      }

      const data = await response.json();
      return data.ok;
    } catch (error) {
      console.error('Failed to use override:', error);
      return false;
    }
  }

  /**
   * Get audit log for overrides
   */
  async getAuditLog(workspaceId: string): Promise<any[]> {
    try {
      const response = await fetch(`/api/workspace/${workspaceId}/activity?type=override`);
      
      if (!response.ok) {
        return [];
      }

      const data = await response.json();
      return data.activities || [];
    } catch (error) {
      console.error('Failed to get audit log:', error);
      return [];
    }
  }

  /**
   * Check supervisor access
   */
  async checkSupervisorAccess(userId: string): Promise<boolean> {
    try {
      const response = await fetch('/api/auth/check-role', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, requiredRole: 'supervisor' })
      });

      if (response.ok) {
        const data = await response.json();
        return data.hasAccess;
      }
    } catch (error) {
      console.error('Failed to check supervisor access:', error);
    }

    return false;
  }

  /**
   * Notify supervisor of override request
   */
  async notifySupervisor(request: OverrideRequest, overrideId: string): Promise<void> {
    try {
      await fetch(`/api/workspace/${request.orderId}/alert`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'override_requested',
          severity: 'medium',
          title: `Override Requested: ${request.type}`,
          description: `${request.requestedBy} requested ${request.type} override. Reason: ${request.reason}`,
          metadata: {
            overrideId,
            request
          }
        })
      });
    } catch (error) {
      console.error('Failed to notify supervisor:', error);
    }
  }
}

// Export singleton instance
export const supervisorOverride = new SupervisorOverrideService();