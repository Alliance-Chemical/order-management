#!/usr/bin/env node

/**
 * AWS S3 Bucket Setup Script
 * Creates S3 buckets and IAM resources for the application
 * 
 * Usage: node scripts/setup-aws-resources.js
 * 
 * Prerequisites:
 * - AWS credentials configured (AWS_ACCESS_KEY_ID and AWS_SECRET_ACCESS_KEY)
 * - Or AWS CLI configured with `aws configure`
 */

const { S3Client, CreateBucketCommand, PutBucketVersioningCommand, PutBucketLifecycleConfigurationCommand, PutBucketCorsCommand, PutPublicAccessBlockCommand, HeadBucketCommand } = require('@aws-sdk/client-s3');
const { IAMClient, CreateUserCommand, CreateAccessKeyCommand, PutUserPolicyCommand, GetUserCommand } = require('@aws-sdk/client-iam');

// Configuration
const AWS_REGION = process.env.AWS_REGION || 'us-east-2';
const DOCUMENTS_BUCKET = 'alliance-chemical-documents';
const QR_DOCS_BUCKET = 'ac-qrdocs-prod';
const IAM_USER_NAME = 'alliance-chemical-app';

// Initialize AWS clients
const s3Client = new S3Client({ region: AWS_REGION });
const iamClient = new IAMClient({ region: AWS_REGION });

async function bucketExists(bucketName) {
  try {
    await s3Client.send(new HeadBucketCommand({ Bucket: bucketName }));
    return true;
  } catch (error) {
    if (error.name === 'NotFound') {
      return false;
    }
    throw error;
  }
}

async function createBucket(bucketName) {
  console.log(`📦 Creating bucket: ${bucketName}`);
  
  try {
    // Check if bucket exists
    if (await bucketExists(bucketName)) {
      console.log(`   ✅ Bucket already exists`);
      return;
    }

    // Create bucket
    const createCommand = new CreateBucketCommand({
      Bucket: bucketName,
      CreateBucketConfiguration: {
        LocationConstraint: AWS_REGION === 'us-east-1' ? undefined : AWS_REGION
      }
    });
    
    await s3Client.send(createCommand);
    console.log(`   ✅ Bucket created`);
    
    // Enable versioning for documents bucket
    if (bucketName === DOCUMENTS_BUCKET) {
      console.log(`   📝 Enabling versioning...`);
      await s3Client.send(new PutBucketVersioningCommand({
        Bucket: bucketName,
        VersioningConfiguration: {
          Status: 'Enabled'
        }
      }));
    }
    
    // Set lifecycle policy for QR docs bucket
    if (bucketName === QR_DOCS_BUCKET) {
      console.log(`   ♻️ Setting lifecycle policy...`);
      await s3Client.send(new PutBucketLifecycleConfigurationCommand({
        Bucket: bucketName,
        LifecycleConfiguration: {
          Rules: [
            {
              Id: 'ArchiveOldOrders',
              Status: 'Enabled',
              Transitions: [
                {
                  Days: 90,
                  StorageClass: 'STANDARD_IA'
                },
                {
                  Days: 365,
                  StorageClass: 'GLACIER'
                }
              ]
            }
          ]
        }
      }));
    }
    
    // Configure CORS
    console.log(`   🌐 Configuring CORS...`);
    await s3Client.send(new PutBucketCorsCommand({
      Bucket: bucketName,
      CORSConfiguration: {
        CORSRules: [
          {
            AllowedHeaders: ['*'],
            AllowedMethods: ['GET', 'PUT', 'POST', 'DELETE', 'HEAD'],
            AllowedOrigins: ['*'],
            ExposeHeaders: ['ETag'],
            MaxAgeSeconds: 3000
          }
        ]
      }
    }));
    
    // Block public access
    console.log(`   🔒 Configuring security...`);
    await s3Client.send(new PutPublicAccessBlockCommand({
      Bucket: bucketName,
      PublicAccessBlockConfiguration: {
        BlockPublicAcls: true,
        IgnorePublicAcls: true,
        BlockPublicPolicy: true,
        RestrictPublicBuckets: true
      }
    }));
    
    console.log(`   ✅ Bucket configuration complete`);
  } catch (error) {
    if (error.name === 'BucketAlreadyOwnedByYou' || error.name === 'BucketAlreadyExists') {
      console.log(`   ⚠️ Bucket already exists (owned by you or taken)`);
    } else {
      console.error(`   ❌ Error: ${error.message}`);
      throw error;
    }
  }
}

async function createIAMUser() {
  console.log(`\n👤 Creating IAM user: ${IAM_USER_NAME}`);
  
  try {
    // Check if user exists
    try {
      await iamClient.send(new GetUserCommand({ UserName: IAM_USER_NAME }));
      console.log(`   ✅ User already exists`);
    } catch (error) {
      if (error.name === 'NoSuchEntity') {
        // Create user
        await iamClient.send(new CreateUserCommand({
          UserName: IAM_USER_NAME,
          Tags: [
            { Key: 'Purpose', Value: 'Vercel App Access' },
            { Key: 'Application', Value: 'Alliance Chemical' }
          ]
        }));
        console.log(`   ✅ User created`);
      } else {
        throw error;
      }
    }
    
    // Attach policy
    console.log(`   📋 Attaching S3 access policy...`);
    const policyDocument = {
      Version: '2012-10-17',
      Statement: [
        {
          Effect: 'Allow',
          Action: [
            's3:GetObject',
            's3:PutObject',
            's3:DeleteObject',
            's3:ListBucket',
            's3:GetObjectVersion'
          ],
          Resource: [
            `arn:aws:s3:::${DOCUMENTS_BUCKET}`,
            `arn:aws:s3:::${DOCUMENTS_BUCKET}/*`,
            `arn:aws:s3:::${QR_DOCS_BUCKET}`,
            `arn:aws:s3:::${QR_DOCS_BUCKET}/*`
          ]
        }
      ]
    };
    
    await iamClient.send(new PutUserPolicyCommand({
      UserName: IAM_USER_NAME,
      PolicyName: 'S3AccessPolicy',
      PolicyDocument: JSON.stringify(policyDocument)
    }));
    console.log(`   ✅ Policy attached`);
    
    // Create access key
    console.log(`   🔑 Creating access keys...`);
    const { AccessKey } = await iamClient.send(new CreateAccessKeyCommand({
      UserName: IAM_USER_NAME
    }));
    
    console.log(`   ✅ Access keys created`);
    
    return AccessKey;
  } catch (error) {
    console.error(`   ❌ Error: ${error.message}`);
    throw error;
  }
}

async function main() {
  console.log('🚀 AWS S3 Setup for Alliance Chemical Order Management');
  console.log('='.repeat(50));
  console.log(`📍 Region: ${AWS_REGION}\n`);
  
  try {
    // Create S3 buckets
    await createBucket(DOCUMENTS_BUCKET);
    await createBucket(QR_DOCS_BUCKET);
    
    // Create IAM user and get credentials
    const accessKey = await createIAMUser();
    
    // Output configuration
    console.log('\n' + '='.repeat(50));
    console.log('✅ Setup Complete!\n');
    console.log('📝 Add these to your .env.local or Vercel environment variables:');
    console.log('='.repeat(50));
    console.log(`AWS_REGION=${AWS_REGION}`);
    console.log(`AWS_ACCESS_KEY_ID=${accessKey.AccessKeyId}`);
    console.log(`AWS_SECRET_ACCESS_KEY=${accessKey.SecretAccessKey}`);
    console.log(`S3_DOCUMENTS_BUCKET=${DOCUMENTS_BUCKET}`);
    console.log(`S3_BUCKET_NAME=${QR_DOCS_BUCKET}`);
    console.log('='.repeat(50));
    console.log('\n⚠️ IMPORTANT: Save these credentials securely!');
    console.log('The secret access key will not be shown again.\n');
    
  } catch (error) {
    console.error('\n❌ Setup failed:', error.message);
    console.log('\n💡 Make sure you have:');
    console.log('   1. AWS credentials configured');
    console.log('   2. Appropriate permissions to create S3 buckets and IAM users');
    console.log('   3. Run: aws configure');
    process.exit(1);
  }
}

// Check if AWS SDK is installed
try {
  require('@aws-sdk/client-s3');
} catch (error) {
  console.log('📦 Installing AWS SDK...');
  require('child_process').execSync('npm install @aws-sdk/client-s3 @aws-sdk/client-iam', { stdio: 'inherit' });
}

// Run the setup
main().catch(console.error);