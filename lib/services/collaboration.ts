import { db } from '@/lib/db';
import { workspaces } from '@/lib/db/schema/qr-workspace';
import { eq } from 'drizzle-orm';

export interface ActiveUser {
  id: string;
  name: string;
  role: 'agent' | 'supervisor';
  activity: string;
  timestamp: number;
}

export class CollaborationService {
  private static instance: CollaborationService;
  private activeUsers: Map<string, Map<string, ActiveUser>> = new Map();
  
  static getInstance(): CollaborationService {
    if (!CollaborationService.instance) {
      CollaborationService.instance = new CollaborationService();
    }
    return CollaborationService.instance;
  }
  
  async addUserToWorkspace(
    workspaceId: string,
    userId: string,
    userName: string,
    userRole: 'agent' | 'supervisor',
    activity: string
  ): Promise<void> {
    // Get or create workspace map
    if (!this.activeUsers.has(workspaceId)) {
      this.activeUsers.set(workspaceId, new Map());
    }
    
    const workspaceUsers = this.activeUsers.get(workspaceId)!;
    
    // Add or update user
    workspaceUsers.set(userId, {
      id: userId,
      name: userName,
      role: userRole,
      activity,
      timestamp: Date.now(),
    });
    
    // Update database
    await this.updateDatabaseUsers(workspaceId);
  }
  
  async removeUserFromWorkspace(
    workspaceId: string,
    userId: string
  ): Promise<void> {
    const workspaceUsers = this.activeUsers.get(workspaceId);
    if (workspaceUsers) {
      workspaceUsers.delete(userId);
      
      if (workspaceUsers.size === 0) {
        this.activeUsers.delete(workspaceId);
      }
      
      await this.updateDatabaseUsers(workspaceId);
    }
  }
  
  async updateUserActivity(
    workspaceId: string,
    userId: string,
    activity: string
  ): Promise<void> {
    const workspaceUsers = this.activeUsers.get(workspaceId);
    if (workspaceUsers) {
      const user = workspaceUsers.get(userId);
      if (user) {
        user.activity = activity;
        user.timestamp = Date.now();
        await this.updateDatabaseUsers(workspaceId);
      }
    }
  }
  
  getWorkspaceUsers(workspaceId: string): ActiveUser[] {
    const workspaceUsers = this.activeUsers.get(workspaceId);
    if (!workspaceUsers) return [];
    
    // Remove inactive users (>5 minutes)
    const now = Date.now();
    const activeUsers: ActiveUser[] = [];
    
    for (const [userId, user] of workspaceUsers) {
      if (now - user.timestamp < 5 * 60 * 1000) {
        activeUsers.push(user);
      } else {
        workspaceUsers.delete(userId);
      }
    }
    
    return activeUsers;
  }
  
  private async updateDatabaseUsers(workspaceId: string): Promise<void> {
    const users = this.getWorkspaceUsers(workspaceId);
    
    await db
      .update(workspaces)
      .set({
        currentUsers: users.map(u => `${u.name} (${u.role}): ${u.activity}`),
        updatedAt: new Date(),
      })
      .where(eq(workspaces.id, workspaceId));
  }
  
  // Clean up inactive users periodically
  startCleanupInterval(): void {
    setInterval(() => {
      const now = Date.now();
      
      for (const [workspaceId, users] of this.activeUsers) {
        let hasChanges = false;
        
        for (const [userId, user] of users) {
          if (now - user.timestamp > 5 * 60 * 1000) {
            users.delete(userId);
            hasChanges = true;
          }
        }
        
        if (hasChanges) {
          this.updateDatabaseUsers(workspaceId);
        }
        
        if (users.size === 0) {
          this.activeUsers.delete(workspaceId);
        }
      }
    }, 60 * 1000); // Run every minute
  }
}