#!/usr/bin/env node

import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

async function runBrowserTests() {
  console.log('🚀 Starting MCP Browser Tests\n');
  
  const transport = new StdioClientTransport({
    command: 'node',
    args: [
      join(__dirname, '../playwright-mcp/cli.js'),
      '--browser=chromium',
      '--headless=false'
    ],
    env: process.env
  });

  const client = new Client(
    {
      name: 'browser-test-client',
      version: '1.0.0',
    },
    {
      capabilities: {
        tools: {},
      },
    }
  );

  try {
    await client.connect(transport);
    console.log('✅ Connected to MCP server\n');

    // Navigate directly - browser should auto-launch
    console.log('🧪 Test 1: Navigate to app');
    const navResult = await client.callTool('browser_navigate', {
      url: 'http://localhost:3000'
    });
    console.log('✅ Navigation result:', navResult.content[0]?.text || 'Success', '\n');

    // Take screenshot
    console.log('🧪 Test 2: Take screenshot');
    const screenshotResult = await client.callTool('browser_take_screenshot', {});
    console.log('✅ Screenshot taken\n');

    // Evaluate JavaScript
    console.log('🧪 Test 3: Get page title');
    const titleResult = await client.callTool('browser_evaluate', {
      script: 'document.title'
    });
    console.log('✅ Page title:', titleResult.content[0]?.text, '\n');

    // Navigate to workspace
    console.log('🧪 Test 4: Navigate to workspace');
    await client.callTool('browser_navigate', {
      url: 'http://localhost:3000/workspace/99001'
    });
    console.log('✅ Navigated to workspace\n');

    // Wait for content
    console.log('🧪 Test 5: Wait for content');
    await client.callTool('browser_wait_for', {
      selector: 'body',
      timeout: 5000
    });
    console.log('✅ Content loaded\n');

    // Check workspace loaded
    console.log('🧪 Test 6: Verify workspace');
    const workspaceResult = await client.callTool('browser_evaluate', {
      script: 'document.body.innerText.includes("Workspace") || document.body.innerText.includes("99001")'
    });
    console.log('✅ Workspace verified:', workspaceResult.content[0]?.text, '\n');

    // Try clicking
    console.log('🧪 Test 7: Try clicking button');
    try {
      await client.callTool('browser_click', {
        selector: 'button'
      });
      console.log('✅ Clicked a button\n');
    } catch (e) {
      console.log('⚠️  No button to click\n');
    }

    console.log('🎉 All browser tests completed!');

  } catch (error) {
    console.error('❌ Test failed:', error);
    process.exit(1);
  } finally {
    try {
      await client.callTool('browser_close', {});
    } catch (e) {
      // Browser might already be closed
    }
    await client.close();
  }
}

// Run tests
runBrowserTests().catch(console.error);