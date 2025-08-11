import { NextRequest, NextResponse } from 'next/server';
import { WorkspaceRepository } from '@/lib/services/workspace/repository';
import { sendSNSAlert, formatAlertMessage } from '@/lib/aws/sns-client';
import { alertHistory } from '@/lib/db/schema/qr-workspace';

const repository = new WorkspaceRepository();

export async function POST(
  request: NextRequest,
  { params }: { params: { orderId: string } }
) {
  try {
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
    const formattedMessage = message || formatAlertMessage(
      alertType,
      workspace.orderNumber,
      {
        workspaceUrl: `${process.env.NEXT_PUBLIC_APP_URL}${workspace.workspaceUrl}`,
        orderId: workspace.orderId,
      }
    );

    // Send alert
    let snsMessageId;
    if (config.snsTopicArn) {
      const result = await sendSNSAlert(
        config.snsTopicArn,
        formattedMessage,
        `Order ${workspace.orderNumber} - ${alertType}`
      );
      snsMessageId = result.MessageId;
    }

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

    // Update alert config
    await repository.update(workspace.id, {
      alertConfigs: workspace.alertConfigs?.map(c => 
        c.id === config.id 
          ? { ...c, lastTriggeredAt: new Date(), triggerCount: (c.triggerCount || 0) + 1 }
          : c
      ),
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