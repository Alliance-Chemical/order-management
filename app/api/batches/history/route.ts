import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { batchHistory } from '@/lib/db/schema/qr-workspace';
import { desc, eq } from 'drizzle-orm';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const workspaceId = searchParams.get('workspaceId');
    const limit = parseInt(searchParams.get('limit') || '50');
    const offset = parseInt(searchParams.get('offset') || '0');

    // Build query with optional workspace filter
    const batches = workspaceId
      ? await db
          .select()
          .from(batchHistory)
          .where(eq(batchHistory.workspaceId, workspaceId))
          .orderBy(desc(batchHistory.createdAt))
          .limit(limit)
          .offset(offset)
      : await db
          .select()
          .from(batchHistory)
          .orderBy(desc(batchHistory.createdAt))
          .limit(limit)
          .offset(offset);

    // Convert decimal fields to numbers for client
    const formattedBatches = batches.map(batch => ({
      id: batch.id,
      date: batch.createdAt,
      batchNumber: batch.batchNumber,
      chemicalName: batch.chemicalName,
      initialConcentration: parseFloat(batch.initialConcentration),
      desiredConcentration: parseFloat(batch.desiredConcentration),
      totalVolume: parseFloat(batch.totalVolumeGallons),
      chemicalAmount: parseFloat(batch.chemicalVolumeGallons),
      waterAmount: parseFloat(batch.waterVolumeGallons),
      chemicalWeight: parseFloat(batch.chemicalWeightLbs),
      waterWeight: parseFloat(batch.waterWeightLbs),
      notes: batch.notes || '',
      completedBy: batch.completedBy,
      methodUsed: batch.methodUsed,
      initialSpecificGravity: parseFloat(batch.initialSpecificGravity),
      workspaceId: batch.workspaceId
    }));

    return NextResponse.json({
      success: true,
      batches: formattedBatches,
      pagination: {
        limit,
        offset,
        total: batches.length
      }
    });

  } catch (error) {
    console.error('Error fetching batch history:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch batch history' },
      { status: 500 }
    );
  }
}