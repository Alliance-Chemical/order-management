#!/bin/bash

echo "🔧 Running Fixed MCP Tests"
echo "=========================="

# Configuration
APP_PORT=3003
MCP_PORT=8080

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

# Check if processes are already running
echo -e "${YELLOW}Checking for existing processes...${NC}"
lsof -ti:$APP_PORT | xargs -r kill -9 2>/dev/null
lsof -ti:$MCP_PORT | xargs -r kill -9 2>/dev/null

# Start Next.js dev server
echo -e "${YELLOW}Starting Next.js on port $APP_PORT...${NC}"
PORT=$APP_PORT npm run dev:test &
APP_PID=$!

# Wait for Next.js to be ready
echo -e "${YELLOW}Waiting for Next.js to start...${NC}"
sleep 5

# Check if Next.js is running
if curl -s -o /dev/null -w "%{http_code}" "http://localhost:$APP_PORT" | grep -q "200\|404"; then
  echo -e "${GREEN}✓ Next.js is running${NC}"
else
  echo -e "${RED}✗ Next.js failed to start${NC}"
  kill $APP_PID 2>/dev/null
  exit 1
fi

# Set environment variables
export NEXT_PUBLIC_APP_URL="http://localhost:$APP_PORT"
export DATABASE_URL="postgres://default:Lm6cG2iOHprI@ep-blue-bar-a4hj4ojg-pooler.us-east-1.aws.neon.tech/qr-workspace-test?sslmode=require"

# Run Playwright tests with MCP config
echo -e "${YELLOW}Running MCP Playwright tests...${NC}"
npx playwright test tests/e2e/mcp-enhanced-workspace.spec.ts --config=playwright-mcp.config.ts

TEST_EXIT=$?

# Cleanup
echo -e "${YELLOW}Cleaning up...${NC}"
kill $APP_PID 2>/dev/null
lsof -ti:$APP_PORT | xargs -r kill -9 2>/dev/null
lsof -ti:$MCP_PORT | xargs -r kill -9 2>/dev/null

# Report results
if [ $TEST_EXIT -eq 0 ]; then
  echo -e "${GREEN}✅ Tests passed!${NC}"
else
  echo -e "${RED}❌ Tests failed${NC}"
fi

exit $TEST_EXIT