#!/bin/bash

# ====================================
# MCP Test Runner - Fixed Version
# ====================================

set -e

# Configuration
APP_PORT=${APP_PORT:-3003}
MCP_PORT=${MCP_PORT:-8080}
HEADLESS=${HEADLESS:-true}
DATABASE_URL="postgres://default:Lm6cG2iOHprI@ep-blue-bar-a4hj4ojg-pooler.us-east-1.aws.neon.tech/qr-workspace-test?sslmode=require"

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
BLUE='\033[0;34m'
NC='\033[0m'

# Function to print colored messages
print_info() {
  echo -e "${BLUE}ℹ️  $1${NC}"
}

print_success() {
  echo -e "${GREEN}✅ $1${NC}"
}

print_warning() {
  echo -e "${YELLOW}⚠️  $1${NC}"
}

print_error() {
  echo -e "${RED}❌ $1${NC}"
}

# Function to cleanup processes
cleanup() {
  print_info "Cleaning up processes..."
  
  # Kill processes by PID if they exist
  [ ! -z "$APP_PID" ] && kill $APP_PID 2>/dev/null || true
  [ ! -z "$MCP_PID" ] && kill $MCP_PID 2>/dev/null || true
  
  # Kill any remaining processes on ports
  lsof -ti:$APP_PORT | xargs -r kill -9 2>/dev/null || true
  lsof -ti:$MCP_PORT | xargs -r kill -9 2>/dev/null || true
  
  print_success "Cleanup complete"
}

# Set trap for cleanup
trap cleanup EXIT INT TERM

# Main execution
echo "================================================"
echo "         MCP Enhanced Test Suite"
echo "================================================"
echo ""

print_info "Configuration:"
echo "  • App Port: $APP_PORT"
echo "  • MCP Port: $MCP_PORT"
echo "  • Headless: $HEADLESS"
echo ""

# Step 1: Clean existing processes
print_info "Step 1: Cleaning existing processes..."
lsof -ti:$APP_PORT | xargs -r kill -9 2>/dev/null || true
lsof -ti:$MCP_PORT | xargs -r kill -9 2>/dev/null || true
print_success "Ports cleared"

# Step 2: Start Next.js application
print_info "Step 2: Starting Next.js application on port $APP_PORT..."
export DATABASE_URL="$DATABASE_URL"
export PORT=$APP_PORT
export NEXT_PUBLIC_APP_URL="http://localhost:$APP_PORT"

# Start the app in test mode
npm run dev:test > /tmp/nextjs-mcp.log 2>&1 &
APP_PID=$!
print_info "Next.js PID: $APP_PID"

# Wait for Next.js to be ready
print_info "Waiting for Next.js to start..."
MAX_WAIT=30
WAIT_COUNT=0
while [ $WAIT_COUNT -lt $MAX_WAIT ]; do
  if curl -s -o /dev/null -w "%{http_code}" "http://localhost:$APP_PORT" | grep -q "200\|404\|302"; then
    print_success "Next.js is ready!"
    break
  fi
  sleep 1
  WAIT_COUNT=$((WAIT_COUNT + 1))
  echo -n "."
done
echo ""

if [ $WAIT_COUNT -eq $MAX_WAIT ]; then
  print_error "Next.js failed to start within ${MAX_WAIT} seconds"
  echo "Last 50 lines of Next.js log:"
  tail -50 /tmp/nextjs-mcp.log
  exit 1
fi

# Step 3: Verify app is responding
print_info "Step 3: Verifying application health..."
HEALTH_CHECK=$(curl -s -o /dev/null -w "%{http_code}" "http://localhost:$APP_PORT")
if [ "$HEALTH_CHECK" = "200" ] || [ "$HEALTH_CHECK" = "404" ] || [ "$HEALTH_CHECK" = "302" ]; then
  print_success "Application is healthy (HTTP $HEALTH_CHECK)"
else
  print_error "Application health check failed (HTTP $HEALTH_CHECK)"
  exit 1
fi

# Step 4: Run tests based on type
print_info "Step 4: Running MCP tests..."

# Export environment for tests
export NEXT_PUBLIC_APP_URL="http://localhost:$APP_PORT"
export BASE_URL="http://localhost:$APP_PORT"
export MCP_URL="http://localhost:$MCP_PORT/sse"

# Check which test to run
TEST_TYPE=${1:-all}

case $TEST_TYPE in
  smoke)
    print_info "Running smoke tests only..."
    node tests/mcp-smoke-v2.mjs
    TEST_EXIT=$?
    ;;
  
  playwright)
    print_info "Running Playwright MCP tests..."
    npx playwright test tests/e2e/mcp-enhanced-workspace.spec.ts --config=playwright-mcp.config.ts
    TEST_EXIT=$?
    ;;
  
  all|*)
    print_info "Running all MCP tests..."
    
    # Run smoke tests first
    print_info "Phase 1: Smoke tests..."
    node tests/mcp-smoke-v2.mjs
    SMOKE_EXIT=$?
    
    if [ $SMOKE_EXIT -eq 0 ]; then
      print_success "Smoke tests passed"
      
      # Run Playwright tests
      print_info "Phase 2: Playwright MCP tests..."
      npx playwright test tests/e2e/mcp-enhanced-workspace.spec.ts --config=playwright-mcp.config.ts
      PLAYWRIGHT_EXIT=$?
      
      if [ $PLAYWRIGHT_EXIT -eq 0 ]; then
        print_success "Playwright tests passed"
        TEST_EXIT=0
      else
        print_error "Playwright tests failed"
        TEST_EXIT=$PLAYWRIGHT_EXIT
      fi
    else
      print_error "Smoke tests failed"
      TEST_EXIT=$SMOKE_EXIT
    fi
    ;;
esac

# Step 5: Generate report if Playwright tests were run
if [ "$TEST_TYPE" = "playwright" ] || [ "$TEST_TYPE" = "all" ]; then
  if [ -f "playwright-report/index.html" ]; then
    print_info "Test report available at: playwright-report/index.html"
    echo "Run 'npx playwright show-report' to view"
  fi
fi

# Final summary
echo ""
echo "================================================"
if [ $TEST_EXIT -eq 0 ]; then
  print_success "🎉 All tests passed successfully!"
else
  print_error "Some tests failed. Check the logs:"
  echo "  • Next.js log: /tmp/nextjs-mcp.log"
  echo "  • Test results: test-results/"
fi
echo "================================================"

exit $TEST_EXIT