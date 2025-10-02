import { NextRequest, NextResponse } from 'next/server';
import { openaiService } from '@/lib/services/ai/openai-service';
import { workspaceService } from '@/lib/services/workspace/service';
import { s3Client, getS3BucketName } from '@/lib/aws/s3-client';
import { uploadToS3WithRetry, generateS3Key } from '@/lib/utils/upload-helpers';
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
    type ExtractedData = {
      extracted_data: Record<string, unknown>;
      confidence_scores: Record<string, number>;
      validation_errors: string[];
    };
    type COAData = { certificate_number?: string; batch_number?: string; [key: string]: unknown };

    const extractedData = await openaiService.extractDocumentData(
      documentBase64,
      documentType
    ) as ExtractedData;

    // Validate extraction quality
    const confidenceValues = Object.values(extractedData.confidence_scores || {}) as number[];
    const avgConfidence = confidenceValues.length > 0
      ? confidenceValues.reduce((sum: number, score: number) => sum + score, 0) / confidenceValues.length
      : 0;

    if (avgConfidence < 70) {
      extractedData.validation_errors.push(
        'Low confidence extraction - manual review recommended'
      );
    }

    // Store extracted data in workspace
    const updateData: Record<string, unknown> = {};
    
    if (documentType === 'COA') {
      const coa = extractedData.extracted_data as COAData;
      updateData.coa_number = coa.certificate_number;
      updateData.batch_number = coa.batch_number;
      updateData.coa_metadata = extractedData.extracted_data;
    }

    await workspaceService.updateWorkspace(orderId, updateData);

    // Upload original document to S3
    const s3BucketName = getS3BucketName();
    const s3Key = generateS3Key(orderId, documentType, documentFile.name);

    if (s3Client && s3BucketName) {
      const uploadResult = await uploadToS3WithRetry(s3Client, {
        bucket: s3BucketName,
        key: s3Key,
        body: Buffer.from(buffer),
        contentType: documentFile.type,
        metadata: {
          orderId: orderId,
          documentType: documentType,
          originalName: documentFile.name,
          uploadedAt: new Date().toISOString()
        }
      });

      if (!uploadResult.success) {
        console.error('S3 upload failed:', uploadResult.error);
      }
    }

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
