import { test, expect } from '@playwright/test'

test('smoke test - app loads', async ({ page }) => {
  // Just try to load the homepage
  await page.goto('http://localhost:3000')
  
  // Check if page loaded
  await expect(page).toHaveTitle(/QR|Order|Workspace/i)
})