'use client';

import { useCollaboration } from '@/hooks/useCollaboration';
import { useEffect } from 'react';

interface CollaborationIndicatorProps {
  workspaceId: string;
  currentActivity?: string;
  className?: string;
}

export function CollaborationIndicator({ 
  workspaceId, 
  currentActivity = 'viewing',
  className = ''
}: CollaborationIndicatorProps) {
  const { activeUsers, joinWorkspace, updateActivity } = useCollaboration(workspaceId);
  
  useEffect(() => {
    joinWorkspace(currentActivity);
  }, []);
  
  useEffect(() => {
    updateActivity(currentActivity);
  }, [currentActivity, updateActivity]);
  
  if (activeUsers.length === 0) {
    return null;
  }
  
  return (
    <div className={`bg-blue-50 border border-blue-200 rounded-lg p-3 ${className}`}>
      <div className="flex items-center gap-2 mb-2">
        <div className="flex -space-x-2">
          {activeUsers.slice(0, 3).map((user, i) => (
            <div
              key={user.id}
              className="w-8 h-8 rounded-full bg-blue-500 text-white flex items-center justify-center text-xs font-medium border-2 border-white"
              title={`${user.name} (${user.role})`}
            >
              {user.name.charAt(0).toUpperCase()}
            </div>
          ))}
          {activeUsers.length > 3 && (
            <div className="w-8 h-8 rounded-full bg-gray-300 text-gray-700 flex items-center justify-center text-xs font-medium border-2 border-white">
              +{activeUsers.length - 3}
            </div>
          )}
        </div>
        <span className="text-sm font-medium text-blue-700">
          {activeUsers.length} {activeUsers.length === 1 ? 'person' : 'people'} active
        </span>
      </div>
      
      <div className="space-y-1">
        {activeUsers.map(user => (
          <div key={user.id} className="flex items-center gap-2 text-xs">
            <span className={`inline-block w-2 h-2 rounded-full ${
              user.role === 'supervisor' ? 'bg-purple-500' : 'bg-green-500'
            }`} />
            <span className="text-gray-600">
              {user.name} is {user.activity}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

export function CollaborationBadge({ 
  workspaceId,
  className = ''
}: { 
  workspaceId: string;
  className?: string;
}) {
  const { activeUsers } = useCollaboration(workspaceId);
  
  if (activeUsers.length === 0) {
    return null;
  }
  
  const hasAgent = activeUsers.some(u => u.role === 'agent');
  const hasSupervisor = activeUsers.some(u => u.role === 'supervisor');
  
  return (
    <div className={`flex items-center gap-1 ${className}`}>
      {hasAgent && (
        <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800">
          <span className="w-2 h-2 rounded-full bg-green-500 mr-1 animate-pulse" />
          Agent Active
        </span>
      )}
      {hasSupervisor && (
        <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-purple-100 text-purple-800">
          <span className="w-2 h-2 rounded-full bg-purple-500 mr-1 animate-pulse" />
          Supervisor Active
        </span>
      )}
    </div>
  );
}