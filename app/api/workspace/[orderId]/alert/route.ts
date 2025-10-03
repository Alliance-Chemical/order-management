import { NextRequest, NextResponse } from 'next/server';
import { WorkspaceRepository } from '@/lib/services/workspace/repository';
// AWS SNS removed - log alerts instead
const repository = new WorkspaceRepository();

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ orderId: string }> }
) {
  try {
    const params = await context.params;
    const body = await request.json();
    const { alertType, message, userId = 'system' } = body;

    const orderId = parseInt(params.orderId);
    const workspace = await repository.findByOrderId(orderId);
    
    if (!workspace) {
      return NextResponse.json({ error: 'Workspace not found' }, { status: 404 });
    }

    // Get alert config
    const configs = workspace.alertConfigs || [];
    const config = configs.find(c => c.alertType === alertType && c.enabled);
    
    if (!config) {
      return NextResponse.json({ error: 'Alert type not configured' }, { status: 400 });
    }

    // Check cooldown
    if (config.lastTriggeredAt) {
      const cooldownMs = (config.cooldownMinutes || 30) * 60 * 1000;
      const timeSinceLastAlert = Date.now() - config.lastTriggeredAt.getTime();
      
      if (timeSinceLastAlert < cooldownMs) {
        return NextResponse.json(
          { error: 'Alert on cooldown', remainingSeconds: Math.round((cooldownMs - timeSinceLastAlert) / 1000) },
          { status: 429 }
        );
      }
    }

    // Format message
    const formattedMessage = message || `Alert: ${alertType} for Order ${workspace.orderNumber}\n\nWorkspace: ${process.env.NEXT_PUBLIC_APP_URL}${workspace.workspaceUrl}\nOrder ID: ${workspace.orderId}`;

    // Log alert (SNS removed)
    const snsMessageId = null;
    console.log('Alert triggered:', {
      alertType,
      orderNumber: workspace.orderNumber,
      message: formattedMessage
    });

    // Log alert
    await repository.logActivity({
      workspaceId: workspace.id,
      activityType: 'alert_sent',
      performedBy: userId,
      metadata: {
        alertType,
        recipients: config.recipients,
        snsMessageId,
      },
    });

    return NextResponse.json({
      success: true,
      messageId: snsMessageId,
      alertType,
    });
  } catch (error) {
    console.error('Error sending alert:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
