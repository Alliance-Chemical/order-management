# Terraform configuration for AWS S3 buckets
# Run: terraform init && terraform apply

terraform {
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
  }
}

provider "aws" {
  region = var.aws_region
}

variable "aws_region" {
  description = "AWS region for resources"
  default     = "us-east-2"
}

# S3 Bucket for Documents
resource "aws_s3_bucket" "documents" {
  bucket = "alliance-chemical-documents"
  
  tags = {
    Name        = "Alliance Chemical Documents"
    Environment = "Production"
    Purpose     = "Document Storage"
  }
}

# S3 Bucket for QR Docs
resource "aws_s3_bucket" "qr_docs" {
  bucket = "ac-qrdocs-prod"
  
  tags = {
    Name        = "Alliance Chemical QR Docs"
    Environment = "Production"
    Purpose     = "QR Code Documents"
  }
}

# Enable versioning on documents bucket
resource "aws_s3_bucket_versioning" "documents_versioning" {
  bucket = aws_s3_bucket.documents.id
  
  versioning_configuration {
    status = "Enabled"
  }
}

# Lifecycle rules for QR docs bucket
resource "aws_s3_bucket_lifecycle_configuration" "qr_docs_lifecycle" {
  bucket = aws_s3_bucket.qr_docs.id
  
  rule {
    id     = "archive-old-orders"
    status = "Enabled"
    
    transition {
      days          = 90
      storage_class = "STANDARD_IA"
    }
    
    transition {
      days          = 365
      storage_class = "GLACIER"
    }
  }
}

# CORS configuration for both buckets
resource "aws_s3_bucket_cors_configuration" "documents_cors" {
  bucket = aws_s3_bucket.documents.id
  
  cors_rule {
    allowed_headers = ["*"]
    allowed_methods = ["GET", "PUT", "POST", "DELETE", "HEAD"]
    allowed_origins = ["*"]
    expose_headers  = ["ETag"]
    max_age_seconds = 3000
  }
}

resource "aws_s3_bucket_cors_configuration" "qr_docs_cors" {
  bucket = aws_s3_bucket.qr_docs.id
  
  cors_rule {
    allowed_headers = ["*"]
    allowed_methods = ["GET", "PUT", "POST", "DELETE", "HEAD"]
    allowed_origins = ["*"]
    expose_headers  = ["ETag"]
    max_age_seconds = 3000
  }
}

# Block public access for security
resource "aws_s3_bucket_public_access_block" "documents_pab" {
  bucket = aws_s3_bucket.documents.id
  
  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}

resource "aws_s3_bucket_public_access_block" "qr_docs_pab" {
  bucket = aws_s3_bucket.qr_docs.id
  
  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}

# IAM User for application access
resource "aws_iam_user" "app_user" {
  name = "alliance-chemical-app"
  
  tags = {
    Purpose = "Vercel App Access"
  }
}

# IAM Policy for S3 access
resource "aws_iam_policy" "s3_access" {
  name        = "alliance-chemical-s3-access"
  description = "Policy for Alliance Chemical app to access S3 buckets"
  
  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Action = [
          "s3:GetObject",
          "s3:PutObject",
          "s3:DeleteObject",
          "s3:ListBucket",
          "s3:GetObjectVersion"
        ]
        Resource = [
          aws_s3_bucket.documents.arn,
          "${aws_s3_bucket.documents.arn}/*",
          aws_s3_bucket.qr_docs.arn,
          "${aws_s3_bucket.qr_docs.arn}/*"
        ]
      }
    ]
  })
}

# Attach policy to user
resource "aws_iam_user_policy_attachment" "app_user_policy" {
  user       = aws_iam_user.app_user.name
  policy_arn = aws_iam_policy.s3_access.arn
}

# Create access key for the user
resource "aws_iam_access_key" "app_key" {
  user = aws_iam_user.app_user.name
}

# Output the important values
output "aws_region" {
  value = var.aws_region
}

output "documents_bucket" {
  value = aws_s3_bucket.documents.id
}

output "qr_docs_bucket" {
  value = aws_s3_bucket.qr_docs.id
}

output "access_key_id" {
  value     = aws_iam_access_key.app_key.id
  sensitive = true
}

output "secret_access_key" {
  value     = aws_iam_access_key.app_key.secret
  sensitive = true
}

output "environment_variables" {
  value = <<-EOT
    Add these to your .env.local or Vercel:
    
    AWS_REGION=${var.aws_region}
    AWS_ACCESS_KEY_ID=${aws_iam_access_key.app_key.id}
    AWS_SECRET_ACCESS_KEY=${aws_iam_access_key.app_key.secret}
    S3_DOCUMENTS_BUCKET=${aws_s3_bucket.documents.id}
    S3_BUCKET_NAME=${aws_s3_bucket.qr_docs.id}
  EOT
  sensitive = true
}