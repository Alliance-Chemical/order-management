#!/usr/bin/env node

import { S3Client, CreateBucketCommand, PutBucketCorsCommand, PutBucketLifecycleConfigurationCommand } from '@aws-sdk/client-s3';
import { SQSClient, CreateQueueCommand, GetQueueAttributesCommand } from '@aws-sdk/client-sqs';
import { SNSClient, CreateTopicCommand } from '@aws-sdk/client-sns';
import * as dotenv from 'dotenv';
import * as fs from 'fs';
import * as path from 'path';

// Load environment variables
dotenv.config({ path: '.env.local' });

const AWS_REGION = process.env.AWS_REGION || 'us-east-2';

const s3Client = new S3Client({
  region: AWS_REGION,
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
  },
});

const sqsClient = new SQSClient({
  region: AWS_REGION,
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
  },
});

const snsClient = new SNSClient({
  region: AWS_REGION,
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
  },
});

async function createS3Bucket(bucketName: string, isArchive: boolean = false) {
  try {
    console.log(`Creating S3 bucket: ${bucketName}`);
    
    // Create bucket
    await s3Client.send(new CreateBucketCommand({
      Bucket: bucketName,
      CreateBucketConfiguration: AWS_REGION !== 'us-east-1' ? {
        LocationConstraint: AWS_REGION as any,
      } : undefined,
    }));

    // Set CORS for document uploads
    await s3Client.send(new PutBucketCorsCommand({
      Bucket: bucketName,
      CORSConfiguration: {
        CORSRules: [{
          AllowedHeaders: ['*'],
          AllowedMethods: ['GET', 'PUT', 'POST', 'DELETE', 'HEAD'],
          AllowedOrigins: ['*'],
          ExposeHeaders: ['ETag'],
          MaxAgeSeconds: 3000,
        }],
      },
    }));

    // Set lifecycle policy for archive bucket
    if (isArchive) {
      try {
        await s3Client.send(new PutBucketLifecycleConfigurationCommand({
          Bucket: bucketName,
          LifecycleConfiguration: {
            Rules: [{
              Id: 'archive-old-data',
              Status: 'Enabled',
              Filter: {},
              Transitions: [{
                Days: 90,
                StorageClass: 'GLACIER',
              }],
              Expiration: {
                Days: 2555, // 7 years
              },
            }],
          },
        }));
      } catch (lifecycleError) {
        console.log('ℹ️ Skipping lifecycle policy (optional)');
      }
    }

    console.log(`✅ S3 bucket ${bucketName} created successfully`);
    return bucketName;
  } catch (error: any) {
    if (error.Code === 'BucketAlreadyOwnedByYou') {
      console.log(`ℹ️ S3 bucket ${bucketName} already exists`);
      return bucketName;
    }
    throw error;
  }
}

async function createSQSQueue(queueName: string, isFifo: boolean = false) {
  try {
    const finalQueueName = isFifo ? `${queueName}.fifo` : queueName;
    console.log(`Creating SQS queue: ${finalQueueName}`);
    
    const result = await sqsClient.send(new CreateQueueCommand({
      QueueName: finalQueueName,
      Attributes: {
        DelaySeconds: '0',
        MessageRetentionPeriod: '86400', // 1 day
        ReceiveMessageWaitTimeSeconds: '20', // Long polling
        VisibilityTimeout: '300', // 5 minutes
        ...(isFifo && {
          FifoQueue: 'true',
          ContentBasedDeduplication: 'true',
        }),
      },
    }));

    console.log(`✅ SQS queue ${finalQueueName} created successfully`);
    return result.QueueUrl;
  } catch (error: any) {
    if (error.Code === 'QueueAlreadyExists') {
      console.log(`ℹ️ SQS queue ${queueName} already exists`);
      return `https://sqs.${AWS_REGION}.amazonaws.com/${process.env.AWS_ACCOUNT_ID}/${queueName}`;
    }
    throw error;
  }
}

async function createSNSTopic(topicName: string) {
  try {
    console.log(`Creating SNS topic: ${topicName}`);
    
    const result = await snsClient.send(new CreateTopicCommand({
      Name: topicName,
    }));

    console.log(`✅ SNS topic ${topicName} created successfully`);
    return result.TopicArn;
  } catch (error) {
    console.error(`❌ Error creating SNS topic ${topicName}:`, error);
    throw error;
  }
}

async function updateEnvFile(resources: Record<string, string>) {
  const envPath = path.join(process.cwd(), '.env.local');
  let envContent = fs.readFileSync(envPath, 'utf-8');

  // Update or add environment variables
  Object.entries(resources).forEach(([key, value]) => {
    const regex = new RegExp(`^${key}=.*$`, 'm');
    if (envContent.match(regex)) {
      envContent = envContent.replace(regex, `${key}="${value}"`);
    } else {
      envContent += `\n${key}="${value}"`;
    }
  });

  fs.writeFileSync(envPath, envContent);
  console.log('✅ Updated .env.local file with AWS resource URLs');
}

async function main() {
  console.log('🚀 Setting up AWS resources for QR Workspace System\n');

  const resources: Record<string, string> = {};

  try {
    // Create S3 buckets
    console.log('📦 Creating S3 buckets...\n');
    const docsBucket = await createS3Bucket('alliance-chemical-documents');
    const archiveBucket = await createS3Bucket('alliance-chemical-archives', true);
    
    resources.S3_DOCUMENTS_BUCKET = docsBucket;
    resources.S3_ARCHIVES_BUCKET = archiveBucket;

    // Create SQS queues
    console.log('\n📬 Creating SQS queues...\n');
    const qrQueue = await createSQSQueue('qr-generation-queue', true);
    const alertQueue = await createSQSQueue('alert-queue', true);
    const archiveQueue = await createSQSQueue('archive-queue');
    
    resources.QR_GENERATION_QUEUE_URL = qrQueue!;
    resources.ALERT_QUEUE_URL = alertQueue!;
    resources.ARCHIVE_QUEUE_URL = archiveQueue!;

    // Create SNS topics
    console.log('\n🔔 Creating SNS topics...\n');
    const orderAlertsTopic = await createSNSTopic('order-alerts');
    const supervisorAlertsTopic = await createSNSTopic('supervisor-alerts');
    const systemAlertsTopic = await createSNSTopic('system-alerts');
    
    resources.SNS_ORDER_ALERTS_TOPIC = orderAlertsTopic!;
    resources.SNS_SUPERVISOR_ALERTS_TOPIC = supervisorAlertsTopic!;
    resources.SNS_SYSTEM_ALERTS_TOPIC = systemAlertsTopic!;

    // Update .env.local file
    console.log('\n📝 Updating environment variables...\n');
    await updateEnvFile(resources);

    console.log('\n✨ AWS resources setup completed successfully!\n');
    console.log('Resources created:');
    console.log('=================');
    Object.entries(resources).forEach(([key, value]) => {
      console.log(`${key}: ${value}`);
    });

  } catch (error) {
    console.error('\n❌ Error setting up AWS resources:', error);
    process.exit(1);
  }
}

// Check for required environment variables
if (!process.env.AWS_ACCESS_KEY_ID || !process.env.AWS_SECRET_ACCESS_KEY) {
  console.error('❌ Missing AWS credentials. Please set AWS_ACCESS_KEY_ID and AWS_SECRET_ACCESS_KEY');
  process.exit(1);
}

main();