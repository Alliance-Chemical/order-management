#!/bin/bash

# AWS S3 Bucket Setup Script
# This script creates the necessary S3 buckets for the application

set -e

echo "🚀 Setting up AWS S3 buckets for Alliance Chemical Order Management"
echo "=================================================="

# Check if AWS CLI is installed
if ! command -v aws &> /dev/null; then
    echo "❌ AWS CLI is not installed. Please install it first:"
    echo "   curl 'https://awscli.amazonaws.com/awscli-exe-linux-x86_64.zip' -o 'awscliv2.zip'"
    echo "   unzip awscliv2.zip"
    echo "   sudo ./aws/install"
    exit 1
fi

# Set AWS region
AWS_REGION=${AWS_REGION:-"us-east-2"}
echo "📍 Using AWS Region: $AWS_REGION"

# Bucket names
DOCUMENTS_BUCKET="alliance-chemical-documents"
QR_DOCS_BUCKET="ac-qrdocs-prod"

echo ""
echo "📦 Creating S3 Buckets..."
echo "------------------------"

# Create documents bucket
echo "1️⃣ Creating bucket: $DOCUMENTS_BUCKET"
if aws s3api head-bucket --bucket "$DOCUMENTS_BUCKET" 2>/dev/null; then
    echo "   ✅ Bucket already exists"
else
    aws s3api create-bucket \
        --bucket "$DOCUMENTS_BUCKET" \
        --region "$AWS_REGION" \
        --create-bucket-configuration LocationConstraint="$AWS_REGION" 2>/dev/null || true
    echo "   ✅ Bucket created"
fi

# Create QR docs bucket
echo "2️⃣ Creating bucket: $QR_DOCS_BUCKET"
if aws s3api head-bucket --bucket "$QR_DOCS_BUCKET" 2>/dev/null; then
    echo "   ✅ Bucket already exists"
else
    aws s3api create-bucket \
        --bucket "$QR_DOCS_BUCKET" \
        --region "$AWS_REGION" \
        --create-bucket-configuration LocationConstraint="$AWS_REGION" 2>/dev/null || true
    echo "   ✅ Bucket created"
fi

# Configure bucket policies
echo ""
echo "🔒 Configuring bucket policies..."
echo "--------------------------------"

# Enable versioning on documents bucket
echo "Enabling versioning on $DOCUMENTS_BUCKET..."
aws s3api put-bucket-versioning \
    --bucket "$DOCUMENTS_BUCKET" \
    --versioning-configuration Status=Enabled

# Set lifecycle policy for QR docs (archive old files)
echo "Setting lifecycle policy on $QR_DOCS_BUCKET..."
cat > /tmp/lifecycle.json << 'EOF'
{
    "Rules": [
        {
            "Id": "ArchiveOldOrders",
            "Status": "Enabled",
            "Transitions": [
                {
                    "Days": 90,
                    "StorageClass": "STANDARD_IA"
                },
                {
                    "Days": 365,
                    "StorageClass": "GLACIER"
                }
            ]
        }
    ]
}
EOF

aws s3api put-bucket-lifecycle-configuration \
    --bucket "$QR_DOCS_BUCKET" \
    --lifecycle-configuration file:///tmp/lifecycle.json

# Configure CORS for browser uploads
echo "Configuring CORS..."
cat > /tmp/cors.json << 'EOF'
{
    "CORSRules": [
        {
            "AllowedHeaders": ["*"],
            "AllowedMethods": ["GET", "PUT", "POST", "DELETE", "HEAD"],
            "AllowedOrigins": ["*"],
            "ExposeHeaders": ["ETag"],
            "MaxAgeSeconds": 3000
        }
    ]
}
EOF

aws s3api put-bucket-cors \
    --bucket "$DOCUMENTS_BUCKET" \
    --cors-configuration file:///tmp/cors.json

aws s3api put-bucket-cors \
    --bucket "$QR_DOCS_BUCKET" \
    --cors-configuration file:///tmp/cors.json

# Block public access (security best practice)
echo "Configuring security settings..."
for bucket in "$DOCUMENTS_BUCKET" "$QR_DOCS_BUCKET"; do
    aws s3api put-public-access-block \
        --bucket "$bucket" \
        --public-access-block-configuration \
        "BlockPublicAcls=true,IgnorePublicAcls=true,BlockPublicPolicy=true,RestrictPublicBuckets=true"
done

# Clean up temp files
rm -f /tmp/lifecycle.json /tmp/cors.json

echo ""
echo "✅ S3 Buckets created successfully!"
echo ""
echo "📝 Add these to your .env.local or Vercel environment variables:"
echo "=================================================="
echo "AWS_REGION=$AWS_REGION"
echo "S3_DOCUMENTS_BUCKET=$DOCUMENTS_BUCKET"
echo "S3_BUCKET_NAME=$QR_DOCS_BUCKET"
echo ""
echo "🔑 You'll also need AWS credentials:"
echo "AWS_ACCESS_KEY_ID=your-access-key"
echo "AWS_SECRET_ACCESS_KEY=your-secret-key"
echo ""
echo "💡 To create AWS credentials:"
echo "1. Go to AWS IAM Console"
echo "2. Create a new user or use existing"
echo "3. Attach 'AmazonS3FullAccess' policy"
echo "4. Create access keys"
echo ""
echo "🎉 Setup complete!"