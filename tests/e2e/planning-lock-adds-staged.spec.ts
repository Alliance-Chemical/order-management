import { test, expect, createTestWorkspace, waitForActivity } from './fixtures'

test.describe('Planning lock adds FreightStaged', () => {
  test.use({ storageState: 'tests/e2e/.auth/supervisor.json' })
  
  test('supervisor locks planning -> tag added, phase advances', async ({ page, mockShipStation }) => {
    // Create a workspace
    await createTestWorkspace(page, '555002')
    
    // Navigate to workspace
    await page.goto('/workspace/555002')
    
    // Verify initial phase
    await expect(page.getByTestId('phase-pill')).toContainText(/pending|planning/i)
    
    // Click Lock Planning button
    await page.getByRole('button', { name: /lock planning/i }).click()
    
    // Wait for confirmation
    await expect(page.getByText(/planning locked/i)).toBeVisible()
    
    // Verify phase updated to pre_mix_inspection
    await expect(page.getByTestId('phase-pill')).toContainText(/pre[\s_-]?mix/i)
    
    // Verify activity log shows tag addition
    await waitForActivity(page, 'shipstation_tag_added')
    await expect(page.getByTestId('activity-list')).toContainText(/FreightStaged|Need Labels/i)
  })
  
  test('planning lock is idempotent', async ({ page, mockShipStation }) => {
    await createTestWorkspace(page, '555003')
    await page.goto('/workspace/555003')
    
    // Lock planning once
    await page.getByRole('button', { name: /lock planning/i }).click()
    await expect(page.getByText(/planning locked/i)).toBeVisible()
    
    // Try to lock again - should be disabled or show message
    const lockButton = page.getByRole('button', { name: /lock planning/i })
    await expect(lockButton).toBeDisabled().or(expect(page.getByText(/already locked/i)).toBeVisible())
  })
})