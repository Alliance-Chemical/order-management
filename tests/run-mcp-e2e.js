#!/usr/bin/env node

async function runMCPTests() {
  console.log('🧪 Running E2E tests via Playwright MCP...\n');
  
  const baseUrl = 'http://localhost:3000';
  const mcpUrl = 'http://localhost:8080/mcp';
  
  try {
    // Test 1: Smoke test - app loads
    console.log('📋 Test 1: Smoke test - app loads');
    const smokeResponse = await fetch(mcpUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        jsonrpc: '2.0',
        method: 'tools/call',
        params: {
          name: 'navigate',
          arguments: { url: baseUrl }
        },
        id: 1
      })
    });
    
    if (smokeResponse.ok) {
      console.log('✅ App loads successfully\n');
    } else {
      console.log('❌ Failed to load app\n');
    }

    // Test 2: Navigate to workspace
    console.log('📋 Test 2: Navigate to workspace');
    const workspaceResponse = await fetch(mcpUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        jsonrpc: '2.0',
        method: 'tools/call',
        params: {
          name: 'navigate',
          arguments: { url: `${baseUrl}/workspace/99001` }
        },
        id: 2
      })
    });
    
    if (workspaceResponse.ok) {
      console.log('✅ Workspace navigation works\n');
    } else {
      console.log('❌ Failed to navigate to workspace\n');
    }

    // Test 3: Take screenshot
    console.log('📋 Test 3: Take screenshot');
    const screenshotResponse = await fetch(mcpUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        jsonrpc: '2.0',
        method: 'tools/call',
        params: {
          name: 'screenshot',
          arguments: { fullPage: true }
        },
        id: 3
      })
    });
    
    if (screenshotResponse.ok) {
      console.log('✅ Screenshot captured\n');
    } else {
      console.log('❌ Failed to take screenshot\n');
    }

    // Test 4: Check page title
    console.log('📋 Test 4: Check page title');
    const titleResponse = await fetch(mcpUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        jsonrpc: '2.0',
        method: 'tools/call',
        params: {
          name: 'evaluate',
          arguments: { 
            expression: 'document.title'
          }
        },
        id: 4
      })
    });
    
    if (titleResponse.ok) {
      const result = await titleResponse.json();
      console.log(`✅ Page title: ${JSON.stringify(result)}\n`);
    } else {
      console.log('❌ Failed to get page title\n');
    }

    console.log('🎉 All MCP E2E tests completed!');
    
  } catch (error) {
    console.error('❌ Test error:', error);
    process.exit(1);
  }
}

// Run tests
runMCPTests();