import { NextRequest } from 'next/server';
import { CollaborationService } from '@/lib/services/collaboration';

const collaborationService = CollaborationService.getInstance();

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ workspaceId: string }> }
) {
  const { workspaceId } = await params;
  
  // Set up SSE headers
  const headers = new Headers({
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    'Connection': 'keep-alive',
  });
  
  // Create a readable stream for SSE
  const stream = new ReadableStream({
    start(controller) {
      // Send initial data
      const users = collaborationService.getWorkspaceUsers(workspaceId);
      controller.enqueue(
        `data: ${JSON.stringify({ type: 'users', users })}\n\n`
      );
      
      // Send updates every 5 seconds
      const interval = setInterval(() => {
        const users = collaborationService.getWorkspaceUsers(workspaceId);
        controller.enqueue(
          `data: ${JSON.stringify({ type: 'users', users })}\n\n`
        );
      }, 5000);
      
      // Clean up on close
      request.signal.addEventListener('abort', () => {
        clearInterval(interval);
        controller.close();
      });
    },
  });
  
  return new Response(stream, { headers });
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ workspaceId: string }> }
) {
  const { workspaceId } = await params;
  const body = await request.json();
  const { userId, userName, userRole, activity, action } = body;
  
  switch (action) {
    case 'join':
      await collaborationService.addUserToWorkspace(
        workspaceId,
        userId,
        userName,
        userRole,
        activity
      );
      break;
      
    case 'leave':
      await collaborationService.removeUserFromWorkspace(workspaceId, userId);
      break;
      
    case 'update':
      await collaborationService.updateUserActivity(
        workspaceId,
        userId,
        activity
      );
      break;
      
    default:
      return Response.json({ error: 'Invalid action' }, { status: 400 });
  }
  
  const users = collaborationService.getWorkspaceUsers(workspaceId);
  return Response.json({ users });
}