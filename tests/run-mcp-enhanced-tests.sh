#!/bin/bash

echo "🚀 Running MCP Enhanced Playwright Tests"
echo "========================================="

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Configuration
MCP_PORT=${MCP_PORT:-8080}
APP_PORT=${APP_PORT:-3003}
HEADLESS=${HEADLESS:-true}

# Function to check if port is in use
check_port() {
  lsof -i:$1 >/dev/null 2>&1
  return $?
}

# Function to kill process on port
kill_port() {
  echo -e "${YELLOW}Killing process on port $1...${NC}"
  lsof -ti:$1 | xargs -r kill -9 2>/dev/null
}

# Function to wait for service
wait_for_service() {
  local url=$1
  local name=$2
  local max_attempts=30
  local attempt=0
  
  echo -e "${YELLOW}Waiting for $name to be ready...${NC}"
  
  while [ $attempt -lt $max_attempts ]; do
    if curl -s -o /dev/null -w "%{http_code}" "$url" | grep -q "200\|404"; then
      echo -e "${GREEN}✓ $name is ready${NC}"
      return 0
    fi
    
    attempt=$((attempt + 1))
    sleep 1
  done
  
  echo -e "${RED}✗ $name failed to start${NC}"
  return 1
}

# Cleanup function
cleanup() {
  echo -e "\n${YELLOW}Cleaning up...${NC}"
  
  # Kill MCP server
  if [ ! -z "$MCP_PID" ]; then
    kill $MCP_PID 2>/dev/null
  fi
  
  # Kill Next.js dev server
  if [ ! -z "$APP_PID" ]; then
    kill $APP_PID 2>/dev/null
  fi
  
  # Clean up any remaining processes
  kill_port $MCP_PORT
  kill_port $APP_PORT
  
  echo -e "${GREEN}✓ Cleanup complete${NC}"
}

# Set up trap for cleanup on exit
trap cleanup EXIT INT TERM

# Step 1: Clean existing processes
echo -e "\n${YELLOW}Step 1: Cleaning existing processes${NC}"
if check_port $MCP_PORT; then
  kill_port $MCP_PORT
fi
if check_port $APP_PORT; then
  kill_port $APP_PORT
fi

# Step 2: Start Next.js app
echo -e "\n${YELLOW}Step 2: Starting Next.js app on port $APP_PORT${NC}"
PORT=$APP_PORT npm run dev:test > /tmp/nextjs-mcp.log 2>&1 &
APP_PID=$!
echo "Next.js PID: $APP_PID"

# Wait for Next.js to be ready
if ! wait_for_service "http://localhost:$APP_PORT" "Next.js app"; then
  echo -e "${RED}Failed to start Next.js app${NC}"
  echo "Check logs at /tmp/nextjs-mcp.log"
  exit 1
fi

# Step 3: Start MCP server
echo -e "\n${YELLOW}Step 3: Starting MCP server on port $MCP_PORT${NC}"

if [ "$HEADLESS" = "true" ]; then
  npx @playwright/mcp@latest --port $MCP_PORT --headless > /tmp/mcp-server.log 2>&1 &
else
  npx @playwright/mcp@latest --port $MCP_PORT > /tmp/mcp-server.log 2>&1 &
fi
MCP_PID=$!
echo "MCP Server PID: $MCP_PID"

# Wait for MCP server to be ready
sleep 5  # Give MCP server time to fully initialize
# Check if the MCP server log shows it's listening
if grep -q "Listening on http://localhost:$MCP_PORT" /tmp/mcp-server.log 2>/dev/null; then
  echo -e "${GREEN}✓ MCP server is ready${NC}"
else
  echo -e "${RED}Failed to start MCP server${NC}"
  echo "Check logs at /tmp/mcp-server.log"
  cat /tmp/mcp-server.log
  exit 1
fi

# Step 4: Run tests
echo -e "\n${YELLOW}Step 4: Running MCP enhanced tests${NC}"
echo "========================================="

# Export environment variables
export MCP_URL="http://localhost:$MCP_PORT/sse"
export NEXT_PUBLIC_APP_URL="http://localhost:$APP_PORT"
export BASE_URL="http://localhost:$APP_PORT"

# Run different test suites
echo -e "\n${YELLOW}Running smoke tests...${NC}"
node tests/mcp-smoke-v2.mjs
SMOKE_EXIT=$?

if [ $SMOKE_EXIT -eq 0 ]; then
  echo -e "${GREEN}✓ Smoke tests passed${NC}"
else
  echo -e "${RED}✗ Smoke tests failed${NC}"
fi

# Run Playwright tests with MCP
echo -e "\n${YELLOW}Running Playwright + MCP tests...${NC}"
npx playwright test --config=playwright-mcp.config.ts
PLAYWRIGHT_EXIT=$?

if [ $PLAYWRIGHT_EXIT -eq 0 ]; then
  echo -e "${GREEN}✓ Playwright tests passed${NC}"
else
  echo -e "${RED}✗ Playwright tests failed${NC}"
fi

# Step 5: Generate report
echo -e "\n${YELLOW}Step 5: Generating test report${NC}"
npx playwright show-report

# Final status
echo -e "\n========================================="
if [ $SMOKE_EXIT -eq 0 ] && [ $PLAYWRIGHT_EXIT -eq 0 ]; then
  echo -e "${GREEN}🎉 All MCP tests passed!${NC}"
  exit 0
else
  echo -e "${RED}❌ Some tests failed${NC}"
  echo "Check logs:"
  echo "  - Next.js: /tmp/nextjs-mcp.log"
  echo "  - MCP Server: /tmp/mcp-server.log"
  exit 1
fi