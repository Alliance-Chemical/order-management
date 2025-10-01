import { NextResponse } from 'next/server';
import { s3Client } from '@/lib/aws/s3-client';
import { ListBucketsCommand, HeadBucketCommand } from '@aws-sdk/client-s3';

interface ServiceCheck {
  name: string;
  status: 'healthy' | 'unhealthy' | 'degraded' | 'unknown';
  configured: boolean;
  details?: Record<string, unknown>;
  error?: string;
  latency?: number;
}

async function checkS3Service(): Promise<ServiceCheck> {
  const check: ServiceCheck = {
    name: 's3',
    status: 'unknown',
    configured: false
  };

  // Check configuration
  const hasCredentials = !!(
    process.env.AWS_ACCESS_KEY_ID &&
    process.env.AWS_SECRET_ACCESS_KEY
  );

  const bucket =
    process.env.S3_DOCUMENTS_BUCKET ||
    process.env.AWS_S3_BUCKET ||
    process.env.S3_BUCKET_NAME;

  check.configured = hasCredentials && !!bucket;
  check.details = {
    region: process.env.AWS_REGION || 'us-east-2',
    bucket: bucket || 'not-configured'
  };

  if (!check.configured) {
    check.status = 'unknown';
    check.error = 'Missing AWS credentials or bucket configuration';
    return check;
  }

  try {
    const startTime = Date.now();

    // Check if we can access the specific bucket
    if (bucket) {
      const headCommand = new HeadBucketCommand({ Bucket: bucket });
      await s3Client.send(headCommand);
    } else {
      // Fallback to listing buckets if no specific bucket is configured
      const listCommand = new ListBucketsCommand({});
      await s3Client.send(listCommand);
    }

    check.latency = Date.now() - startTime;
    check.status = 'healthy';
    check.details.accessible = true;
  } catch (error) {
    check.status = 'unhealthy';
    check.error = error instanceof Error ? error.message : 'S3 connection failed';
    check.details.accessible = false;
  }

  return check;
}

async function checkOpenAIService(): Promise<ServiceCheck> {
  const check: ServiceCheck = {
    name: 'openai',
    status: 'unknown',
    configured: false
  };

  const apiKey = process.env.OPENAI_API_KEY || process.env.OPEN_AI_KEY;
  check.configured = !!apiKey;

  if (!check.configured) {
    check.status = 'unknown';
    check.error = 'OpenAI API key not configured';
    return check;
  }

  try {
    const startTime = Date.now();

    // Test with a minimal request to check API key validity
    const response = await fetch('https://api.openai.com/v1/models/gpt-5-nano-2025-08-07', {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${apiKey}`
      }
    });

    check.latency = Date.now() - startTime;

    if (response.ok) {
      check.status = 'healthy';
      check.details = {
        model: 'gpt-5-nano-2025-08-07',
        apiKeyValid: true,
        responseStatus: response.status
      };
    } else {
      check.status = 'unhealthy';
      const errorText = await response.text().catch(() => '');
      check.error = `API returned ${response.status}: ${errorText}`;
      check.details = {
        responseStatus: response.status,
        apiKeyValid: response.status !== 401
      };
    }
  } catch (error) {
    check.status = 'unhealthy';
    check.error = error instanceof Error ? error.message : 'OpenAI connection failed';
  }

  return check;
}

async function validateImageProcessing(): Promise<ServiceCheck> {
  const check: ServiceCheck = {
    name: 'image-processing',
    status: 'unknown',
    configured: false
  };

  // Check if both S3 and OpenAI are configured for image processing
  const s3Configured = !!(
    process.env.AWS_ACCESS_KEY_ID &&
    process.env.AWS_SECRET_ACCESS_KEY &&
    (process.env.S3_DOCUMENTS_BUCKET || process.env.AWS_S3_BUCKET || process.env.S3_BUCKET_NAME)
  );

  const openAIConfigured = !!(process.env.OPENAI_API_KEY || process.env.OPEN_AI_KEY);

  check.configured = s3Configured && openAIConfigured;
  check.details = {
    s3Ready: s3Configured,
    openAIReady: openAIConfigured,
    maxImageSize: '20MB',
    supportedFormats: ['image/jpeg', 'image/png', 'image/gif', 'image/webp']
  };

  if (check.configured) {
    check.status = 'healthy';
  } else {
    check.status = 'degraded';
    check.error = 'Missing S3 or OpenAI configuration for full image processing';
  }

  return check;
}

export async function GET() {
  try {
    const checks = await Promise.all([
      checkS3Service(),
      checkOpenAIService(),
      validateImageProcessing()
    ]);

    const overallStatus = checks.every(c => c.status === 'healthy')
      ? 'healthy'
      : checks.some(c => c.status === 'unhealthy')
      ? 'unhealthy'
      : 'degraded';

    const response = {
      status: overallStatus,
      timestamp: new Date().toISOString(),
      services: checks.reduce((acc, check) => {
        acc[check.name] = check;
        return acc;
      }, {} as Record<string, ServiceCheck>),
      summary: {
        healthy: checks.filter(c => c.status === 'healthy').length,
        unhealthy: checks.filter(c => c.status === 'unhealthy').length,
        degraded: checks.filter(c => c.status === 'degraded').length,
        unknown: checks.filter(c => c.status === 'unknown').length
      }
    };

    const statusCode = overallStatus === 'healthy' ? 200 :
                      overallStatus === 'degraded' ? 200 : 503;

    return NextResponse.json(response, { status: statusCode });
  } catch (error) {
    return NextResponse.json(
      {
        status: 'error',
        timestamp: new Date().toISOString(),
        error: error instanceof Error ? error.message : 'Health check failed'
      },
      { status: 500 }
    );
  }
}
