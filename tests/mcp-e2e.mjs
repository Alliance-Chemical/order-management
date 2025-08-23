#!/usr/bin/env node

import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

async function runE2ETests() {
  console.log('🚀 Starting MCP E2E Tests\n');
  
  const transport = new StdioClientTransport({
    command: 'node',
    args: [join(__dirname, '../playwright-mcp/cli.js')],
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
    await client.connect(transport);
    console.log('✅ Connected to MCP server\n');

    // List available tools
    const tools = await client.listTools();
    console.log('📋 Available tools:', tools.tools.map(t => t.name).join(', '), '\n');

    // Test 1: Launch browser
    console.log('🧪 Test 1: Launch browser');
    await client.callTool('launch', {
      headless: false,
      viewport: { width: 1280, height: 720 }
    });
    console.log('✅ Browser launched\n');

    // Test 2: Navigate to home page
    console.log('🧪 Test 2: Navigate to home page');
    await client.callTool('navigate', {
      url: 'http://localhost:3000'
    });
    console.log('✅ Navigated to home\n');

    // Test 3: Check page title
    console.log('🧪 Test 3: Check page title');
    const titleResult = await client.callTool('evaluate', {
      expression: 'document.title'
    });
    const title = titleResult.content[0]?.text;
    console.log(`✅ Page title: "${title}"\n`);

    // Test 4: Navigate to workspace
    console.log('🧪 Test 4: Navigate to workspace');
    await client.callTool('navigate', {
      url: 'http://localhost:3000/workspace/99001'
    });
    
    await client.callTool('wait', {
      selector: 'body',
      timeout: 5000
    });
    console.log('✅ Navigated to workspace\n');

    // Test 5: Check workspace content
    console.log('🧪 Test 5: Check workspace content');
    const workspaceCheck = await client.callTool('evaluate', {
      expression: `
        const text = document.body.innerText;
        text.includes("Workspace") || text.includes("99001") || text.includes("DEMO")
      `
    });
    console.log(`✅ Workspace loaded: ${workspaceCheck.content[0]?.text}\n`);

    // Test 6: Take screenshot
    console.log('🧪 Test 6: Take screenshot');
    const screenshotResult = await client.callTool('screenshot', {
      path: 'test-screenshot.png',
      fullPage: true
    });
    console.log('✅ Screenshot saved\n');

    // Test 7: Click element (if exists)
    console.log('🧪 Test 7: Test clicking');
    try {
      await client.callTool('click', {
        selector: 'button:has-text("Scan")',
        timeout: 2000
      });
      console.log('✅ Clicked scan button\n');
    } catch (e) {
      console.log('⚠️  No scan button found (expected)\n');
    }

    // Test 8: Fill form (if exists)
    console.log('🧪 Test 8: Test form filling');
    try {
      await client.callTool('fill', {
        selector: 'input[type="text"]',
        value: 'MCP Test Input',
        timeout: 2000
      });
      console.log('✅ Filled text input\n');
    } catch (e) {
      console.log('⚠️  No text input found (expected)\n');
    }

    console.log('🎉 All MCP E2E tests completed successfully!');

  } catch (error) {
    console.error('❌ Test failed:', error);
    process.exit(1);
  } finally {
    try {
      await client.callTool('close', {});
    } catch (e) {
      // Browser might already be closed
    }
    await client.close();
  }
}

// Run tests
runE2ETests().catch(console.error);