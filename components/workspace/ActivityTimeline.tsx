'use client';

import { useEffect, useState } from 'react';
import { 
  ClockIcon, 
  CheckCircleIcon, 
  DocumentIcon, 
  TruckIcon,
  ExclamationTriangleIcon,
  CameraIcon,
  UserIcon
} from '@heroicons/react/24/outline';
import ProgressBar from '@/components/ui/ProgressBar';

interface ActivityTimelineProps {
  orderId: string;
  workspace: any;
  initialState?: any;
  onStateChange?: (state: any) => void;
}

export default function ActivityTimeline({ orderId }: ActivityTimelineProps) {
  const [activities, setActivities] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchActivities();
  }, [orderId]);

  const fetchActivities = async () => {
    try {
      const response = await fetch(`/api/activity/${orderId}`);
      if (response.ok) {
        const data = await response.json();
        setActivities(data.activities || []);
      }
    } catch (error) {
      console.error('Failed to fetch activities:', error);
    } finally {
      setLoading(false);
    }
  };

  const getActivityIcon = (type: string) => {
    const icons: Record<string, any> = {
      'workspace_created': CheckCircleIcon,
      'document_uploaded': DocumentIcon,
      'marked_ready_to_ship': TruckIcon,
      'notification_sent': ExclamationTriangleIcon,
      'photo_added': CameraIcon,
      'user_action': UserIcon,
    };
    return icons[type] || ClockIcon;
  };

  const getActivityColor = (type: string) => {
    const colors: Record<string, string> = {
      'workspace_created': 'bg-green-500',
      'document_uploaded': 'bg-blue-500',
      'marked_ready_to_ship': 'bg-purple-500',
      'notification_sent': 'bg-yellow-500',
      'issue_reported': 'bg-red-500',
    };
    return colors[type] || 'bg-gray-500';
  };

  if (loading) {
    return (
      <div className="py-12">
        <ProgressBar
          value={30}
          label="Loading activity timeline"
          showPercentage={false}
          variant="default"
          animated={true}
          size="sm"
          className="max-w-sm mx-auto"
        />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-lg shadow">
        <div className="px-6 py-4 border-b border-gray-200">
          <h3 className="text-lg font-semibold text-gray-900">Activity Timeline</h3>
        </div>
        
        <div className="px-6 py-4">
          {activities.length === 0 ? (
            <div className="text-center py-8">
              <ClockIcon className="mx-auto w-12 h-12 text-gray-400" />
              <p className="mt-2 text-sm text-gray-500">No activities recorded yet</p>
            </div>
          ) : (
            <div className="flow-root">
              <ul className="-mb-8" data-testid="activity-list">
                {activities.map((activity, index) => {
                  const Icon = getActivityIcon(activity.activityType);
                  const isLast = index === activities.length - 1;
                  
                  return (
                    <li key={activity.id}>
                      <div className="relative pb-8">
                        {!isLast && (
                          <span
                            className="absolute left-4 top-4 -ml-px h-full w-0.5 bg-gray-200"
                            aria-hidden="true"
                          />
                        )}
                        <div className="relative flex space-x-3">
                          <div>
                            <span
                              className={`h-8 w-8 rounded-full flex items-center justify-center ring-8 ring-white ${getActivityColor(activity.activityType)}`}
                            >
                              <Icon className="w-5 h-5 text-white" aria-hidden="true" />
                            </span>
                          </div>
                          <div className="flex min-w-0 flex-1 justify-between space-x-4 pt-1.5">
                            <div>
                              <p className="text-sm text-gray-900">
                                <span data-activity-type={activity.activityType}>
                                  {activity.activityDescription}
                                </span>
                              </p>
                              {activity.metadata && Object.keys(activity.metadata).length > 0 && (
                                <div className="mt-1 text-xs text-gray-500">
                                  {Object.entries(activity.metadata).map(([key, value]) => (
                                    <span key={key} className="mr-3">
                                      {key}: {String(value)}
                                    </span>
                                  ))}
                                </div>
                              )}
                            </div>
                            <div className="whitespace-nowrap text-right text-sm text-gray-500">
                              <div>{new Date(activity.performedAt).toLocaleDateString()}</div>
                              <div>{new Date(activity.performedAt).toLocaleTimeString()}</div>
                              <div className="text-xs">{activity.performedBy}</div>
                            </div>
                          </div>
                        </div>
                      </div>
                    </li>
                  );
                })}
              </ul>
            </div>
          )}
        </div>
      </div>

      {/* Activity Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-white rounded-lg shadow p-4">
          <p className="text-sm text-gray-500">Total Activities</p>
          <p className="text-2xl font-semibold text-gray-900">{activities.length}</p>
        </div>
        <div className="bg-white rounded-lg shadow p-4">
          <p className="text-sm text-gray-500">Documents</p>
          <p className="text-2xl font-semibold text-gray-900">
            {activities.filter(a => a.activityType === 'document_uploaded').length}
          </p>
        </div>
        <div className="bg-white rounded-lg shadow p-4">
          <p className="text-sm text-gray-500">Notifications</p>
          <p className="text-2xl font-semibold text-gray-900">
            {activities.filter(a => a.activityType === 'notification_sent').length}
          </p>
        </div>
        <div className="bg-white rounded-lg shadow p-4">
          <p className="text-sm text-gray-500">Last Activity</p>
          <p className="text-sm font-medium text-gray-900">
            {activities[0] ? new Date(activities[0].performedAt).toLocaleString() : 'N/A'}
          </p>
        </div>
      </div>
    </div>
  );
}