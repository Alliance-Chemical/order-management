import { defineConfig, devices } from '@playwright/test'

export default defineConfig({
  testDir: './tests/e2e',
  timeout: 90_000, // Increased timeout for MCP operations
  expect: { timeout: 15_000 },
  fullyParallel: false, // MCP tests should run sequentially
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  workers: 1, // Single worker for MCP
  
  reporter: [
    ['list'],
    ['html', { open: 'never' }],
    ['json', { outputFile: 'test-results/mcp-results.json' }]
  ],
  
  use: {
    baseURL: process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3003',
    trace: 'on',
    video: 'on',
    screenshot: 'on',
    
    // MCP-specific settings
    contextOptions: {
      // Allow MCP to control browser context
      viewport: { width: 1280, height: 720 },
      ignoreHTTPSErrors: true,
    }
  },
  
  // MCP test projects
  projects: [
    {
      name: 'mcp-chromium',
      testMatch: '**/mcp-*.spec.ts',
      use: { 
        ...devices['Desktop Chrome'],
        // Custom MCP browser settings
        launchOptions: {
          args: ['--enable-automation']
        }
      },
    },
    {
      name: 'mcp-mobile',
      testMatch: '**/mcp-mobile-*.spec.ts',
      use: { 
        ...devices['Pixel 5'],
        // Mobile MCP settings
        isMobile: true,
        hasTouch: true,
      },
    },
  ],
  
  // MCP server configuration
  webServer: [
    {
      // Start the Next.js app
      command: 'npm run dev:test',
      port: 3003,
      reuseExistingServer: !process.env.CI,
      timeout: 120_000,
      env: {
        DATABASE_URL: process.env.DATABASE_URL || 'postgres://default:Lm6cG2iOHprI@ep-blue-bar-a4hj4ojg-pooler.us-east-1.aws.neon.tech/qr-workspace-test?sslmode=require',
        PORT: '3003',
      },
    },
    {
      // Start MCP server
      command: 'npx @playwright/mcp@latest --port 8080 --headless',
      port: 8080,
      reuseExistingServer: true,
      timeout: 30_000,
    }
  ],
})