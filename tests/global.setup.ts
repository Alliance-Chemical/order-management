import * as fs from 'fs'
import * as path from 'path'
import { execSync } from 'child_process'

export default async () => {
  console.log('🔧 Running E2E test setup...')
  
  try {
    // Clear workspace data
    console.log('\n📦 Preparing test database...')
    execSync('npm run clear-db -- --force', { 
      stdio: 'inherit',
      timeout: 30000 
    })
    
    // Seed test workspace data
    console.log('\n🏭 Seeding test workspace data...')
    execSync('npm run demo:seed', { 
      stdio: 'inherit',
      timeout: 30000,
      env: { ...process.env }
    })
    
    console.log('\n✅ E2E setup complete - test data seeded')
  } catch (error) {
    console.error('❌ Setup failed:', error)
    throw error
  }
}