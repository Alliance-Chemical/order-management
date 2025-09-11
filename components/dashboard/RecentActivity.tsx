import { Suspense } from 'react';
import { getOptimizedDb } from '@/lib/db/neon';
import { workspaces } from '@/lib/db/schema/qr-workspace';
import { desc } from 'drizzle-orm';

async function getRecentActivity() {
  const db = getOptimizedDb();
  
  try {
    const recent = await db
      .select({
        orderNumber: workspaces.orderNumber,
        status: workspaces.status,
        workflowPhase: workspaces.workflowPhase,
        updatedAt: workspaces.updatedAt
      })
      .from(workspaces)
      .orderBy(desc(workspaces.updatedAt))
      .limit(5);
    
    return recent;
  } catch (error) {
    console.error('Error fetching recent activity:', error);
    return [];
  }
}

function ActivityLoading() {
  return (
    <div className="space-y-2">
      {[1, 2, 3].map(i => (
        <div key={i} className="h-12 bg-gray-100 rounded animate-pulse"></div>
      ))}
    </div>
  );
}

async function ActivityContent() {
  const activities = await getRecentActivity();
  
  if (activities.length === 0) {
    return <p className="text-gray-600">No recent activity</p>;
  }
  
  return (
    <div className="space-y-2">
      {activities.map((activity, index) => (
        <div key={index} className="border-l-4 border-blue-500 pl-3 py-1">
          <p className="text-sm font-medium">Order #{activity.orderNumber}</p>
          <p className="text-xs text-gray-500">
            {activity.workflowPhase} • {activity.status}
          </p>
        </div>
      ))}
    </div>
  );
}

export default function RecentActivity() {
  return (
    <div className="bg-white p-6 rounded-lg shadow">
      <h2 className="text-lg font-semibold mb-2">Recent Activity</h2>
      <Suspense fallback={<ActivityLoading />}>
        <ActivityContent />
      </Suspense>
    </div>
  );
}