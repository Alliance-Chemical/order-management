import { NextRequest, NextResponse } from 'next/server';
import { openaiService } from '@/lib/services/ai/openai-service';
import { workspaceService } from '@/lib/services/workspace/service';
// AWS SNS removed - log notifications instead

type VoiceAnalysis = {
  severity?: string;
  issueType?: string;
  [key: string]: unknown;
};

type ImageAnalysis = {
  detected_issues?: string[];
  requires_supervisor?: boolean;
  recommendations?: string[];
  confidence?: number;
  [key: string]: unknown;
};

type IssueReportAnalysis = {
  orderId: string;
  workerId?: string;
  timestamp: string;
  context?: string;
  voiceAnalysis?: VoiceAnalysis;
  imageAnalysis?: ImageAnalysis;
};

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const orderId = formData.get('orderId') as string;
    const audioFile = formData.get('audio') as File | null;
    const imageFile = formData.get('image') as File | null;
    const context = formData.get('context') as string;
    const workerId = formData.get('workerId') as string;

    if (!orderId) {
      return NextResponse.json({ error: 'Order ID required' }, { status: 400 });
    }

    const issueReport: IssueReportAnalysis = {
      orderId,
      workerId: workerId || undefined,
      timestamp: new Date().toISOString(),
      context: context || undefined,
    };

    // Process voice note if provided
    if (audioFile) {
      const audioBuffer = await audioFile.arrayBuffer();
      const audioBase64 = Buffer.from(audioBuffer).toString('base64');
      
      const voiceAnalysis = await openaiService.processVoiceNote(audioBase64);
      issueReport.voiceAnalysis = voiceAnalysis as VoiceAnalysis;
    }

    // Process image if provided
    if (imageFile) {
      const imageBuffer = await imageFile.arrayBuffer();
      const imageBase64 = Buffer.from(imageBuffer).toString('base64');
      
      const imageAnalysis = await openaiService.analyzeInspectionImage(
        imageBase64,
        context || 'Inspection failure'
      );
      issueReport.imageAnalysis = imageAnalysis as ImageAnalysis;

      // Auto-escalate if supervisor required
      if (imageAnalysis.requires_supervisor) {
        console.log('URGENT: Supervisor required for inspection issue', {
          orderId,
          issues: imageAnalysis.detected_issues,
          recommendations: imageAnalysis.recommendations,
          workerId,
          timestamp: new Date().toISOString()
        });
      }
    }

    // Determine overall severity
    const severity = issueReport.voiceAnalysis?.severity
      || (issueReport.imageAnalysis?.requires_supervisor ? 'high' : 'medium');

    // Log to activity
    await workspaceService.addActivity(orderId, {
      type: 'inspection_issue',
      message: `AI-assisted issue reported: ${issueReport.voiceAnalysis?.issueType || 'Visual inspection failure'}`,
      metadata: issueReport,
      severity
    });

    // Update workspace status if critical
    if (severity === 'high') {
      await workspaceService.updateWorkspace(orderId, {
        status: 'on_hold',
        hold_reason: 'AI detected critical issue requiring supervisor review'
      });
    }

    return NextResponse.json({
      success: true,
      issueId: `ISS-${Date.now()}`,
      severity,
      analysis: issueReport,
      escalated: issueReport.imageAnalysis?.requires_supervisor || false
    });

  } catch (error) {
    console.error('AI issue reporting error:', error);
    return NextResponse.json(
      { error: 'Failed to process issue report' },
      { status: 500 }
    );
  }
}
