import { db } from '@/lib/db';
import { workspaces } from '@/lib/db/schema/qr-workspace';
import { eq } from 'drizzle-orm';
import { touchPresence, clearPresence, listPresence } from './presence';

export interface ActiveUser {
  id: string;
  name: string;
  role: 'agent' | 'supervisor';
  activity: string;
  timestamp: number;
}

export class CollaborationService {
  private static instance: CollaborationService;
  private lastDbUpdate: Map<string, string> = new Map(); // workspaceId -> lastUsersString
  
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
    // Update presence in KV store
    await touchPresence(workspaceId, {
      id: userId,
      name: userName,
      role: userRole,
      activity
    });
    
    // Update database only if users changed
    await this.updateDatabaseUsersIfChanged(workspaceId);
  }
  
  async removeUserFromWorkspace(
    workspaceId: string,
    userId: string
  ): Promise<void> {
    // Clear presence from KV store
    await clearPresence(workspaceId, userId);
    
    // Update database only if users changed
    await this.updateDatabaseUsersIfChanged(workspaceId);
  }
  
  async updateUserActivity(
    workspaceId: string,
    userId: string,
    activity: string
  ): Promise<void> {
    // Get current presence to preserve other fields
    const users = await listPresence(workspaceId);
    const user = users.find((u) => u.id === userId);
    
    if (user && user.name && user.role) {
      await touchPresence(workspaceId, {
        id: userId,
        name: user.name,
        role: user.role,
        activity
      });
      
      // Update database only if users changed
      await this.updateDatabaseUsersIfChanged(workspaceId);
    }
  }
  
  async getWorkspaceUsers(workspaceId: string): Promise<ActiveUser[]> {
    const users = await listPresence(workspaceId);
    
    // Convert KV format to ActiveUser format
    return users
      .filter((u): u is typeof users[number] & { id: string; name: string; role: 'agent' | 'supervisor' } =>
        Boolean(u.id && u.name && u.role)
      )
      .map((u) => ({
        id: u.id,
        name: u.name,
        role: u.role,
        activity: u.activity ?? '',
        timestamp: u.ts || Date.now(),
      }));
  }
  
  private async updateDatabaseUsersIfChanged(workspaceId: string): Promise<void> {
    const users = await this.getWorkspaceUsers(workspaceId);

    // Create a string representation of current users
    const usersString = users
      .map(u => `${u.name} (${u.role}): ${u.activity}`)
      .sort()
      .join(', ');
    
    // Check if users actually changed
    const lastUsersString = this.lastDbUpdate.get(workspaceId);
    if (lastUsersString === usersString) {
      return; // No change, skip DB update
    }
    
    // Update database
    await db
      .update(workspaces)
      .set({
        currentUsers: users.map(u => `${u.name} (${u.role}): ${u.activity}`),
        updatedAt: new Date(),
      })
      .where(eq(workspaces.id, workspaceId));
    
    // Remember last update
    this.lastDbUpdate.set(workspaceId, usersString);
  }
  
  // Clean up inactive users periodically (KV handles TTL automatically)
  startCleanupInterval(): void {
    // KV handles expiration automatically with TTL
    // We just need to periodically sync DB if needed
    setInterval(async () => {
      // Iterate through known workspaces and update DB if needed
      for (const workspaceId of this.lastDbUpdate.keys()) {
        await this.updateDatabaseUsersIfChanged(workspaceId);
      }
    }, 60 * 1000); // Run every minute
  }
}
