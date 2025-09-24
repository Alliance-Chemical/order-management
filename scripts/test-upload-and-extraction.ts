#!/usr/bin/env npx tsx
/**
 * Test script for S3 upload and ChatGPT lot extraction
 * Run with: npx tsx scripts/test-upload-and-extraction.ts
 */

import { S3Client, HeadBucketCommand } from '@aws-sdk/client-s3';
import fetch from 'node-fetch';
import fs from 'fs/promises';
import path from 'path';

// Color output helpers
const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  cyan: '\x1b[36m',
  gray: '\x1b[90m'
};

const log = {
  success: (msg: string) => console.log(`${colors.green}✓${colors.reset} ${msg}`),
  error: (msg: string) => console.log(`${colors.red}✗${colors.reset} ${msg}`),
  warning: (msg: string) => console.log(`${colors.yellow}⚠${colors.reset} ${msg}`),
  info: (msg: string) => console.log(`${colors.cyan}ℹ${colors.reset} ${msg}`),
  debug: (msg: string) => console.log(`${colors.gray}  ${msg}${colors.reset}`)
};

async function testS3Configuration() {
  console.log('\n📦 Testing S3 Configuration...\n');

  const awsAccessKeyId = process.env.AWS_ACCESS_KEY_ID;
  const awsSecretAccessKey = process.env.AWS_SECRET_ACCESS_KEY;
  const awsRegion = process.env.AWS_REGION || 'us-east-2';
  const s3Bucket =
    process.env.S3_DOCUMENTS_BUCKET ||
    process.env.AWS_S3_BUCKET ||
    process.env.S3_BUCKET_NAME;

  // Check environment variables
  if (!awsAccessKeyId || !awsSecretAccessKey) {
    log.error('AWS credentials not configured');
    log.debug('Required: AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY');
    return false;
  }
  log.success('AWS credentials configured');

  if (!s3Bucket) {
    log.error('S3 bucket not configured');
    log.debug('Required: S3_DOCUMENTS_BUCKET or AWS_S3_BUCKET or S3_BUCKET_NAME');
    return false;
  }
  log.success(`S3 bucket configured: ${s3Bucket}`);

  // Test S3 connectivity
  try {
    const s3Client = new S3Client({
      region: awsRegion,
      credentials: {
        accessKeyId: awsAccessKeyId,
        secretAccessKey: awsSecretAccessKey
      }
    });

    const command = new HeadBucketCommand({ Bucket: s3Bucket });
    await s3Client.send(command);
    log.success(`S3 bucket accessible in region ${awsRegion}`);
    return true;
  } catch (error: any) {
    log.error(`S3 connection failed: ${error.message}`);
    if (error.name === 'NoSuchBucket') {
      log.debug('The specified bucket does not exist');
    } else if (error.name === 'Forbidden') {
      log.debug('Access denied. Check IAM permissions');
    }
    return false;
  }
}

async function testOpenAIConfiguration() {
  console.log('\n🤖 Testing OpenAI Configuration...\n');

  const apiKey = process.env.OPENAI_API_KEY || process.env.OPEN_AI_KEY;

  if (!apiKey) {
    log.error('OpenAI API key not configured');
    log.debug('Required: OPENAI_API_KEY or OPEN_AI_KEY');
    return false;
  }
  log.success('OpenAI API key configured');

  // Test API key validity
  try {
    const response = await fetch('https://api.openai.com/v1/models/gpt-5-nano-2025-08-07', {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${apiKey}`
      }
    });

    if (response.ok) {
      log.success('OpenAI API key is valid');
      log.success('gpt-5-nano-2025-08-07 model is accessible');
      return true;
    } else {
      const errorText = await response.text();
      log.error(`OpenAI API returned ${response.status}: ${errorText}`);
      if (response.status === 401) {
        log.debug('Invalid API key');
      } else if (response.status === 404) {
        log.debug('Model not found or not accessible');
      }
      return false;
    }
  } catch (error: any) {
    log.error(`OpenAI connection failed: ${error.message}`);
    return false;
  }
}

async function testHealthEndpoint() {
  console.log('\n🏥 Testing Health Check Endpoint...\n');

  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';

  try {
    const response = await fetch(`${baseUrl}/api/health/services`);

    if (!response.ok) {
      log.error(`Health check returned ${response.status}`);
      return false;
    }

    const health = await response.json();

    // Check S3 service
    if (health.services?.s3) {
      const s3 = health.services.s3;
      if (s3.status === 'healthy') {
        log.success('S3 service is healthy');
        if (s3.latency) {
          log.debug(`Latency: ${s3.latency}ms`);
        }
      } else {
        log.error(`S3 service is ${s3.status}`);
        if (s3.error) {
          log.debug(s3.error);
        }
      }
    }

    // Check OpenAI service
    if (health.services?.openai) {
      const openai = health.services.openai;
      if (openai.status === 'healthy') {
        log.success('OpenAI service is healthy');
        if (openai.latency) {
          log.debug(`Latency: ${openai.latency}ms`);
        }
      } else {
        log.error(`OpenAI service is ${openai.status}`);
        if (openai.error) {
          log.debug(openai.error);
        }
      }
    }

    // Check image processing
    if (health.services?.['image-processing']) {
      const imgProc = health.services['image-processing'];
      if (imgProc.status === 'healthy') {
        log.success('Image processing is ready');
      } else {
        log.warning(`Image processing is ${imgProc.status}`);
        if (imgProc.error) {
          log.debug(imgProc.error);
        }
      }
    }

    return health.status === 'healthy';
  } catch (error: any) {
    log.error(`Health check failed: ${error.message}`);
    log.debug('Is the application running?');
    return false;
  }
}

async function testLotExtraction() {
  console.log('\n🔍 Testing Lot Number Extraction...\n');

  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';

  // Create a simple test image with text (you'd normally use a real chemical label image)
  const testImageBase64 = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==';

  try {
    const response = await fetch(`${baseUrl}/api/ai/extract-lot-numbers`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        image: testImageBase64,
        orderId: 'TEST-001'
      })
    });

    if (!response.ok) {
      const error = await response.json();
      log.error(`Lot extraction returned ${response.status}`);
      log.debug(JSON.stringify(error, null, 2));
      return false;
    }

    const result = await response.json();
    log.success('Lot extraction endpoint is working');

    if (result.fromCache) {
      log.info('Result was served from cache');
    }

    if (result.confidence) {
      log.debug(`Confidence: ${(result.confidence * 100).toFixed(0)}%`);
    }

    if (result.lotNumbers && result.lotNumbers.length > 0) {
      log.success(`Found lot numbers: ${result.lotNumbers.join(', ')}`);
    } else {
      log.info('No lot numbers found in test image (expected for blank image)');
    }

    return true;
  } catch (error: any) {
    log.error(`Lot extraction test failed: ${error.message}`);
    return false;
  }
}

async function runAllTests() {
  console.log('====================================');
  console.log(' S3 Upload & Lot Extraction Tests');
  console.log('====================================');

  const results = {
    s3Config: await testS3Configuration(),
    openAIConfig: await testOpenAIConfiguration(),
    healthCheck: await testHealthEndpoint(),
    lotExtraction: await testLotExtraction()
  };

  console.log('\n====================================');
  console.log(' Test Results Summary');
  console.log('====================================\n');

  const allPassed = Object.values(results).every(r => r === true);

  Object.entries(results).forEach(([test, passed]) => {
    const status = passed ? `${colors.green}PASS${colors.reset}` : `${colors.red}FAIL${colors.reset}`;
    console.log(`  ${test.padEnd(20)} ${status}`);
  });

  console.log('\n====================================\n');

  if (allPassed) {
    log.success('All tests passed! S3 upload and lot extraction are ready.');
  } else {
    log.error('Some tests failed. Please check the configuration above.');

    console.log('\n📋 Configuration Checklist:\n');
    console.log('  [ ] AWS_ACCESS_KEY_ID environment variable set');
    console.log('  [ ] AWS_SECRET_ACCESS_KEY environment variable set');
    console.log('  [ ] S3_DOCUMENTS_BUCKET environment variable set');
    console.log('  [ ] OPENAI_API_KEY environment variable set');
    console.log('  [ ] S3 bucket exists and is accessible');
    console.log('  [ ] OpenAI API key has access to gpt-5-nano-2025-08-07');
    console.log('  [ ] Application is running (npm run dev)');
  }

  process.exit(allPassed ? 0 : 1);
}

// Run tests
runAllTests().catch(error => {
  console.error('Unexpected error:', error);
  process.exit(1);
});