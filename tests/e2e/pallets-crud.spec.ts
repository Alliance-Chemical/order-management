import { test, expect, createTestWorkspace } from './fixtures'

test.describe('Pallets CRUD', () => {
  test.use({ storageState: 'tests/e2e/.auth/supervisor.json' })
  
  test('create pallets with dims/weight and items', async ({ page, mockShipStation }) => {
    await createTestWorkspace(page, '555006')
    await page.goto('/workspace/555006')
    
    // Navigate to pallets tab
    await page.getByRole('tab', { name: /pallets/i }).click()
    
    // Add a pallet
    await page.getByRole('button', { name: /add pallet/i }).click()
    
    // Fill pallet dimensions
    await page.getByLabel(/length/i).fill('48')
    await page.getByLabel(/width/i).fill('40')
    await page.getByLabel(/height/i).fill('50')
    await page.getByLabel(/weight/i).fill('700')
    
    // Add drum items
    await page.getByRole('button', { name: /add drum/i }).click()
    await page.getByLabel(/quantity/i).fill('2')
    await page.getByRole('button', { name: /save/i }).click()
    
    // Verify totals compute
    await expect(page.getByTestId('pallet-total-weight')).toContainText('700')
    await expect(page.getByTestId('pallet-items-count')).toContainText('2 drums')
    
    // Persist on reload
    await page.reload()
    await page.getByRole('tab', { name: /pallets/i }).click()
    await expect(page.getByTestId('pallet-total-weight')).toContainText('700')
  })
  
  test('add multiple item types to pallet', async ({ page, mockShipStation }) => {
    await createTestWorkspace(page, '555007')
    await page.goto('/workspace/555007')
    await page.getByRole('tab', { name: /pallets/i }).click()
    
    await page.getByRole('button', { name: /add pallet/i }).click()
    
    // Add drums
    await page.getByRole('button', { name: /add drum/i }).click()
    await page.getByLabel(/quantity/i).fill('2')
    await page.getByRole('button', { name: /save/i }).click()
    
    // Add pails
    await page.getByRole('button', { name: /add pail/i }).click()
    await page.getByLabel(/quantity/i).fill('4')
    await page.getByRole('button', { name: /save/i }).click()
    
    // Add boxes
    await page.getByRole('button', { name: /add box/i }).click()
    await page.getByLabel(/quantity/i).fill('6')
    await page.getByRole('button', { name: /save/i }).click()
    
    // Verify mixed items display
    await expect(page.getByTestId('pallet-items-summary')).toContainText('2 drums, 4 pails, 6 boxes')
  })
  
  test('delete pallet', async ({ page, mockShipStation }) => {
    await createTestWorkspace(page, '555008')
    await page.goto('/workspace/555008')
    await page.getByRole('tab', { name: /pallets/i }).click()
    
    // Add pallet
    await page.getByRole('button', { name: /add pallet/i }).click()
    await page.getByLabel(/weight/i).fill('500')
    await page.getByRole('button', { name: /save/i }).click()
    
    // Delete pallet
    await page.getByRole('button', { name: /delete pallet/i }).click()
    await page.getByRole('button', { name: /confirm delete/i }).click()
    
    // Verify pallet removed
    await expect(page.getByText(/no pallets/i)).toBeVisible()
  })
})