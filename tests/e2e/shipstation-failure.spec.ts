import { test, expect, createTestWorkspace } from './fixtures'

test.describe('ShipStation failure handling', () => {
  test.use({ storageState: 'tests/e2e/.auth/supervisor.json' })
  
  test('ShipStation API failure shows toast and logs error', async ({ page }) => {
    await createTestWorkspace(page, '555030')
    await page.goto('/workspace/555030')
    
    // Mock ShipStation failure
    await page.route('**/ssapi.shipstation.com/**', route => {
      route.fulfill({ 
        status: 500, 
        body: JSON.stringify({ error: 'Internal Server Error' })
      })
    })
    
    // Try to lock planning (which updates tags)
    await page.getByRole('button', { name: /lock planning/i }).click()
    
    // Should show error toast
    await expect(page.getByRole('alert')).toContainText(/failed.*shipstation/i)
    
    // Phase should NOT advance
    await expect(page.getByTestId('phase-pill')).not.toContainText(/pre[\s_-]?mix/i)
    
    // Activity log should show error
    await expect(page.getByTestId('activity-list')).toContainText(/error|failed/i)
  })
  
  test('ShipStation timeout handled gracefully', async ({ page }) => {
    await createTestWorkspace(page, '555031')
    await page.goto('/workspace/555031')
    
    // Mock slow ShipStation response
    await page.route('**/ssapi.shipstation.com/**', async route => {
      await new Promise(resolve => setTimeout(resolve, 35000)) // Longer than timeout
      route.fulfill({ status: 200 })
    })
    
    // Try to sync
    await page.getByRole('button', { name: /sync.*shipstation/i }).click()
    
    // Should show timeout error (within reasonable time)
    await expect(page.getByRole('alert')).toContainText(/timeout|timed out/i, { timeout: 40000 })
  })
})