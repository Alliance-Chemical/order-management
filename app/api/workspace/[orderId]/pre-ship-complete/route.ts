import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { qrWorkspaces } from '@/lib/db/schema/qr-workspace';
import { eq } from 'drizzle-orm';

export async function POST(
  request: NextRequest,
  { params }: { params: { orderId: string } }
) {
  try {
    const { checkedItems, photos, completedAt } = await request.json();
    
    const orderId = params.orderId;
    
    // Get the current workspace
    const [workspace] = await db
      .select()
      .from(qrWorkspaces)
      .where(eq(qrWorkspaces.orderId, orderId))
      .limit(1);
      
    if (!workspace) {
      return NextResponse.json(
        { error: 'Workspace not found' },
        { status: 404 }
      );
    }

    // Extract lot numbers from all photos
    const allLotNumbers = photos.reduce((acc: string[], photo: any) => {
      return [...acc, ...(photo.lotNumbers || [])];
    }, []);

    // Update workspace with pre-ship inspection data
    const updatedData = {
      ...workspace.data,
      preShipInspection: {
        checkedItems,
        photos: photos.map((p: any) => ({
          lotNumbers: p.lotNumbers,
          capturedAt: new Date().toISOString()
        })),
        lotNumbers: allLotNumbers,
        completedAt,
        completedBy: 'worker' // In production, get from auth
      },
      status: 'ready_to_ship'
    };

    await db
      .update(qrWorkspaces)
      .set({
        data: updatedData,
        status: 'ready_to_ship',
        updatedAt: new Date()
      })
      .where(eq(qrWorkspaces.orderId, orderId));

    // Send notification that pre-ship inspection is complete
    await fetch(`/api/workspace/${orderId}/notify`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        type: 'pre_ship_complete',
        message: `Pre-ship inspection completed. ${allLotNumbers.length} lot numbers captured.`,
        lotNumbers: allLotNumbers
      })
    });

    return NextResponse.json({
      success: true,
      lotNumbers: allLotNumbers,
      message: 'Pre-ship inspection completed successfully'
    });

  } catch (error) {
    console.error('Error completing pre-ship inspection:', error);
    return NextResponse.json(
      { error: 'Failed to save pre-ship inspection' },
      { status: 500 }
    );
  }
}