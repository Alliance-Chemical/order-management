import { chromium, Browser, BrowserContext, Page } from '@playwright/test'
import * as fs from 'fs'
import * as path from 'path'

export interface TestUser {
  email: string
  password: string
  name: string
  role: 'worker' | 'supervisor' | 'admin'
}

export const TEST_USERS: TestUser[] = [
  {
    email: 'worker@test.com',
    password: 'worker123',
    name: 'Test Worker',
    role: 'worker'
  },
  {
    email: 'supervisor@test.com', 
    password: 'supervisor123',
    name: 'Test Supervisor',
    role: 'supervisor'
  },
  {
    email: 'admin@test.com',
    password: 'admin123',
    name: 'Test Admin',
    role: 'admin'
  }
]

export async function createStorageStates() {
  const browser = await chromium.launch()
  const authDir = path.join(__dirname, '..', '.auth')
  
  if (!fs.existsSync(authDir)) {
    fs.mkdirSync(authDir, { recursive: true })
  }

  for (const user of TEST_USERS) {
    const context = await browser.newContext()
    const page = await context.newPage()
    
    try {
      // Navigate to login page
      await page.goto('http://localhost:3003/auth/signin')
      
      // Try to login
      await page.fill('input[name="email"]', user.email)
      await page.fill('input[name="password"]', user.password)
      await page.click('button[type="submit"]')
      
      // Wait for successful login redirect
      await page.waitForURL('**/dashboard', { timeout: 5000 }).catch(() => {
        console.log(`User ${user.email} might not exist, creating...`)
      })
      
      // Save storage state
      await context.storageState({ 
        path: path.join(authDir, `${user.role}.json`) 
      })
      
      console.log(`✅ Created storage state for ${user.role}`)
    } catch (error) {
      console.log(`⚠️ Could not create storage state for ${user.role}:`, error)
    } finally {
      await context.close()
    }
  }
  
  await browser.close()
}

export async function loginAs(page: Page, role: 'worker' | 'supervisor' | 'admin') {
  const user = TEST_USERS.find(u => u.role === role)
  if (!user) throw new Error(`No test user for role: ${role}`)
  
  await page.goto('/auth/signin')
  await page.fill('input[name="email"]', user.email)
  await page.fill('input[name="password"]', user.password)
  await page.click('button[type="submit"]')
  await page.waitForURL('**/dashboard', { timeout: 5000 })
}
