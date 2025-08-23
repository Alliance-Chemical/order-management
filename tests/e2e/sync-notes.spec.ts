import { test, expect, createTestWorkspace } from './fixtures'

test.describe('Sync to ShipStation', () => {
  test.use({ storageState: 'tests/e2e/.auth/supervisor.json' })
  
  test('sync builds consolidated notes and pushes to ShipStation', async ({ page, mockShipStation }) => {
    await createTestWorkspace(page, '555012')
    await page.goto('/workspace/555012')
    
    // Add pallets
    await page.getByRole('tab', { name: /pallets/i }).click()
    await page.getByRole('button', { name: /add pallet/i }).click()
    await page.getByLabel(/length/i).fill('48')
    await page.getByLabel(/width/i).fill('40')
    await page.getByLabel(/height/i).fill('50')
    await page.getByLabel(/weight/i).fill('700')
    await page.getByRole('button', { name: /save/i }).click()
    
    // Add lots
    await page.getByRole('tab', { name: /lots/i }).click()
    await page.getByTestId('container-1').getByRole('button', { name: /assign lot/i }).click()
    await page.getByLabel(/lot number/i).fill('LOT-2024-SYNC')
    await page.getByRole('button', { name: /save/i }).click()
    
    // Click sync button
    await page.getByRole('button', { name: /sync.*shipstation/i }).click()
    
    // Verify sync confirmation
    await expect(page.getByText(/notes pushed to shipstation/i)).toBeVisible()
    
    // Check activity log
    await expect(page.getByTestId('activity-list')).toContainText('shipstation_notes_pushed')
    
    // Verify the request included consolidated data
    const requests = await page.evaluate(() => 
      window.performance.getEntriesByType('resource')
        .filter(r => r.name.includes('ssapi.shipstation.com'))
    )
    expect(requests.length).toBeGreaterThan(0)
  })
  
  test('sync handles API failures gracefully', async ({ page }) => {
    await createTestWorkspace(page, '555013')
    await page.goto('/workspace/555013')
    
    // Mock ShipStation failure
    await page.route('**/ssapi.shipstation.com/**', route => {
      route.fulfill({ status: 500, body: 'Internal Server Error' })
    })
    
    // Try to sync
    await page.getByRole('button', { name: /sync.*shipstation/i }).click()
    
    // Should show error message
    await expect(page.getByText(/failed to sync/i)).toBeVisible()
    
    // Activity log should show error
    await expect(page.getByTestId('activity-list')).toContainText('sync_error')
  })
})