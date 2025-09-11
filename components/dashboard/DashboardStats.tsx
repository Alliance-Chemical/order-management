import { Suspense } from 'react';
import { getOptimizedDb } from '@/lib/db/neon';
import { workspaces } from '@/lib/db/schema/qr-workspace';
import { eq, gte, and, count } from 'drizzle-orm';

async function getStats() {
  const db = getOptimizedDb();
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  
  try {
    // Get today's orders
    const todayOrders = await db
      .select({ count: count() })
      .from(workspaces)
      .where(gte(workspaces.createdAt, today));
    
    // Get pending inspections
    const pendingInspections = await db
      .select({ count: count() })
      .from(workspaces)
      .where(
        and(
          eq(workspaces.status, 'active'),
          eq(workspaces.workflowPhase, 'warehouse')
        )
      );
    
    // Get completed today
    const completedToday = await db
      .select({ count: count() })
      .from(workspaces)
      .where(
        and(
          gte(workspaces.updatedAt, today),
          eq(workspaces.status, 'completed')
        )
      );
    
    return {
      ordersToday: todayOrders[0]?.count || 0,
      pendingInspections: pendingInspections[0]?.count || 0,
      completedToday: completedToday[0]?.count || 0
    };
  } catch (error) {
    console.error('Error fetching stats:', error);
    return {
      ordersToday: 0,
      pendingInspections: 0,
      completedToday: 0
    };
  }
}

function StatsLoading() {
  return (
    <div className="space-y-1">
      <div className="h-4 bg-gray-200 rounded animate-pulse w-32"></div>
      <div className="h-4 bg-gray-200 rounded animate-pulse w-40"></div>
      <div className="h-4 bg-gray-200 rounded animate-pulse w-36"></div>
    </div>
  );
}

async function StatsContent() {
  const stats = await getStats();
  
  return (
    <div className="space-y-1">
      <p className="text-sm text-gray-600">Orders Today: {stats.ordersToday}</p>
      <p className="text-sm text-gray-600">Pending Inspections: {stats.pendingInspections}</p>
      <p className="text-sm text-gray-600">Completed Today: {stats.completedToday}</p>
    </div>
  );
}

export default function DashboardStats() {
  return (
    <div className="bg-white p-6 rounded-lg shadow">
      <h2 className="text-lg font-semibold mb-2">Statistics</h2>
      <Suspense fallback={<StatsLoading />}>
        <StatsContent />
      </Suspense>
    </div>
  );
}