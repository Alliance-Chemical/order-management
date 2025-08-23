#!/usr/bin/env node

import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { SSEClientTransport } from '@modelcontextprotocol/sdk/client/sse.js';

const MCP_URL = process.env.MCP_URL || 'http://localhost:8080/sse';
const APP_URL = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3003';

console.log('🚀 MCP Smoke Test v2');
console.log(`📡 MCP Server: ${MCP_URL}`);
console.log(`🌐 App URL: ${APP_URL}`);

async function runSmokeTest() {
  let client;
  let tabId;
  let hasErrors = false;
  
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
    
    // 3. Create a new browser tab
    console.log('\n3️⃣ Creating new browser tab...');
    const newTabResult = await client.callTool({
      name: 'browser_tab_new',
      arguments: {}
    });
    
    // Check for errors in tab creation
    const tabContent = newTabResult.content[0].text;
    if (tabContent.includes('Error:')) {
      console.error(`❌ Failed to create tab: ${tabContent}`);
      hasErrors = true;
      throw new Error('Tab creation failed');
    }
    
    tabId = tabContent;
    console.log(`✅ Created tab with ID: ${tabId}`);
    
    // 4. Navigate to the app
    console.log('\n4️⃣ Navigating to app...');
    const navResult = await client.callTool({
      name: 'browser_navigate',
      arguments: { 
        tabId, 
        url: APP_URL 
      }
    });
    
    // Check navigation result
    if (navResult.content[0].text.includes('Error:')) {
      console.error(`❌ Navigation failed: ${navResult.content[0].text}`);
      hasErrors = true;
    } else {
      console.log(`✅ Navigated to ${APP_URL}`);
    }
    
    // 5. Wait for page to load
    console.log('\n5️⃣ Waiting for page to load...');
    try {
      const waitResult = await client.callTool({
        name: 'browser_wait_for',
        arguments: { 
          tabId, 
          time: 8000  // Wait 8 seconds for page to load
        }
      });
      
      if (waitResult.content[0].text.includes('Error:')) {
        console.error(`❌ Page load failed: ${waitResult.content[0].text}`);
        hasErrors = true;
      } else {
        console.log('✅ Page loaded successfully');
      }
    } catch (waitError) {
      console.log('⚠️ Wait timed out, continuing anyway...');
      // Continue with the test even if wait times out
    }
    
    // 6. Get page title
    console.log('\n6️⃣ Getting page title...');
    const titleResult = await client.callTool({
      name: 'browser_evaluate',
      arguments: { 
        tabId, 
        function: '() => document.title'
      }
    });
    
    if (titleResult.content[0].text.includes('Error:')) {
      console.error(`❌ Failed to get title: ${titleResult.content[0].text}`);
      hasErrors = true;
    } else {
      console.log(`✅ Page title: "${titleResult.content[0].text}"`);
    }
    
    // 7. Check for app content
    console.log('\n7️⃣ Checking for app content...');
    const contentResult = await client.callTool({
      name: 'browser_evaluate',
      arguments: { 
        tabId, 
        function: '() => { const el = document.querySelector("h1, h2, main, #__next"); return el ? el.tagName + ": " + (el.textContent || "").substring(0, 50) : "No content found"; }'
      }
    });
    
    if (contentResult.content[0].text.includes('Error:')) {
      console.error(`❌ Content check failed: ${contentResult.content[0].text}`);
      hasErrors = true;
    } else {
      console.log(`✅ Found content: ${contentResult.content[0].text}`);
    }
    
    // 8. Take screenshot
    console.log('\n8️⃣ Taking screenshot...');
    const screenshotResult = await client.callTool({
      name: 'browser_take_screenshot',
      arguments: { tabId }
    });
    
    if (screenshotResult.content[0].text.includes('Error:')) {
      console.error(`❌ Screenshot failed: ${screenshotResult.content[0].text}`);
      hasErrors = true;
    } else {
      console.log('✅ Screenshot taken');
    }
    
    // 9. Close the tab
    console.log('\n9️⃣ Closing browser tab...');
    await client.callTool({
      name: 'browser_tab_close',
      arguments: { tabId }
    });
    console.log('✅ Tab closed');
    
    // Final result
    if (hasErrors) {
      console.log('\n⚠️ Smoke test completed with errors');
      process.exit(1);
    } else {
      console.log('\n🎉 Smoke test PASSED!');
      process.exit(0);
    }
    
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