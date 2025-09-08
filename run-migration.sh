#!/bin/bash

# Simple runner for RAG migration
# Reads URLs from environment

DEV_URL="postgres://default:Lm6cG2iOHprI@ep-blue-bar-a4hj4ojg-pooler.us-east-1.aws.neon.tech/qr-workspace-test?sslmode=require"
PROD_URL="postgres://default:Lm6cG2iOHprI@ep-blue-bar-a4hj4ojg-pooler.us-east-1.aws.neon.tech/verceldb?sslmode=require"

# Check if offset is provided as first argument
OFFSET="${1:-3294}"

echo "Starting migration from offset $OFFSET..."
echo "DEV: qr-workspace-test"
echo "PROD: verceldb"
echo ""

# Run the migration
node scripts/migrate-rag-batch.js "$DEV_URL" "$PROD_URL" --offset=$OFFSET