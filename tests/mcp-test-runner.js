#!/usr/bin/env node

import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { spawn } from 'child_process';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

async function runTests() {
  console.log('🔧 Starting MCP Playwright test runner...');
  
  // Start the MCP server as a subprocess
  const serverProcess = spawn('node', [
    join(__dirname, '../playwright-mcp/cli.js'),
    'server'
  ]);

  // Create MCP client
  const transport = new StdioClientTransport({
    command: 'node',
    args: [join(__dirname, '../playwright-mcp/cli.js'), 'server'],
    env: {
      ...process.env,
      BASE_URL: 'http://localhost:3000'
    }
  });

  const client = new Client(
    {
      name: 'e2e-test-runner',
      version: '1.0.0',
    },
    {
      capabilities: {
        tools: {},
      },
    }
  );

  await client.connect(transport);
  console.log('✅ Connected to MCP server');

  try {
    // List available tools
    const toolsResponse = await client.listTools();
    console.log('📋 Available tools:', toolsResponse.tools.map(t => t.name));

    // Launch browser
    console.log('\n🌐 Launching browser...');
    const launchResult = await client.callTool('launch', {
      headless: false,
      viewport: { width: 1280, height: 720 }
    });
    console.log('Browser launched:', launchResult);

    // Navigate to app
    console.log('\n📍 Navigating to app...');
    const navigateResult = await client.callTool('navigate', {
      url: 'http://localhost:3000'
    });
    console.log('Navigation result:', navigateResult);

    // Take screenshot
    console.log('\n📸 Taking screenshot...');
    const screenshotResult = await client.callTool('screenshot', {
      fullPage: true
    });
    console.log('Screenshot saved');

    // Get page title
    console.log('\n📖 Getting page title...');
    const evaluateResult = await client.callTool('evaluate', {
      expression: 'document.title'
    });
    console.log('Page title:', evaluateResult.content[0]?.text);

    // Test workspace navigation
    console.log('\n🧪 Testing workspace navigation...');
    await client.callTool('navigate', {
      url: 'http://localhost:3000/workspace/99001'
    });
    
    await client.callTool('wait', {
      selector: 'body',
      timeout: 5000
    });

    // Check if workspace loaded
    const workspaceCheck = await client.callTool('evaluate', {
      expression: 'document.body.innerText.includes("DEMO-001") || document.body.innerText.includes("Workspace")'
    });
    console.log('Workspace loaded:', workspaceCheck.content[0]?.text);

    console.log('\n✅ All MCP tests completed successfully!');

  } catch (error) {
    console.error('❌ Test failed:', error);
  } finally {
    // Close browser
    await client.callTool('close', {});
    await client.close();
    serverProcess.kill();
  }
}

// Run the tests
runTests().catch(console.error);