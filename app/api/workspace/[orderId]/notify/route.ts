import { NextRequest, NextResponse } from 'next/server';
// AWS SNS removed - log notifications instead
import { WorkspaceRepository } from '@/lib/services/workspace/repository';

const repository = new WorkspaceRepository();

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ orderId: string }> }
) {
  try {
    const { orderId } = await params;
    const body = await request.json();
    const { type, status, notes, metadata } = body;

    if (!type) {
      return NextResponse.json(
        { error: 'Notification type is required' },
        { status: 400 }
      );
    }

    const workspace = await repository.findByOrderId(parseInt(orderId));
    
    if (!workspace) {
      return NextResponse.json({ error: 'Workspace not found' }, { status: 404 });
    }

    // Get alert configuration for this type
    const alertConfig = await repository.getAlertConfig(workspace.id, type);
    
    if (!alertConfig || !alertConfig.enabled) {
      return NextResponse.json({ 
        success: false, 
        message: 'Alert not enabled for this type' 
      });
    }

    // Check cooldown period
    if (alertConfig.lastTriggeredAt) {
      const lastTrigger = new Date(alertConfig.lastTriggeredAt);
      const cooldownMs = (alertConfig.cooldownMinutes || 30) * 60 * 1000;
      const nextAllowed = new Date(lastTrigger.getTime() + cooldownMs);
      
      if (new Date() < nextAllowed) {
        return NextResponse.json({ 
          success: false, 
          message: 'Notification is in cooldown period',
          nextAllowedAt: nextAllowed.toISOString()
        });
      }
    }

    // Build notification message
    const message = buildNotificationMessage(type, workspace, status, notes, metadata);
    
    // Log notification (SNS removed)
    const messageId = `notify-${Date.now()}`;
    console.log('Notification sent:', {
      subject: message.subject,
      body: message.body,
      orderId: orderId.toString(),
      orderNumber: workspace.orderNumber,
      workspaceId: workspace.id,
      alertType: type
    });

    // Update alert config
    await repository.updateAlertConfig(alertConfig.id, {
      lastTriggeredAt: new Date(),
      triggerCount: (alertConfig.triggerCount || 0) + 1,
    });

    // Log to alert history
    await repository.logAlertHistory({
      workspaceId: workspace.id,
      alertConfigId: alertConfig.id,
      alertType: type,
      triggeredBy: 'system', // Replace with actual user
      messageContent: message.body,
      recipientsNotified: alertConfig.recipients || [],
      snsMessageId: messageId,
    });

    // Log activity
    await repository.logActivity({
      workspaceId: workspace.id,
      activityType: 'notification_sent',
      activityDescription: `${type} notification sent`,
      performedBy: 'system',
      module: 'alerts',
      metadata: { type, status, messageId },
    });

    return NextResponse.json({
      success: true,
      messageId,
      message: 'Notification sent successfully',
    });
  } catch (error) {
    console.error('Error sending notification:', error);
    return NextResponse.json({ error: 'Failed to send notification' }, { status: 500 });
  }
}

function buildNotificationMessage(
  type: string,
  workspace: any,
  status?: string,
  notes?: string,
  metadata?: any
) {
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
  const workspaceUrl = `${baseUrl}/workspace/${workspace.orderId}`;

  const messages: Record<string, any> = {
    pre_mix_complete: {
      subject: `Pre-Mix Inspection Complete - Order ${workspace.orderNumber}`,
      body: `Pre-Mix inspection has been completed for order ${workspace.orderNumber}.
      
Status: ${status === 'issues_found' ? '⚠️ Issues Found' : '✅ Passed'}
${notes ? `\nNotes: ${notes}` : ''}

View workspace: ${workspaceUrl}`,
    },
    ready_to_ship: {
      subject: `Order Ready to Ship - ${workspace.orderNumber}`,
      body: `Order ${workspace.orderNumber} has been marked as ready to ship.

${metadata?.bolNumber ? `BOL Number: ${metadata.bolNumber}` : ''}
${metadata?.carrierName ? `Carrier: ${metadata.carrierName}` : ''}
${metadata?.trailerNumber ? `Trailer: ${metadata.trailerNumber}` : ''}

View workspace: ${workspaceUrl}`,
    },
    document_uploaded: {
      subject: `Document Uploaded - Order ${workspace.orderNumber}`,
      body: `A new document has been uploaded for order ${workspace.orderNumber}.

Document Type: ${metadata?.documentType || 'Unknown'}
File Name: ${metadata?.fileName || 'Unknown'}

View workspace: ${workspaceUrl}`,
    },
    freight_order_received: {
      subject: `New Freight Order - ${workspace.orderNumber}`,
      body: `A new freight order has been received and workspace created.

Order Number: ${workspace.orderNumber}
Order ID: ${workspace.orderId}
${metadata?.items ? `Items: ${metadata.items}` : ''}

Access workspace: ${workspaceUrl}`,
    },
    issue_reported: {
      subject: `⚠️ Issue Reported - Order ${workspace.orderNumber}`,
      body: `An issue has been reported for order ${workspace.orderNumber}.

Issue: ${notes || 'No details provided'}

Immediate attention required.

View workspace: ${workspaceUrl}`,
    },
  };

  return messages[type] || {
    subject: `Notification - Order ${workspace.orderNumber}`,
    body: `Event: ${type}
Order: ${workspace.orderNumber}
${notes ? `\nDetails: ${notes}` : ''}

View workspace: ${workspaceUrl}`,
  };
}