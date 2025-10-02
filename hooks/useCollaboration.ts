'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
// import { useSession } from '@/lib/auth-client';

// Mock useSession hook
const useSession = () => ({
  data: {
    user: {
      id: 'mock-user',
      name: 'Mock User',
      email: 'mock@example.com',
      role: 'agent' as const
    }
  },
  status: 'authenticated' as const
});

interface ActiveUser {
  id: string;
  name: string;
  role: 'agent' | 'supervisor';
  activity: string;
  timestamp: number;
}

export function useCollaboration(workspaceId: string) {
  const [activeUsers, setActiveUsers] = useState<ActiveUser[]>([]);
  const [isConnected, setIsConnected] = useState(false);
  const eventSourceRef = useRef<EventSource | null>(null);
  const { data: session } = useSession();
  
  // Join workspace
  const joinWorkspace = useCallback(async (activity: string) => {
    if (!session?.user) return;
    
    try {
      const response = await fetch(`/api/collaboration/${workspaceId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: session.user.id,
          userName: session.user.name || session.user.email,
          userRole: session.user.role || 'agent',
          activity,
          action: 'join',
        }),
      });
      
      if (response.ok) {
        const data = await response.json();
        setActiveUsers(data.users);
      }
    } catch (error) {
      console.error('Failed to join workspace:', error);
    }
  }, [workspaceId, session]);
  
  // Leave workspace
  const leaveWorkspace = useCallback(async () => {
    if (!session?.user) return;
    
    try {
      await fetch(`/api/collaboration/${workspaceId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: session.user.id,
          action: 'leave',
        }),
      });
    } catch (error) {
      console.error('Failed to leave workspace:', error);
    }
  }, [workspaceId, session]);
  
  // Update activity
  const updateActivity = useCallback(async (activity: string) => {
    if (!session?.user) return;
    
    try {
      await fetch(`/api/collaboration/${workspaceId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: session.user.id,
          activity,
          action: 'update',
        }),
      });
    } catch (error) {
      console.error('Failed to update activity:', error);
    }
  }, [workspaceId, session]);
  
  // Set up SSE connection
  useEffect(() => {
    if (!workspaceId) return;
    
    // Create SSE connection
    const eventSource = new EventSource(`/api/collaboration/${workspaceId}`);
    eventSourceRef.current = eventSource;
    
    eventSource.onopen = () => {
      setIsConnected(true);
    };
    
    eventSource.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        if (data.type === 'users') {
          setActiveUsers(data.users);
        }
      } catch (error) {
        console.error('Failed to parse SSE message:', error);
      }
    };
    
    eventSource.onerror = () => {
      setIsConnected(false);
      // Reconnect after 5 seconds
      setTimeout(() => {
        if (eventSourceRef.current === eventSource) {
          eventSource.close();
          eventSourceRef.current = new EventSource(`/api/collaboration/${workspaceId}`);
        }
      }, 5000);
    };
    
    // Clean up on unmount
    return () => {
      eventSource.close();
      eventSourceRef.current = null;
      leaveWorkspace();
    };
  }, [workspaceId, leaveWorkspace]);
  
  // Send heartbeat every 30 seconds
  useEffect(() => {
    if (!isConnected || !session?.user) return;
    
    const interval = setInterval(() => {
      updateActivity('active');
    }, 30000);
    
    return () => clearInterval(interval);
  }, [isConnected, session, updateActivity]);
  
  return {
    activeUsers,
    isConnected,
    joinWorkspace,
    leaveWorkspace,
    updateActivity,
  };
}