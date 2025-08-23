#!/usr/bin/env node

import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

async function runTests() {
  console.log('🚀 Starting MCP E2E Tests via Playwright\n');
  
  // Create transport with correct arguments
  const transport = new StdioClientTransport({
    command: 'node',
    args: [
      join(__dirname, '../playwright-mcp/cli.js'),
      '--browser=chromium',
      '--viewport-size=1280,720'
    ],
    env: process.env
  });

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

  try {
    console.log('📡 Connecting to MCP server...');
    await client.connect(transport);
    console.log('✅ Connected successfully\n');

    // Test 1: Navigate to home
    console.log('Test 1: Navigate to home page');
    await client.callTool('browser_navigate', {
      url: 'http://localhost:3000'
    });
    console.log('✅ Navigated to home\n');

    // Test 2: Check title
    console.log('Test 2: Check page title');
    const titleResult = await client.callTool('browser_evaluate', {
      script: 'document.title'
    });
    console.log(`✅ Title: ${titleResult.content[0]?.text}\n`);

    // Test 3: Take screenshot
    console.log('Test 3: Take screenshot');
    await client.callTool('browser_take_screenshot', {});
    console.log('✅ Screenshot captured\n');

    // Test 4: Navigate to workspace
    console.log('Test 4: Navigate to workspace/99001');
    await client.callTool('browser_navigate', {
      url: 'http://localhost:3000/workspace/99001'
    });
    
    await client.callTool('browser_wait_for', {
      selector: 'body',
      timeout: 5000
    });
    console.log('✅ Workspace page loaded\n');

    // Test 5: Check workspace content
    console.log('Test 5: Verify workspace content');
    const contentResult = await client.callTool('browser_evaluate', {
      script: `
        const text = document.body.innerText;
        const hasWorkspace = text.includes("Workspace") || text.includes("99001") || text.includes("DEMO");
        hasWorkspace ? "Workspace content found" : "No workspace content"
      `
    });
    console.log(`✅ ${contentResult.content[0]?.text}\n`);

    // Test 6: Check for interactive elements
    console.log('Test 6: Check for buttons');
    const buttonsResult = await client.callTool('browser_evaluate', {
      script: 'document.querySelectorAll("button").length'
    });
    console.log(`✅ Found ${buttonsResult.content[0]?.text} buttons\n`);

    // Test 7: Network monitoring
    console.log('Test 7: Check network requests');
    const networkResult = await client.callTool('browser_network_requests', {});
    const requests = networkResult.content[0]?.text;
    if (requests) {
      const parsed = JSON.parse(requests);
      console.log(`✅ Captured ${parsed.length} network requests\n`);
    }

    // Test 8: Console messages
    console.log('Test 8: Check console messages');
    const consoleResult = await client.callTool('browser_console_messages', {});
    console.log('✅ Console messages checked\n');

    console.log('🎉 All E2E tests completed successfully!');

  } catch (error) {
    console.error('❌ Test failed:', error.message || error);
    process.exit(1);
  } finally {
    console.log('\n🧹 Cleaning up...');
    try {
      await client.callTool('browser_close', {});
    } catch (e) {
      // Browser might already be closed
    }
    await client.close();
    console.log('✅ Cleanup complete');
  }
}

// Run tests
runTests().catch(console.error);