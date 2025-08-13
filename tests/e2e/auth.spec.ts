import { test, expect } from './fixtures/test-setup'
import { testUsers } from './fixtures/test-data'

test.describe('Authentication', () => {
  test('should login successfully as supervisor', async ({ loginPage, page }) => {
    await loginPage.goto()
    await loginPage.loginAsSupervisor()
    
    // Should redirect to dashboard
    await expect(page).toHaveURL('/')
    
    // Should show supervisor-specific UI
    await expect(page.locator('[data-testid="user-role"]')).toContainText('Supervisor')
  })
  
  test('should login successfully as worker', async ({ loginPage, page }) => {
    await loginPage.goto()
    await loginPage.loginAsWorker()
    
    // Should redirect to dashboard
    await expect(page).toHaveURL('/')
    
    // Should show worker-specific UI
    await expect(page.locator('[data-testid="user-role"]')).toContainText('Worker')
  })
  
  test('should show error for invalid credentials', async ({ loginPage }) => {
    await loginPage.goto()
    await loginPage.login('invalid@test.com', 'wrongpassword')
    
    const error = await loginPage.getErrorMessage()
    expect(error).toContain('Invalid credentials')
  })
  
  test('should maintain session across page refreshes', async ({ loginPage, page }) => {
    await loginPage.goto()
    await loginPage.loginAsSupervisor()
    
    // Refresh page
    await page.reload()
    
    // Should still be logged in
    await expect(page).toHaveURL('/')
    await expect(page.locator('[data-testid="user-role"]')).toBeVisible()
  })
  
  test('should logout successfully', async ({ loginPage, page }) => {
    await loginPage.goto()
    await loginPage.loginAsSupervisor()
    
    // Find and click logout button
    await page.click('[data-testid="logout-button"]')
    
    // Should redirect to login
    await expect(page).toHaveURL('/login')
  })
  
  test('should restrict access based on role', async ({ loginPage, page }) => {
    // Login as worker
    await loginPage.goto()
    await loginPage.loginAsWorker()
    
    // Try to access supervisor-only page
    await page.goto('/anomaly-dashboard')
    
    // Should show unauthorized or redirect
    await expect(page.locator('text=/unauthorized|not authorized/i')).toBeVisible()
  })
})