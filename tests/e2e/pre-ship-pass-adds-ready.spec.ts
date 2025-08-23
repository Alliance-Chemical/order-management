import { test, expect, createTestWorkspace, waitForActivity } from './fixtures'

test.describe('Pre-ship inspection adds FreightReady', () => {
  test.use({ storageState: 'tests/e2e/.auth/agent.json' })
  
  test('pre-ship PASS -> adds FREIGHT_READY tag', async ({ page, mockShipStation }) => {
    // Create workspace in pre-ship phase
    await createTestWorkspace(page, '555004')
    await page.goto('/workspace/555004')
    
    // Set workspace to pre-ship phase (via API or UI navigation)
    await page.request.put('/api/workspace/555004', {
      data: { phase: 'pre_ship_inspection' }
    })
    
    await page.reload()
    
    // Open inspections tab
    await page.getByRole('tab', { name: /inspections/i }).click()
    
    // Complete pre-ship inspection with PASS
    await page.getByRole('button', { name: /start pre-ship/i }).click()
    
    // Check all required items
    await page.getByLabel(/verify labels/i).check()
    await page.getByLabel(/check seals/i).check()
    await page.getByLabel(/confirm quantity/i).check()
    
    // Submit with PASS result
    await page.getByRole('button', { name: /pass inspection/i }).click()
    
    // Verify phase updated to ready_to_ship
    await expect(page.getByTestId('phase-pill')).toContainText(/ready.*ship/i)
    
    // Verify activity log shows tag addition
    await waitForActivity(page, 'shipstation_tag_added')
    await expect(page.getByTestId('activity-list')).toContainText(/Freight Order Ready/i)
  })
})