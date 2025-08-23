import { test, expect, createTestWorkspace } from './fixtures'

test.describe('Inspection flow - happy path', () => {
  test.use({ storageState: 'tests/e2e/.auth/agent.json' })
  
  test('complete inspection flow advances phases correctly', async ({ page, mockShipStation }) => {
    await createTestWorkspace(page, '555014')
    await page.goto('/workspace/555014')
    
    // Lock planning first
    await page.request.post('/api/workspace/555014/planning/lock')
    await page.reload()
    
    // Pre-mix inspection PASS
    await page.getByRole('tab', { name: /inspections/i }).click()
    await page.getByRole('button', { name: /start pre-mix/i }).click()
    
    await page.getByLabel(/check containers/i).check()
    await page.getByLabel(/verify labels/i).check()
    await page.getByLabel(/safety equipment/i).check()
    await page.getByRole('button', { name: /pass inspection/i }).click()
    
    // Verify phase advanced to mixing
    await expect(page.getByTestId('phase-pill')).toContainText(/mixing/i)
    
    // Post-mix QC PASS
    await page.getByRole('button', { name: /start post-mix/i }).click()
    await page.getByLabel(/visual inspection/i).check()
    await page.getByLabel(/consistency check/i).check()
    await page.getByLabel(/sample taken/i).check()
    await page.getByRole('button', { name: /pass inspection/i }).click()
    
    // Verify phase advanced to pre-ship
    await expect(page.getByTestId('phase-pill')).toContainText(/pre[\s_-]?ship/i)
    
    // Pre-ship inspection PASS
    await page.getByRole('button', { name: /start pre-ship/i }).click()
    await page.getByLabel(/final check/i).check()
    await page.getByLabel(/seal containers/i).check()
    await page.getByLabel(/load pallet/i).check()
    await page.getByRole('button', { name: /pass inspection/i }).click()
    
    // Verify phase advanced to ready_to_ship
    await expect(page.getByTestId('phase-pill')).toContainText(/ready.*ship/i)
    
    // Verify tags were added
    await expect(page.getByTestId('workspace-tags')).toContainText(/Freight Order Ready/i)
  })
})