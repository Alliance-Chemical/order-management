#!/bin/bash

# Simple test to verify the app works without MCP server

echo "🧪 Simple App Test (No MCP Required)"
echo "===================================="

# Start the app
echo "Starting Next.js on port 3003..."
PORT=3003 npm run dev:test > /tmp/simple-test.log 2>&1 &
APP_PID=$!

# Wait for app to start
echo "Waiting for app to start..."
sleep 10

# Test the app
echo "Testing app endpoints..."

# Test home page
echo -n "Testing home page: "
STATUS=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:3003)
if [ "$STATUS" = "200" ] || [ "$STATUS" = "302" ]; then
  echo "✅ OK (HTTP $STATUS)"
else
  echo "❌ Failed (HTTP $STATUS)"
fi

# Test dashboard
echo -n "Testing dashboard: "
STATUS=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:3003/dashboard)
if [ "$STATUS" = "200" ] || [ "$STATUS" = "302" ]; then
  echo "✅ OK (HTTP $STATUS)"
else
  echo "❌ Failed (HTTP $STATUS)"
fi

# Test a workspace
echo -n "Testing workspace: "
STATUS=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:3003/workspace/99001)
if [ "$STATUS" = "200" ] || [ "$STATUS" = "404" ]; then
  echo "✅ OK (HTTP $STATUS)"
else
  echo "❌ Failed (HTTP $STATUS)"
fi

# Test API
echo -n "Testing API: "
STATUS=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:3003/api/workspace/99001)
if [ "$STATUS" = "200" ] || [ "$STATUS" = "404" ] || [ "$STATUS" = "401" ]; then
  echo "✅ OK (HTTP $STATUS)"
else
  echo "❌ Failed (HTTP $STATUS)"
fi

# Cleanup
echo ""
echo "Cleaning up..."
kill $APP_PID 2>/dev/null
lsof -ti:3003 | xargs -r kill -9 2>/dev/null

echo "✅ Simple test complete!"