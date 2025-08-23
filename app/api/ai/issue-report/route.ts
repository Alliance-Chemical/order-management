import { NextRequest, NextResponse } from 'next/server';
import { geminiService } from '@/lib/services/ai/gemini-service';
import { workspaceService } from '@/lib/services/workspace/service';
// AWS SNS removed - log notifications instead

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

    let issueReport: any = {
      orderId,
      workerId,
      timestamp: new Date().toISOString(),
      context
    };

    // Process voice note if provided
    if (audioFile) {
      const audioBuffer = await audioFile.arrayBuffer();
      const audioBase64 = Buffer.from(audioBuffer).toString('base64');
      
      const voiceAnalysis = await geminiService.processVoiceNote(audioBase64);
      issueReport.voiceAnalysis = voiceAnalysis;
    }

    // Process image if provided
    if (imageFile) {
      const imageBuffer = await imageFile.arrayBuffer();
      const imageBase64 = Buffer.from(imageBuffer).toString('base64');
      
      const imageAnalysis = await geminiService.analyzeInspectionImage(
        imageBase64,
        context || 'Inspection failure'
      );
      issueReport.imageAnalysis = imageAnalysis;

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
    const severity = issueReport.voiceAnalysis?.severity || 
                    (issueReport.imageAnalysis?.requires_supervisor ? 'high' : 'medium');

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