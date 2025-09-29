import { NextRequest, NextResponse } from 'next/server';
import { WorkspaceRepository } from '@/lib/services/workspace/repository';

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const query = searchParams.get('q') || undefined;
    const status = (searchParams.get('status') as 'active' | 'shipped' | 'archived' | 'all') || 'all';
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');
    const limit = parseInt(searchParams.get('limit') || '50');
    const offset = parseInt(searchParams.get('offset') || '0');

    const repository = new WorkspaceRepository();

    const workspaces = await repository.searchWorkspaces({
      query,
      status,
      startDate: startDate ? new Date(startDate) : undefined,
      endDate: endDate ? new Date(endDate) : undefined,
      limit,
      offset,
    });

    return NextResponse.json({
      success: true,
      workspaces,
      count: workspaces.length,
    });
  } catch (error) {
    console.error('Workspace search error:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to search workspaces',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}