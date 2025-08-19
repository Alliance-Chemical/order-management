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
  private activeOverrides: Map<string, OverrideResponse> = new Map();
  private readonly overrideStorageKey = 'supervisor_overrides';
  private readonly auditStorageKey = 'override_audit_log';

  constructor() {
    this.loadOverrides();
  }

  /**
   * Request supervisor override
   */
  async requestOverride(request: OverrideRequest): Promise<OverrideResponse> {
    const overrideId = this.generateOverrideId();
    
    // Check if user has supervisor privileges
    const hasSupervisorAccess = await this.checkSupervisorAccess(request.requestedBy);
    
    if (!hasSupervisorAccess) {
      // Send notification to supervisor for approval
      await this.notifySupervisor(request, overrideId);
      
      return {
        approved: false,
        overrideId,
        conditions: ['Awaiting supervisor approval']
      };
    }

    // Auto-approve for supervisors
    const override: OverrideResponse = {
      approved: true,
      overrideId,
      approvedBy: request.requestedBy,
      approvedAt: new Date().toISOString(),
      expiresAt: this.calculateExpiry(request.type)
    };

    // Store override
    this.activeOverrides.set(overrideId, override);
    this.saveOverrides();

    // Log to audit trail
    await this.logOverride(request, override);

    return override;
  }

  /**
   * Approve pending override
   */
  async approveOverride(
    overrideId: string, 
    approvedBy: string,
    conditions?: string[]
  ): Promise<OverrideResponse> {
    const override = this.activeOverrides.get(overrideId);
    
    if (!override) {
      throw new Error('Override request not found');
    }

    if (override.approved) {
      return override;
    }

    // Update override
    override.approved = true;
    override.approvedBy = approvedBy;
    override.approvedAt = new Date().toISOString();
    override.expiresAt = this.calculateExpiry('manual_pass');
    override.conditions = conditions;

    this.activeOverrides.set(overrideId, override);
    this.saveOverrides();

    // Log approval
    await this.logApproval(overrideId, approvedBy, conditions);

    return override;
  }

  /**
   * Check if override is valid
   */
  isOverrideValid(overrideId: string): boolean {
    const override = this.activeOverrides.get(overrideId);
    
    if (!override || !override.approved) {
      return false;
    }

    // Check expiry
    if (override.expiresAt) {
      const expiryDate = new Date(override.expiresAt);
      if (expiryDate < new Date()) {
        // Override expired - remove it
        this.activeOverrides.delete(overrideId);
        this.saveOverrides();
        return false;
      }
    }

    return true;
  }

  /**
   * Use override (consumes it if single-use)
   */
  useOverride(overrideId: string, usedBy: string): boolean {
    if (!this.isOverrideValid(overrideId)) {
      return false;
    }

    const override = this.activeOverrides.get(overrideId);
    if (!override) return false;

    // Log usage
    this.logUsage(overrideId, usedBy);

    // Remove single-use overrides
    if (!this.isReusableOverride(override)) {
      this.activeOverrides.delete(overrideId);
      this.saveOverrides();
    }

    return true;
  }

  /**
   * Check supervisor access
   */
  private async checkSupervisorAccess(userId: string): Promise<boolean> {
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

    // Default to checking localStorage for demo/dev
    const userRole = localStorage.getItem('user-role');
    return userRole === 'supervisor' || userRole === 'admin';
  }

  /**
   * Notify supervisor of override request
   */
  private async notifySupervisor(request: OverrideRequest, overrideId: string): Promise<void> {
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

  /**
   * Log override to audit trail
   */
  private async logOverride(request: OverrideRequest, response: OverrideResponse): Promise<void> {
    const auditEntry = {
      timestamp: new Date().toISOString(),
      action: 'override_created',
      overrideId: response.overrideId,
      request,
      response,
      ip: await this.getClientIP()
    };

    // Save to local audit log
    this.appendToAuditLog(auditEntry);

    // Send to server
    try {
      await fetch(`/api/workspace/${request.orderId}/activity`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          activityType: 'supervisor_override',
          performedBy: request.requestedBy,
          metadata: auditEntry
        })
      });
    } catch (error) {
      console.error('Failed to log override to server:', error);
    }
  }

  /**
   * Log override approval
   */
  private async logApproval(
    overrideId: string, 
    approvedBy: string, 
    conditions?: string[]
  ): Promise<void> {
    const auditEntry = {
      timestamp: new Date().toISOString(),
      action: 'override_approved',
      overrideId,
      approvedBy,
      conditions,
      ip: await this.getClientIP()
    };

    this.appendToAuditLog(auditEntry);
  }

  /**
   * Log override usage
   */
  private async logUsage(overrideId: string, usedBy: string): Promise<void> {
    const auditEntry = {
      timestamp: new Date().toISOString(),
      action: 'override_used',
      overrideId,
      usedBy,
      ip: await this.getClientIP()
    };

    this.appendToAuditLog(auditEntry);
  }

  /**
   * Calculate override expiry
   */
  private calculateExpiry(type: OverrideRequest['type']): string {
    const now = new Date();
    
    switch (type) {
      case 'skip_step':
        // Valid for 1 hour
        now.setHours(now.getHours() + 1);
        break;
      case 'approve_failure':
        // Valid for 30 minutes
        now.setMinutes(now.getMinutes() + 30);
        break;
      case 'manual_pass':
        // Valid for 2 hours
        now.setHours(now.getHours() + 2);
        break;
      case 'unlock_inspection':
        // Valid for 4 hours
        now.setHours(now.getHours() + 4);
        break;
    }

    return now.toISOString();
  }

  /**
   * Check if override is reusable
   */
  private isReusableOverride(override: OverrideResponse): boolean {
    // Unlock inspections can be used multiple times
    return override.conditions?.includes('reusable') || false;
  }

  /**
   * Generate unique override ID
   */
  private generateOverrideId(): string {
    return `OVR_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Get client IP (for audit trail)
   */
  private async getClientIP(): Promise<string> {
    try {
      const response = await fetch('https://api.ipify.org?format=json');
      const data = await response.json();
      return data.ip;
    } catch {
      return 'unknown';
    }
  }

  /**
   * Append to audit log
   */
  private appendToAuditLog(entry: any): void {
    try {
      const log = JSON.parse(localStorage.getItem(this.auditStorageKey) || '[]');
      log.push(entry);
      
      // Keep last 1000 entries
      if (log.length > 1000) {
        log.shift();
      }
      
      localStorage.setItem(this.auditStorageKey, JSON.stringify(log));
    } catch (error) {
      console.error('Failed to append to audit log:', error);
    }
  }

  /**
   * Load overrides from storage
   */
  private loadOverrides(): void {
    try {
      const stored = localStorage.getItem(this.overrideStorageKey);
      if (stored) {
        const overrides = JSON.parse(stored);
        this.activeOverrides = new Map(Object.entries(overrides));
        
        // Clean expired overrides
        this.cleanExpiredOverrides();
      }
    } catch (error) {
      console.error('Failed to load overrides:', error);
    }
  }

  /**
   * Save overrides to storage
   */
  private saveOverrides(): void {
    try {
      const overrides = Object.fromEntries(this.activeOverrides);
      localStorage.setItem(this.overrideStorageKey, JSON.stringify(overrides));
    } catch (error) {
      console.error('Failed to save overrides:', error);
    }
  }

  /**
   * Clean expired overrides
   */
  private cleanExpiredOverrides(): void {
    const now = new Date();
    const toDelete: string[] = [];

    this.activeOverrides.forEach((override, id) => {
      if (override.expiresAt) {
        const expiryDate = new Date(override.expiresAt);
        if (expiryDate < now) {
          toDelete.push(id);
        }
      }
    });

    toDelete.forEach(id => this.activeOverrides.delete(id));
    
    if (toDelete.length > 0) {
      this.saveOverrides();
    }
  }

  /**
   * Get audit log
   */
  getAuditLog(orderId?: string): any[] {
    try {
      const log = JSON.parse(localStorage.getItem(this.auditStorageKey) || '[]');
      
      if (orderId) {
        return log.filter((entry: any) => 
          entry.request?.orderId === orderId
        );
      }
      
      return log;
    } catch {
      return [];
    }
  }
}

// Export singleton instance
export const supervisorOverride = new SupervisorOverrideService();