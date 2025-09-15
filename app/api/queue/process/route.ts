import { NextRequest, NextResponse } from 'next/server';
import { kvQueue, withLock } from '@/lib/queue/kv-queue';
import { JobSchemas } from '@/lib/queue/schemas';
import { WorkspaceService } from '@/lib/services/workspace/service';
import { QRGenerator } from '@/src/services/qr/qrGenerator';

export const runtime = 'nodejs'; // Required for database access

const workspaceService = new WorkspaceService();
const qrGenerator = new QRGenerator();

// Job handlers
const handlers = {
  async qr_generation(payload: any) {
    const validated = JobSchemas.qr_generation.parse(payload);
    console.log('Processing QR generation:', validated);

    // Handle different QR generation actions
    if (validated.action === 'generate_qr_codes' || validated.action === 'generate_qr') {
      const { workspaceId, orderId, orderNumber, items } = validated;

      // Log activity start
      await workspaceService.repository.logActivity({
        workspaceId,
        activityType: 'qr_generation_started',
        performedBy: 'system',
        metadata: { orderId, orderNumber, itemCount: items?.length || 0 }
      });

      try {
        // Call the actual QR generation endpoint
        const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3001';
        const response = await fetch(`${baseUrl}/api/workspace/${orderId}/qrcodes`, {
          method: 'GET',
          headers: {
            'User-Agent': 'QueueProcessor/1.0'
          }
        });

        if (!response.ok) {
          throw new Error(`QR generation failed: ${response.status} ${response.statusText}`);
        }

        const result = await response.json();
        console.log(`✅ Generated ${result.qrCodes?.length || 0} QR codes for workspace ${workspaceId}`);

        // Log success
        await workspaceService.repository.logActivity({
          workspaceId,
          activityType: 'qr_generation_completed',
          performedBy: 'system',
          metadata: {
            orderId,
            orderNumber,
            qrCodesGenerated: result.qrCodes?.length || 0,
            success: true
          }
        });

      } catch (error) {
        console.error(`❌ QR generation failed for workspace ${workspaceId}:`, error);

        // Log failure
        await workspaceService.repository.logActivity({
          workspaceId,
          activityType: 'qr_generation_failed',
          performedBy: 'system',
          metadata: {
            orderId,
            orderNumber,
            error: error instanceof Error ? error.message : 'Unknown error',
            success: false
          }
        });

        throw error; // Re-throw to mark job as failed
      }
    }
  },

  async alert(payload: any) {
    const validated = JobSchemas.alert.parse(payload);
    console.log('Processing alert:', validated);
    
    // Log alert to activity
    await workspaceService.repository.logActivity({
      workspaceId: validated.workspaceId,
      activityType: 'alert_processed',
      performedBy: 'system',
      metadata: { alertType: validated.alertType }
    });
  },

  async webhook(payload: any) {
    const validated = JobSchemas.webhook.parse(payload);
    console.log('Processing webhook:', validated);
    
    // Make webhook call
    const response = await fetch(validated.url, {
      method: validated.method,
      headers: validated.headers as HeadersInit,
      body: validated.body ? JSON.stringify(validated.body) : undefined,
    });
    
    if (!response.ok) {
      throw new Error(`Webhook failed: ${response.status} ${response.statusText}`);
    }
  },

  async tag_sync(payload: any) {
    const validated = JobSchemas.tag_sync.parse(payload);
    console.log('Processing tag sync:', validated);
    
    // Import tag sync service
    const { tagSyncService } = await import('@/lib/services/shipstation/tag-sync');
    
    await tagSyncService.handleTagUpdate({
      order_id: validated.orderId,
      tag_ids: validated.tagIds,
    });
  },
};

export async function POST(request: NextRequest) {
  try {
    // Prevent concurrent processing with distributed lock
    const result = await withLock('jobs-processor', 55, async () => {
      // Move scheduled jobs to ready
      const flushed = await kvQueue.flushDue('jobs', 100);
      
      // Get batch of jobs
      const batch = await kvQueue.pop('jobs', 20);
      
      if (batch.length === 0) {
        // Silent return when queue is empty - no logging to reduce noise
        return { processed: 0, flushed, empty: true };
      }
      
      console.log(`Processing ${batch.length} jobs (${flushed} flushed from scheduled)`);
      
      let processed = 0;
      let failed = 0;
      
      for (const msg of batch) {
        try {
          // Check for duplicate processing (idempotency)
          const isDupe = await kvQueue.isDuplicate('jobs', msg.type, msg.payload);
          if (isDupe) {
            console.log(`Skipping duplicate job: ${msg.type} ${msg.id}`);
            processed++;
            continue;
          }
          
          // Get handler
          const handler = handlers[msg.type as keyof typeof handlers];
          if (!handler) {
            console.error(`No handler for job type: ${msg.type}`);
            await kvQueue.retryOrDeadletter('jobs', msg, `Unknown job type: ${msg.type}`);
            failed++;
            continue;
          }
          
          // Execute handler
          await handler(msg.payload);
          processed++;
          console.log(`Successfully processed ${msg.type} job ${msg.id}`);
          
        } catch (error) {
          console.error(`Job ${msg.id} failed:`, error);
          const errorMsg = error instanceof Error ? error.message : 'Unknown error';
          await kvQueue.retryOrDeadletter('jobs', msg, errorMsg);
          failed++;
        }
      }
      
      return { processed, failed, flushed };
    });
    
    // Check if lock was acquired
    if ('skipped' in result) {
      // Silent return - another processor is already running
      return NextResponse.json(
        { skipped: true },
        { status: 200 }
      );
    }
    
    // Only log if something actually happened
    if (result.processed > 0 || result.failed > 0) {
      console.log(`Queue processed: ${result.processed} successful, ${result.failed} failed, ${result.flushed} flushed`);
    }
    
    return NextResponse.json(result);
    
  } catch (error) {
    console.error('Queue processor error:', error);
    return NextResponse.json(
      { error: 'Queue processing failed' },
      { status: 500 }
    );
  }
}

// Cron endpoint for Vercel
export async function GET(request: NextRequest) {
  // Verify cron secret if configured
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret) {
    const authHeader = request.headers.get('authorization');
    if (authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
  }
  
  // Trigger processing
  return POST(request);
}
