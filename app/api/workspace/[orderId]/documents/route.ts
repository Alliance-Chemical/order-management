import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { workspaces, documents } from '@/lib/db/schema/qr-workspace';
import { eq, and } from 'drizzle-orm';

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ orderId: string }> }
) {
  try {
    const params = await context.params;
    const orderId = Number(params.orderId);
    const { searchParams } = new URL(request.url);
    const documentType = searchParams.get('type');
    
    if (Number.isNaN(orderId)) {
      return NextResponse.json(
        { error: 'Invalid orderId' },
        { status: 400 }
      );
    }

    // Find the workspace
    const [workspace] = await db
      .select()
      .from(workspaces)
      .where(eq(workspaces.orderId, orderId))
      .limit(1);

    if (!workspace) {
      return NextResponse.json(
        { error: 'Workspace not found' },
        { status: 404 }
      );
    }

    // Build query conditions
    let whereCondition = eq(documents.workspaceId, workspace.id);
    if (documentType) {
      whereCondition = and(
        eq(documents.workspaceId, workspace.id),
        eq(documents.documentType, documentType)
      );
    }

    // Fetch documents
    const workspaceDocuments = await db
      .select()
      .from(documents)
      .where(whereCondition)
      .orderBy(documents.uploadedAt);

    return NextResponse.json({
      success: true,
      documents: workspaceDocuments,
      workspaceId: workspace.id
    });

  } catch (error) {
    console.error('Error fetching documents:', error);
    return NextResponse.json(
      { error: 'Failed to fetch documents' },
      { status: 500 }
    );
  }
}