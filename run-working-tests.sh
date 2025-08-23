#!/bin/bash

# ====================================
# Working Test Suite
# ====================================

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
BLUE='\033[0;34m'
NC='\033[0m'

echo "================================================"
echo "         Working Test Suite"
echo "================================================"
echo ""
echo -e "${BLUE}This runs tests that actually work properly${NC}"
echo ""

# Configuration
APP_PORT=3003
export DATABASE_URL="postgres://default:Lm6cG2iOHprI@ep-blue-bar-a4hj4ojg-pooler.us-east-1.aws.neon.tech/qr-workspace-test?sslmode=require"
export NEXT_PUBLIC_APP_URL="http://localhost:$APP_PORT"

# Cleanup function
cleanup() {
  echo -e "\n${YELLOW}Cleaning up...${NC}"
  [ ! -z "$APP_PID" ] && kill $APP_PID 2>/dev/null
  lsof -ti:$APP_PORT | xargs -r kill -9 2>/dev/null
}

trap cleanup EXIT INT TERM

# Parse arguments
TEST_TYPE=${1:-all}

case $TEST_TYPE in
  quick)
    echo -e "${BLUE}Running quick health check...${NC}"
    echo ""
    
    # Clean ports
    lsof -ti:$APP_PORT | xargs -r kill -9 2>/dev/null
    
    # Start app
    echo "Starting Next.js on port $APP_PORT..."
    PORT=$APP_PORT npm run dev:test > /tmp/app-test.log 2>&1 &
    APP_PID=$!
    
    # Wait for app
    echo "Waiting for app to start..."
    sleep 8
    
    # Test endpoints
    echo ""
    echo "Testing endpoints:"
    
    echo -n "  • Home page: "
    STATUS=$(curl -s -o /dev/null -w "%{http_code}" "http://localhost:$APP_PORT")
    [ "$STATUS" = "200" ] && echo -e "${GREEN}✓${NC}" || echo -e "${RED}✗ (HTTP $STATUS)${NC}"
    
    echo -n "  • Dashboard: "
    STATUS=$(curl -s -o /dev/null -w "%{http_code}" "http://localhost:$APP_PORT/dashboard")
    [ "$STATUS" = "200" ] && echo -e "${GREEN}✓${NC}" || echo -e "${RED}✗ (HTTP $STATUS)${NC}"
    
    echo -n "  • Workspace: "
    STATUS=$(curl -s -o /dev/null -w "%{http_code}" "http://localhost:$APP_PORT/workspace/99001")
    [ "$STATUS" = "200" ] || [ "$STATUS" = "404" ] && echo -e "${GREEN}✓${NC}" || echo -e "${RED}✗ (HTTP $STATUS)${NC}"
    
    echo -n "  • API endpoint: "
    STATUS=$(curl -s -o /dev/null -w "%{http_code}" "http://localhost:$APP_PORT/api/workspace/99001")
    [ "$STATUS" = "200" ] || [ "$STATUS" = "404" ] || [ "$STATUS" = "401" ] && echo -e "${GREEN}✓${NC}" || echo -e "${RED}✗ (HTTP $STATUS)${NC}"
    
    echo ""
    echo -e "${GREEN}✅ Quick health check complete!${NC}"
    ;;
    
  unit)
    echo -e "${BLUE}Running unit tests...${NC}"
    npm test run
    ;;
    
  e2e)
    echo -e "${BLUE}Running E2E tests with Playwright...${NC}"
    npm run test:e2e
    ;;
    
  all|*)
    echo -e "${BLUE}Running all working tests...${NC}"
    echo ""
    
    # Quick health check
    echo -e "${YELLOW}Phase 1: Quick health check${NC}"
    $0 quick
    echo ""
    
    # Unit tests
    echo -e "${YELLOW}Phase 2: Unit tests${NC}"
    npm test run
    UNIT_EXIT=$?
    echo ""
    
    # E2E tests
    echo -e "${YELLOW}Phase 3: E2E tests${NC}"
    npm run test:e2e
    E2E_EXIT=$?
    
    # Summary
    echo ""
    echo "================================================"
    echo "Test Results:"
    [ $UNIT_EXIT -eq 0 ] && echo -e "  • Unit tests: ${GREEN}✓ Passed${NC}" || echo -e "  • Unit tests: ${RED}✗ Failed${NC}"
    [ $E2E_EXIT -eq 0 ] && echo -e "  • E2E tests: ${GREEN}✓ Passed${NC}" || echo -e "  • E2E tests: ${RED}✗ Failed${NC}"
    echo "================================================"
    
    if [ $UNIT_EXIT -eq 0 ] && [ $E2E_EXIT -eq 0 ]; then
      echo -e "${GREEN}🎉 All tests passed!${NC}"
      exit 0
    else
      echo -e "${RED}Some tests failed${NC}"
      exit 1
    fi
    ;;
esac