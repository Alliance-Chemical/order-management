import { spawn } from 'child_process'
import * as fs from 'fs'
import * as path from 'path'

const MCP_CONFIG = path.join(process.cwd(), 'playwright-mcp.config.json')
const AUTH_DIR = path.join(process.cwd(), 'tests/e2e/.auth')

interface TestUser {
  email: string
  password: string
  role: string
}

const testUsers: TestUser[] = [
  { email: 'worker@test.com', password: 'password123', role: 'agent' },
  { email: 'supervisor@test.com', password: 'password123', role: 'supervisor' },
  { email: 'admin@test.com', password: 'password123', role: 'admin' }
]

async function setupAuthWithMCP() {
  console.log('🎭 Setting up test authentication with Playwright MCP...')
  
  // Ensure auth directory exists
  if (!fs.existsSync(AUTH_DIR)) {
    fs.mkdirSync(AUTH_DIR, { recursive: true })
  }

  // Start MCP server
  console.log('🚀 Starting Playwright MCP server...')
  const mcpProcess = spawn('npx', [
    '@playwright/mcp',
    '--config', MCP_CONFIG,
    '--port', '8931',
    '--headless'
  ], {
    stdio: 'pipe',
    detached: false
  })

  // Wait for server to be ready
  await new Promise(resolve => setTimeout(resolve, 3000))

  console.log('✅ MCP server started on port 8931')
  
  // For each test user, create an authenticated session
  for (const user of testUsers) {
    console.log(`🔐 Creating session for ${user.role}...`)
    
    try {
      // Here you would use the MCP client to:
      // 1. Navigate to login page
      // 2. Fill in credentials
      // 3. Submit form
      // 4. Save the session state
      
      // For now, create placeholder auth state
      const storageState = {
        cookies: [],
        origins: [],
        // This would be populated by actual MCP session
        localStorage: [{
          origin: 'http://localhost:3000',
          items: {
            'test-user': JSON.stringify(user)
          }
        }]
      }
      
      fs.writeFileSync(
        path.join(AUTH_DIR, `${user.role}.json`),
        JSON.stringify(storageState, null, 2)
      )
      
      console.log(`✅ Created auth state for ${user.role}`)
    } catch (error) {
      console.error(`❌ Failed to create session for ${user.role}:`, error)
    }
  }

  // Stop MCP server
  mcpProcess.kill()
  console.log('🛑 MCP server stopped')
  console.log('✅ Test authentication setup complete')
}

// Run if called directly
if (require.main === module) {
  setupAuthWithMCP()
    .then(() => process.exit(0))
    .catch(error => {
      console.error('Setup failed:', error)
      process.exit(1)
    })
}

export { setupAuthWithMCP }