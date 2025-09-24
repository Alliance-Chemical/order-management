import { NextRequest, NextResponse } from 'next/server';
import { openaiService } from '@/lib/services/ai/openai-service';
import { workspaceService } from '@/lib/services/workspace/service';
import { s3Client } from '@/lib/aws/s3-client';
import sharp from 'sharp';

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const orderId = formData.get('orderId') as string;
    const documentFile = formData.get('document') as File;
    const documentType = formData.get('type') as 'COA';

    if (!orderId || !documentFile || !documentType) {
      return NextResponse.json(
        { error: 'Order ID, document, and type required' },
        { status: 400 }
      );
    }

    // Convert document to base64 (handle PDFs by converting to image)
    let documentBase64: string;
    const buffer = await documentFile.arrayBuffer();
    
    if (documentFile.type === 'application/pdf') {
      // For PDFs, we'd need a PDF-to-image converter
      // For now, we'll handle images directly
      return NextResponse.json(
        { error: 'PDF processing requires additional setup. Please upload as image.' },
        { status: 400 }
      );
    } else {
      // Process image with sharp for optimization
      const optimizedBuffer = await sharp(Buffer.from(buffer))
        .resize(2000, 2000, { fit: 'inside', withoutEnlargement: true })
        .jpeg({ quality: 90 })
        .toBuffer();
      
      documentBase64 = optimizedBuffer.toString('base64');
    }

    // Extract data using OpenAI
    const extractedData = await openaiService.extractDocumentData(
      documentBase64,
      documentType
    );

    // Validate extraction quality
    const confidenceValues = Object.values(extractedData.confidence_scores);
    const avgConfidence = confidenceValues.length > 0
      ? confidenceValues.reduce((sum, score) => sum + score, 0) / confidenceValues.length
      : 0;

    if (avgConfidence < 70) {
      extractedData.validation_errors.push(
        'Low confidence extraction - manual review recommended'
      );
    }

    // Store extracted data in workspace
    const updateData: Record<string, unknown> = {};
    
    if (documentType === 'COA') {
      updateData.coa_number = extractedData.extracted_data.certificate_number;
      updateData.batch_number = extractedData.extracted_data.batch_number;
      updateData.coa_metadata = extractedData.extracted_data;
    }

    await workspaceService.updateWorkspace(orderId, updateData);

    // Upload original document to S3
    const s3Key = `documents/${orderId}/${documentType}-${Date.now()}.${documentFile.name.split('.').pop()}`;
    await s3Client.uploadDocument(s3Key, Buffer.from(buffer), documentFile.type);

    // Log activity
    await workspaceService.addActivity(orderId, {
      type: 'document_processed',
      message: `${documentType} processed with AI OCR (${Math.round(avgConfidence)}% confidence)`,
      metadata: {
        documentType,
        s3Key,
        extractedFields: Object.keys(extractedData.extracted_data),
        confidence: avgConfidence,
        validationErrors: extractedData.validation_errors
      }
    });

    return NextResponse.json({
      success: true,
      documentType,
      extractedData: extractedData.extracted_data,
      confidence: avgConfidence,
      validationErrors: extractedData.validation_errors,
      s3Key,
      requiresManualReview: avgConfidence < 70 || extractedData.validation_errors.length > 0
    });

  } catch (error) {
    console.error('Document OCR error:', error);
    return NextResponse.json(
      { error: 'Failed to process document' },
      { status: 500 }
    );
  }
}
