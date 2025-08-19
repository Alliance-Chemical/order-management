import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { workspaces } from '@/lib/db/schema/qr-workspace';
import { eq, and, or } from 'drizzle-orm';

export async function GET(request: NextRequest) {
  try {
    // Fetch active workspaces
    const activeWorkspaces = await db.select()
      .from(workspaces)
      .where(or(
        eq(workspaces.status, 'active'),
        eq(workspaces.status, 'pending')
      ))
      .limit(20);

    // Get inspection data for each workspace
    const inspectionStates = await Promise.all(
      activeWorkspaces.map(async (workspace) => {
        // No inspections table, using module states instead

        const moduleState = workspace.moduleStates as any || {};
        const currentInspection = moduleState[workspace.workflowPhase] || {};

        return {
          orderId: workspace.orderId.toString(),
          orderNumber: workspace.orderNumber,
          workflowPhase: workspace.workflowPhase,
          status: workspace.status,
          currentStep: currentInspection.currentStep,
          completedSteps: currentInspection.completedSteps || [],
          lastSync: workspace.updatedAt?.toISOString()
        };
      })
    );

    return NextResponse.json({
      inspections: inspectionStates
    });
  } catch (error) {
    console.error('Failed to fetch inspection states:', error);
    return NextResponse.json(
      { error: 'Failed to fetch inspection states' },
      { status: 500 }
    );
  }
}