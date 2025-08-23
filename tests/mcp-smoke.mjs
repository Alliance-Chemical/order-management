#!/usr/bin/env node

import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { SSEClientTransport } from '@modelcontextprotocol/sdk/client/sse.js';

const MCP_URL = process.env.MCP_URL || 'http://127.0.0.1:8080/sse';
const APP_URL = process.env.NEXT_PUBLIC_APP_URL || 'http://127.0.0.1:3000';

console.log('🚀 MCP Smoke Test');
console.log(`📡 MCP Server: ${MCP_URL}`);
console.log(`🌐 App URL: ${APP_URL}`);

async function runSmokeTest() {
  let client;
  let tabId;
  
  try {
    // 1. Connect to MCP server via SSE
    console.log('\n1️⃣ Connecting to MCP server...');
    const transport = new SSEClientTransport(new URL(MCP_URL));
    
    client = new Client({
      name: 'mcp-smoke-test',
      version: '1.0.0'
    }, {
      capabilities: {}
    });
    
    await client.connect(transport);
    console.log('✅ Connected to MCP server');
    
    // 2. List available tools (sanity check)
    console.log('\n2️⃣ Listing available tools...');
    const tools = await client.listTools();
    console.log(`✅ Found ${tools.tools.length} tools`);
    
    // Verify browser tools are available
    const browserTools = tools.tools.filter(t => t.name.startsWith('browser_'));
    if (browserTools.length === 0) {
      throw new Error('No browser tools found - is MCP server running with browser support?');
    }
    console.log(`✅ Browser tools available: ${browserTools.map(t => t.name).join(', ')}`);
    
    // 3. Create a new browser tab FIRST
    console.log('\n3️⃣ Creating new browser tab...');
    const newTabResult = await client.callTool({
      name: 'browser_tab_new',
      arguments: { 
        headless: process.env.HEADLESS !== 'false' // default to headless
      }
    });
    
    tabId = newTabResult.content[0].text;
    console.log(`✅ Created tab with ID: ${tabId}`);
    
    // 4. Navigate to the app
    console.log('\n4️⃣ Navigating to app...');
    await client.callTool({
      name: 'browser_navigate',
      arguments: { 
        tabId, 
        url: APP_URL 
      }
    });
    console.log(`✅ Navigated to ${APP_URL}`);
    
    // 5. Wait for page to load
    console.log('\n5️⃣ Waiting for page to load...');
    await client.callTool({
      name: 'browser_wait_for',
      arguments: { 
        tabId, 
        selector: 'body', 
        state: 'visible', 
        timeout: 30000 
      }
    });
    console.log('✅ Page loaded successfully');
    
    // 6. Check for a specific element (adjust selector as needed)
    console.log('\n6️⃣ Checking for app content...');
    const contentResult = await client.callTool({
      name: 'browser_evaluate',
      arguments: { 
        tabId, 
        function: 'document.querySelector("h1, h2, [data-testid=\\"app-title\\"], .workspace-header")?.textContent || "No header found"'
      }
    });
    
    if (contentResult.content && contentResult.content.length > 0) {
      const text = contentResult.content[0].text;
      console.log(`✅ Found content: "${text}"`);
    } else {
      console.log('⚠️ No specific content found, but page loaded');
    }
    
    // 7. Close the tab
    console.log('\n7️⃣ Closing browser tab...');
    await client.callTool({
      name: 'browser_tab_close',
      arguments: { tabId }
    });
    console.log('✅ Tab closed');
    
    console.log('\n🎉 Smoke test PASSED!');
    process.exit(0);
    
  } catch (error) {
    console.error('\n❌ Smoke test FAILED:', error.message);
    
    // Try to clean up tab if it exists
    if (tabId && client) {
      try {
        await client.callTool({
          name: 'browser_tab_close',
          arguments: { tabId }
        });
      } catch (e) {
        // Ignore cleanup errors
      }
    }
    
    process.exit(1);
  } finally {
    // Disconnect client
    if (client) {
      try {
        await client.close();
      } catch (e) {
        // Ignore disconnect errors
      }
    }
  }
}

// Run the test
runSmokeTest().catch(error => {
  console.error('Unhandled error:', error);
  process.exit(1);
});