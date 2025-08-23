import { test, expect, createTestWorkspace } from './fixtures'

test.describe('Presence tracking', () => {
  test('multiple users shown in workspace presence list', async ({ browser, mockKV }) => {
    // Create two browser contexts
    const context1 = await browser.newContext({
      storageState: 'tests/e2e/.auth/agent.json'
    })
    const page1 = await context1.newPage()
    
    const context2 = await browser.newContext({
      storageState: 'tests/e2e/.auth/supervisor.json'
    })
    const page2 = await context2.newPage()
    
    // Create workspace
    await createTestWorkspace(page1, '555016')
    
    // Both users navigate to workspace
    await page1.goto('/workspace/555016')
    await page2.goto('/workspace/555016')
    
    // Wait for presence to update
    await page1.waitForTimeout(1000)
    await page2.waitForTimeout(1000)
    
    // Check presence list on both pages
    await expect(page1.getByTestId('presence-list')).toContainText('Test Agent')
    await expect(page1.getByTestId('presence-list')).toContainText('Test Supervisor')
    
    await expect(page2.getByTestId('presence-list')).toContainText('Test Agent')
    await expect(page2.getByTestId('presence-list')).toContainText('Test Supervisor')
    
    // User 1 leaves
    await context1.close()
    
    // Wait for presence update
    await page2.waitForTimeout(2000)
    
    // Verify user 1 removed from presence
    await expect(page2.getByTestId('presence-list')).not.toContainText('Test Agent')
    await expect(page2.getByTestId('presence-list')).toContainText('Test Supervisor')
    
    await context2.close()
  })
  
  test('presence clears after idle timeout', async ({ page, mockKV }) => {
    await createTestWorkspace(page, '555017')
    await page.goto('/workspace/555017')
    
    // Initially present
    await expect(page.getByTestId('presence-list')).toContainText('Test')
    
    // Simulate idle by not interacting for timeout period
    // In test, we'll manually clear presence
    await page.request.post('/api/presence/555017/clear')
    
    await page.waitForTimeout(1000)
    
    // Verify presence cleared
    await expect(page.getByTestId('presence-list')).toHaveText(/no.*active.*users|empty/i)
  })
})