#!/usr/bin/env node

import { spawn } from 'child_process';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Start the MCP server
console.log('🚀 Starting Playwright MCP server...');
const mcpServer = spawn('node', [
  join(__dirname, '../playwright-mcp/cli.js'),
  'server',
  '--headless=false'
], {
  stdio: 'inherit',
  env: {
    ...process.env,
    DEBUG: 'mcp:*,playwright:*'
  }
});

mcpServer.on('error', (err) => {
  console.error('Failed to start MCP server:', err);
  process.exit(1);
});

mcpServer.on('close', (code) => {
  console.log(`MCP server exited with code ${code}`);
  process.exit(code);
});

// Handle cleanup
process.on('SIGINT', () => {
  console.log('\n⏹️  Stopping MCP server...');
  mcpServer.kill();
  process.exit(0);
});

console.log('✅ MCP server is running!');
console.log('📝 You can now connect to the MCP server and run browser automation');
console.log('🔗 Server is listening for MCP connections...');