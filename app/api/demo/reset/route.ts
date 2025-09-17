import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { workspaces, qrCodes, activityLog } from '@/lib/db/schema/qr-workspace';
import { sql } from 'drizzle-orm';
import { seedDemoData } from '@/lib/demo/seed-data';

export async function POST(_request: NextRequest) {
  try {
    // Check for demo mode or development environment
    if (process.env.NODE_ENV === 'production' && !process.env.DEMO_MODE) {
      return NextResponse.json(
        { error: 'Demo reset is not available in production' },
        { status: 403 }
      );
    }

    console.log('🔄 Starting demo reset...');
    
    // Clear all demo data (orders >= 99000)
    await db.delete(activityLog).where(sql`order_id >= 99000`);
    await db.delete(qrCodes).where(sql`order_id >= 99000`);
    await db.delete(workspaces).where(sql`order_id >= 99000`);
    // Re-seed demo data
    await seedDemoData();
    
    return NextResponse.json({
      success: true,
      message: 'Demo data reset successfully',
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    console.error('Demo reset error:', error);
    return NextResponse.json(
      { error: 'Failed to reset demo data' },
      { status: 500 }
    );
  }
}

export async function GET(_request: NextRequest) {
  // Health check for demo status
  try {
    const demoWorkspaces = await db.select()
      .from(workspaces)
      .where(sql`order_id >= 99000`)
      .limit(5);
    
    return NextResponse.json({
      demoMode: process.env.DEMO_MODE === 'true',
      demoOrders: demoWorkspaces.length,
      ready: demoWorkspaces.length > 0
    });
  } catch (error) {
    console.error('Demo status check failed:', error);
    return NextResponse.json(
      { error: 'Failed to check demo status' },
      { status: 500 }
    );
  }
}
