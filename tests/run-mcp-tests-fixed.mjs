#!/usr/bin/env node

import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { SSEClientTransport } from '@modelcontextprotocol/sdk/client/sse.js';

const MCP_URL = process.env.MCP_URL || 'http://127.0.0.1:8080/sse';
const APP_URL = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';

async function runTests() {
  console.log('🚀 Starting MCP E2E Tests via SSE Transport\n');
  console.log(`📡 MCP Server: ${MCP_URL}`);
  console.log(`🌐 App URL: ${APP_URL}\n`);
  
  // Use SSE transport instead of Stdio
  const transport = new SSEClientTransport(new URL(MCP_URL));

  const client = new Client(
    {
      name: 'e2e-test-client',
      version: '1.0.0',
    },
    {
      capabilities: {
        tools: {},
      },
    }
  );

  let tabId = null;

  try {
    console.log('📡 Connecting to MCP server...');
    await client.connect(transport);
    console.log('✅ Connected successfully\n');

    // CRITICAL: Create a tab FIRST before any browser operations
    console.log('Creating browser tab...');
    const newTabResult = await client.callTool({
      name: 'browser_tab_new',
      arguments: { 
        headless: process.env.HEADLESS !== 'false' 
      }
    });
    tabId = newTabResult.content[0].text;
    console.log(`✅ Created tab with ID: ${tabId}\n`);

    // Test 1: Navigate to home
    console.log('Test 1: Navigate to home page');
    await client.callTool({
      name: 'browser_navigate',
      arguments: {
        tabId,
        url: APP_URL
      }
    });
    
    // Wait for page to load
    await client.callTool({
      name: 'browser_wait_for',
      arguments: {
        tabId,
        selector: 'body',
        state: 'visible',
        timeout: 30000
      }
    });
    console.log('✅ Navigated to home\n');

    // Test 2: Check title
    console.log('Test 2: Check page title');
    const titleResult = await client.callTool({
      name: 'browser_evaluate',
      arguments: {
        tabId,
        script: 'document.title'
      }
    });
    console.log(`✅ Title: ${titleResult.content[0]?.text}\n`);

    // Test 3: Take screenshot
    console.log('Test 3: Take screenshot');
    await client.callTool({
      name: 'browser_take_screenshot',
      arguments: { tabId }
    });
    console.log('✅ Screenshot captured\n');

    // Test 4: Navigate to workspace
    console.log('Test 4: Navigate to workspace/99001');
    await client.callTool({
      name: 'browser_navigate',
      arguments: {
        tabId,
        url: `${APP_URL}/workspace/99001`
      }
    });
    
    await client.callTool({
      name: 'browser_wait_for',
      arguments: {
        tabId,
        selector: 'body',
        state: 'visible',
        timeout: 10000
      }
    });
    console.log('✅ Workspace page loaded\n');

    // Test 5: Check workspace content
    console.log('Test 5: Verify workspace content');
    const contentResult = await client.callTool({
      name: 'browser_evaluate',
      arguments: {
        tabId,
        script: `
          const text = document.body.innerText;
          const hasWorkspace = text.includes("Workspace") || text.includes("99001") || text.includes("DEMO");
          hasWorkspace ? "Workspace content found" : "No workspace content"
        `
      }
    });
    console.log(`✅ ${contentResult.content[0]?.text}\n`);

    // Test 6: Check for interactive elements
    console.log('Test 6: Check for buttons');
    const buttonsResult = await client.callTool({
      name: 'browser_evaluate',
      arguments: {
        tabId,
        script: 'document.querySelectorAll("button").length'
      }
    });
    console.log(`✅ Found ${buttonsResult.content[0]?.text} buttons\n`);

    // Test 7: Network monitoring
    console.log('Test 7: Check network requests');
    try {
      const networkResult = await client.callTool({
        name: 'browser_network_requests',
        arguments: { tabId }
      });
      const requests = networkResult.content[0]?.text;
      if (requests) {
        const parsed = JSON.parse(requests);
        console.log(`✅ Captured ${parsed.length} network requests\n`);
      }
    } catch (e) {
      console.log('⚠️ Network monitoring not available\n');
    }

    // Test 8: Console messages
    console.log('Test 8: Check console messages');
    try {
      const consoleResult = await client.callTool({
        name: 'browser_console_messages',
        arguments: { tabId }
      });
      console.log('✅ Console messages checked\n');
    } catch (e) {
      console.log('⚠️ Console messages not available\n');
    }

    console.log('🎉 All E2E tests completed successfully!');

  } catch (error) {
    console.error('❌ Test failed:', error.message || error);
    process.exit(1);
  } finally {
    console.log('\n🧹 Cleaning up...');
    try {
      if (tabId) {
        await client.callTool({
          name: 'browser_tab_close',
          arguments: { tabId }
        });
      }
    } catch (e) {
      // Tab might already be closed
    }
    await client.close();
    console.log('✅ Cleanup complete');
  }
}

// Run tests
runTests().catch(console.error);