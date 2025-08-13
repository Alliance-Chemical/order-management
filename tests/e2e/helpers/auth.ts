import { Page } from '@playwright/test'

export async function loginAsUser(page: Page, role: 'worker' | 'supervisor' = 'supervisor') {
  // Navigate to login page
  await page.goto('/login')
  
  // Wait for the login form to be visible
  await page.waitForSelector('form', { timeout: 10000 })
  
  // Use demo accounts for testing
  const credentials = role === 'supervisor' 
    ? { email: 'supervisor@demo.com', password: 'demo123' }
    : { email: 'worker@demo.com', password: 'demo123' }
  
  // Fill in the login form
  await page.fill('input[type="email"]', credentials.email)
  await page.fill('input[type="password"]', credentials.password)
  
  // Click sign in button
  await page.click('button[type="submit"]:has-text("Sign In")')
  
  // Wait for navigation to complete
  await page.waitForURL('/', { timeout: 10000 })
}

export async function logout(page: Page) {
  // Logout logic if needed
  await page.goto('/api/auth/signout')
}