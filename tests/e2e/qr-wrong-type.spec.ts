import { test, expect, createTestWorkspace } from './fixtures'

test.describe('QR scanning - wrong type', () => {
  test.use({ storageState: 'tests/e2e/.auth/agent.json' })
  
  test('scanning wrong QR type shows friendly error', async ({ page }) => {
    await createTestWorkspace(page, '555020')
    await page.goto('/workspace/555020')
    
    // Generate QR codes
    await page.getByRole('button', { name: /generate qr/i }).click()
    await expect(page.getByText(/qr codes generated/i)).toBeVisible({ timeout: 10000 })
    
    await page.getByRole('tab', { name: /qr codes/i }).click()
    
    // Get source and destination QR values
    const sourceQr = await page.getByTestId('qr-source').getAttribute('data-qr-value')
    const destQr = await page.getByTestId('qr-destination-1').getAttribute('data-qr-value')
    
    // Navigate to inspection that expects source QR
    await page.getByRole('tab', { name: /inspections/i }).click()
    await page.getByRole('button', { name: /start.*inspection/i }).first().click()
    
    // Try scanning destination QR when source is expected
    await page.getByRole('button', { name: /scan source/i }).click()
    await page.getByLabel(/qr code|short code/i).fill(destQr!)
    await page.getByRole('button', { name: /validate/i }).click()
    
    // Should show friendly error
    await expect(page.getByText(/wrong qr type/i)).toBeVisible()
    await expect(page.getByText(/expected.*source.*scanned.*destination/i)).toBeVisible()
    
    // Now scan correct type
    await page.getByLabel(/qr code|short code/i).clear()
    await page.getByLabel(/qr code|short code/i).fill(sourceQr!)
    await page.getByRole('button', { name: /validate/i }).click()
    
    await expect(page.getByText(/valid source qr/i)).toBeVisible()
  })
  
  test('manual short code entry validates correctly', async ({ page }) => {
    await createTestWorkspace(page, '555021')
    await page.goto('/workspace/555021')
    
    // Generate QR codes
    await page.getByRole('button', { name: /generate qr/i }).click()
    await expect(page.getByText(/qr codes generated/i)).toBeVisible({ timeout: 10000 })
    
    await page.getByRole('tab', { name: /qr codes/i }).click()
    
    // Get short code
    const shortCode = await page.getByTestId('qr-master').getByTestId('short-code').textContent()
    
    // Try manual entry
    await page.getByRole('button', { name: /manual entry/i }).click()
    await page.getByLabel(/short code/i).fill(shortCode!)
    await page.getByRole('button', { name: /validate/i }).click()
    
    await expect(page.getByText(/valid.*code/i)).toBeVisible()
  })
})