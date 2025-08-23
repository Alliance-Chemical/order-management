import { test, expect, createTestWorkspace } from './fixtures'

test.describe('Pallets reordering', () => {
  test.use({ storageState: 'tests/e2e/.auth/supervisor.json' })
  
  test('drag and drop items persists order', async ({ page, mockShipStation }) => {
    await createTestWorkspace(page, '555009')
    await page.goto('/workspace/555009')
    await page.getByRole('tab', { name: /pallets/i }).click()
    
    // Add multiple pallets
    for (let i = 1; i <= 3; i++) {
      await page.getByRole('button', { name: /add pallet/i }).click()
      await page.getByLabel(/pallet name/i).fill(`Pallet ${i}`)
      await page.getByLabel(/weight/i).fill(`${i * 100}`)
      await page.getByRole('button', { name: /save/i }).click()
    }
    
    // Get initial order
    const palletsBefore = await page.getByTestId('pallet-item').allTextContents()
    expect(palletsBefore).toEqual(['Pallet 1', 'Pallet 2', 'Pallet 3'])
    
    // Drag Pallet 3 to position 1
    const pallet3 = page.getByTestId('pallet-item').filter({ hasText: 'Pallet 3' })
    const pallet1 = page.getByTestId('pallet-item').filter({ hasText: 'Pallet 1' })
    
    await pallet3.dragTo(pallet1)
    
    // Verify new order
    const palletsAfter = await page.getByTestId('pallet-item').allTextContents()
    expect(palletsAfter).toEqual(['Pallet 3', 'Pallet 1', 'Pallet 2'])
    
    // Reload and verify persistence
    await page.reload()
    await page.getByRole('tab', { name: /pallets/i }).click()
    
    const palletsReloaded = await page.getByTestId('pallet-item').allTextContents()
    expect(palletsReloaded).toEqual(['Pallet 3', 'Pallet 1', 'Pallet 2'])
  })
})