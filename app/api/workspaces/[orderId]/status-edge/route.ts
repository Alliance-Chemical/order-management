import { NextRequest, NextResponse } from 'next/server';
import { KVCache } from '@/lib/cache/kv-cache';

type WorkspaceStatus = {
  id: string;
  orderId: number | string;
  status?: string;
  phase?: string;
  progress?: number;
  activeStep?: string;
  workflowType?: string;
  updatedAt?: string;
  cachedAt: number;
};

// Enable Edge Runtime
export const runtime = 'edge';
export const dynamic = 'force-dynamic';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ orderId: string }> }
) {
  try {
    const { orderId } = await params;
    
    // Check cache first
    const cacheKey = `workspace:status:${orderId}`;
    const cached = await KVCache.get(cacheKey) as WorkspaceStatus | null;
    
    if (cached) {
      return NextResponse.json({
        ...cached,
        cached: true,
        cacheAge: Date.now() - cached.cachedAt,
      });
    }
    
    // Fetch from main API if not cached
    const response = await fetch(
      `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/api/workspaces/${orderId}`,
      {
        headers: {
          'x-internal-request': 'true',
        },
      }
    );
    
    if (!response.ok) {
      return NextResponse.json(
        { error: 'Workspace not found' },
        { status: 404 }
      );
    }
    
    const workspace = await response.json() as WorkspaceStatus & {
      progress?: number;
      activeStep?: string;
      updatedAt?: string;
    };
    
    // Extract just status information for caching
    const statusData: WorkspaceStatus = {
      id: workspace.id,
      orderId: workspace.orderId,
      status: workspace.status,
      phase: workspace.phase,
      progress: workspace.progress || 0,
      activeStep: workspace.activeStep,
      workflowType: workspace.workflowType,
      updatedAt: workspace.updatedAt,
      cachedAt: Date.now(),
    };
    
    // Cache for 10 seconds (real-time updates)
    await KVCache.set(cacheKey, statusData, 10);
    
    return NextResponse.json({
      ...statusData,
      cached: false,
    });
  } catch (error) {
    console.error('Edge status error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// Server-Sent Events endpoint for real-time updates
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ orderId: string }> }
) {
  const { orderId } = await params;
  
  // Create a readable stream for SSE
  const stream = new ReadableStream({
    async start(controller) {
      const encoder = new TextEncoder();
      
      // Send initial status
      const status = await KVCache.get(`workspace:status:${orderId}`) as WorkspaceStatus | null;
      if (status) {
        controller.enqueue(
          encoder.encode(`data: ${JSON.stringify(status)}\n\n`)
        );
      }
      
      // Set up polling for changes (until we have proper pub/sub)
      let lastStatus = JSON.stringify(status);
      const interval = setInterval(async () => {
        try {
          const newStatus = await KVCache.get(`workspace:status:${orderId}`) as WorkspaceStatus | null;
          const newStatusStr = JSON.stringify(newStatus);
          
          if (newStatusStr !== lastStatus) {
            controller.enqueue(
              encoder.encode(`data: ${newStatusStr}\n\n`)
            );
            lastStatus = newStatusStr;
          }
        } catch (error) {
          console.error('SSE error:', error);
        }
      }, 1000); // Check every second
      
      // Clean up on client disconnect
      request.signal.addEventListener('abort', () => {
        clearInterval(interval);
        controller.close();
      });
    },
  });
  
  return new NextResponse(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
    },
  });
}
