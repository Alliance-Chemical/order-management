import { test, expect, createTestWorkspace } from './fixtures'

test.describe('Lot number assignment', () => {
  test.use({ storageState: 'tests/e2e/.auth/supervisor.json' })
  
  test('assign lot numbers to destination QRs', async ({ page, mockShipStation }) => {
    await createTestWorkspace(page, '555010')
    await page.goto('/workspace/555010')
    
    // Navigate to lots tab
    await page.getByRole('tab', { name: /lots/i }).click()
    
    // Assign lot to first container
    await page.getByTestId('container-1').getByRole('button', { name: /assign lot/i }).click()
    await page.getByLabel(/lot number/i).fill('LOT-2024-001')
    await page.getByRole('button', { name: /save/i }).click()
    
    // Verify lot displayed
    await expect(page.getByTestId('container-1')).toContainText('LOT-2024-001')
    
    // Try to assign duplicate - should show error
    await page.getByTestId('container-2').getByRole('button', { name: /assign lot/i }).click()
    await page.getByLabel(/lot number/i).fill('LOT-2024-001')
    await page.getByRole('button', { name: /save/i }).click()
    
    await expect(page.getByText(/lot number already exists/i)).toBeVisible()
  })
  
  test('edit and remove lot numbers', async ({ page, mockShipStation }) => {
    await createTestWorkspace(page, '555011')
    await page.goto('/workspace/555011')
    await page.getByRole('tab', { name: /lots/i }).click()
    
    // Assign lot
    await page.getByTestId('container-1').getByRole('button', { name: /assign lot/i }).click()
    await page.getByLabel(/lot number/i).fill('LOT-ORIGINAL')
    await page.getByRole('button', { name: /save/i }).click()
    
    // Edit lot
    await page.getByTestId('container-1').getByRole('button', { name: /edit lot/i }).click()
    await page.getByLabel(/lot number/i).fill('LOT-EDITED')
    await page.getByRole('button', { name: /save/i }).click()
    
    await expect(page.getByTestId('container-1')).toContainText('LOT-EDITED')
    
    // Remove lot
    await page.getByTestId('container-1').getByRole('button', { name: /remove lot/i }).click()
    await page.getByRole('button', { name: /confirm/i }).click()
    
    await expect(page.getByTestId('container-1')).not.toContainText('LOT-')
  })
})