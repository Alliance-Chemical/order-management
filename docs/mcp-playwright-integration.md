# MCP-Enhanced Playwright Testing

## Overview

This enhanced testing framework combines Playwright's robust testing capabilities with MCP (Model Context Protocol) for advanced browser automation and testing scenarios.

## Key Features

- **Dual Control**: Run tests using both Playwright and MCP simultaneously
- **Enhanced Debugging**: MCP provides additional browser introspection capabilities
- **Performance Monitoring**: Built-in performance metrics collection
- **Resilient Testing**: Automatic retries and error recovery
- **Offline Simulation**: Test offline scenarios and queue behavior
- **Console Error Tracking**: Automatic capture of browser errors

## Quick Start

### 1. Run All MCP Tests
```bash
npm run test:mcp
```

### 2. Run MCP Smoke Tests Only
```bash
npm run test:mcp:smoke
```

### 3. Run Tests with Visible Browser
```bash
npm run test:mcp:headed
```

### 4. Start MCP Server Manually
```bash
npm run mcp:server
# or with visible browser
npm run mcp:server:headed
```

## File Structure

```
tests/
├── mcp-playwright-integration.ts   # Core integration framework
├── helpers/
│   └── mcp-test-utils.ts          # MCP utility functions
├── e2e/
│   └── mcp-enhanced-workspace.spec.ts  # Example test suite
├── run-mcp-enhanced-tests.sh      # Test runner script
└── mcp-smoke-v2.mjs               # Standalone smoke test
```

## Writing MCP-Enhanced Tests

### Basic Test Structure

```typescript
import { test, expect, createMCPBrowser } from '../mcp-playwright-integration'

test('your test name', async ({ page, mcpClient, mcpTabId }) => {
  // Create MCP browser helper
  const mcpBrowser = await createMCPBrowser(mcpClient, mcpTabId)
  
  // Use MCP for navigation
  await mcpBrowser.navigate('http://localhost:3000')
  
  // Use MCP for interactions
  await mcpBrowser.click('button.primary')
  
  // Use Playwright for assertions
  await expect(page.locator('h1')).toContainText('Dashboard')
})
```

### Available MCP Methods

- `navigate(url)` - Navigate to URL
- `click(selector)` - Click element
- `type(selector, text)` - Type text
- `evaluate(code)` - Execute JavaScript
- `waitFor(selector, timeout)` - Wait for element
- `screenshot(options)` - Take screenshot
- `getState()` - Get browser state

### Utility Functions

```typescript
import { MCPTestUtils, MCPAssertions } from '../helpers/mcp-test-utils'

// Wait for condition
await MCPTestUtils.waitForCondition(
  mcpClient,
  tabId,
  '() => document.querySelector(".loaded") !== null',
  10000
)

// Retry MCP calls
await MCPTestUtils.retryMCPCall(
  () => mcpBrowser.click('button'),
  3, // max retries
  1000 // delay between retries
)

// Capture console errors
const errors = await MCPTestUtils.captureConsoleErrors(mcpClient, tabId)

// Measure performance
const metrics = await MCPTestUtils.measurePerformance(mcpClient, tabId)
```

## Configuration

### playwright-mcp.config.ts

Key configuration settings:
- **Timeout**: 90 seconds for MCP operations
- **Workers**: Single worker for sequential execution
- **Projects**: Separate projects for MCP tests
- **Web Servers**: Auto-starts both Next.js and MCP server

## Troubleshooting

### MCP Server Not Starting
```bash
# Check if port is in use
lsof -i:8080

# Kill existing process
lsof -ti:8080 | xargs kill -9

# Start server manually
npx @playwright/mcp@latest --port 8080
```

### Tests Timing Out
- Increase timeout in playwright-mcp.config.ts
- Check MCP server logs: `/tmp/mcp-server.log`
- Check Next.js logs: `/tmp/nextjs-mcp.log`

### Browser Not Visible
```bash
# Run with headed mode
npm run test:mcp:headed
```

## Advanced Usage

### Performance Testing
```typescript
test('performance metrics', async ({ mcpClient, mcpTabId }) => {
  const mcpBrowser = await createMCPBrowser(mcpClient, mcpTabId)
  
  await mcpBrowser.navigate('http://localhost:3000')
  
  const metrics = await MCPTestUtils.measurePerformance(mcpClient, mcpTabId)
  
  expect(metrics.loadTime).toBeLessThan(3000)
  expect(metrics.firstContentfulPaint).toBeLessThan(1500)
})
```

### Offline Mode Testing
```typescript
test('offline queue', async ({ mcpClient, mcpTabId }) => {
  const mcpBrowser = await createMCPBrowser(mcpClient, mcpTabId)
  
  // Simulate offline
  await mcpBrowser.evaluate(`
    () => window.dispatchEvent(new Event('offline'))
  `)
  
  // Perform actions while offline
  // ...
  
  // Simulate online
  await mcpBrowser.evaluate(`
    () => window.dispatchEvent(new Event('online'))
  `)
  
  // Verify queue processed
})
```

### QR Code Scanning Simulation
```typescript
test('qr scanning', async ({ mcpClient, mcpTabId }) => {
  const mcpBrowser = await createMCPBrowser(mcpClient, mcpTabId)
  
  // Simulate QR scan
  await mcpBrowser.evaluate(`
    () => {
      const event = new CustomEvent('qr-scanned', {
        detail: { code: 'TEST-QR', type: 'source' }
      });
      window.dispatchEvent(event);
    }
  `)
})
```

## Best Practices

1. **Use MCP for complex interactions** that benefit from additional control
2. **Use Playwright for assertions** and standard test operations
3. **Clean up resources** - Always close tabs and connections
4. **Handle errors gracefully** - Use try-catch for MCP operations
5. **Log important events** for debugging
6. **Run tests sequentially** to avoid MCP conflicts
7. **Monitor performance** to catch regressions

## CI/CD Integration

```yaml
# GitHub Actions example
- name: Run MCP Tests
  run: |
    npm ci
    npx playwright install chromium
    npm run test:mcp
  env:
    MCP_URL: http://localhost:8080/sse
    NEXT_PUBLIC_APP_URL: http://localhost:3003
```