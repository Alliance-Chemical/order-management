import { test, expect } from '@playwright/test'

test('smoke test - app loads', async ({ page }) => {
  // Just try to load the homepage
  await page.goto('/')
  
  // Check if page loaded with correct title
  await expect(page).toHaveTitle(/Alliance Chemical|QR Workspace/i)
  
  // Check that main content is visible
  await expect(page.locator('body')).toBeVisible()
})