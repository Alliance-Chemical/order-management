import { test, expect, createTestWorkspace } from './fixtures'

test.describe('QR scanning - happy path', () => {
  test.use({ storageState: 'tests/e2e/.auth/agent.json' })
  
  test('generate and validate QR codes correctly', async ({ page }) => {
    await createTestWorkspace(page, '555018')
    await page.goto('/workspace/555018')
    
    // Generate QR codes
    await page.getByRole('button', { name: /generate qr/i }).click()
    
    // Wait for generation
    await expect(page.getByText(/qr codes generated/i)).toBeVisible({ timeout: 10000 })
    
    // Navigate to QR tab
    await page.getByRole('tab', { name: /qr codes/i }).click()
    
    // Verify master QR exists
    await expect(page.getByTestId('qr-master')).toBeVisible()
    await expect(page.getByTestId('qr-master')).toContainText(/ORDER MASTER/i)
    
    // Verify source QR exists
    await expect(page.getByTestId('qr-source')).toBeVisible()
    await expect(page.getByTestId('qr-source')).toContainText(/SOURCE BULK/i)
    
    // Verify destination QRs exist
    await expect(page.getByTestId('qr-destination-1')).toBeVisible()
    await expect(page.getByTestId('qr-destination-1')).toContainText(/TO BE FILLED/i)
    
    // Test scanning simulation
    await page.getByRole('button', { name: /scan qr/i }).click()
    
    // Simulate scanning master QR
    const masterQrData = await page.getByTestId('qr-master').getAttribute('data-qr-value')
    await page.getByLabel(/qr code/i).fill(masterQrData!)
    await page.getByRole('button', { name: /validate/i }).click()
    
    await expect(page.getByText(/valid master qr/i)).toBeVisible()
  })
  
  test('handle duplicate scans gracefully', async ({ page }) => {
    await createTestWorkspace(page, '555019')
    await page.goto('/workspace/555019')
    
    // Generate QRs
    await page.getByRole('button', { name: /generate qr/i }).click()
    await expect(page.getByText(/qr codes generated/i)).toBeVisible({ timeout: 10000 })
    
    await page.getByRole('tab', { name: /qr codes/i }).click()
    const qrValue = await page.getByTestId('qr-master').getAttribute('data-qr-value')
    
    // First scan
    await page.getByRole('button', { name: /scan qr/i }).click()
    await page.getByLabel(/qr code/i).fill(qrValue!)
    await page.getByRole('button', { name: /validate/i }).click()
    await expect(page.getByText(/valid/i)).toBeVisible()
    
    // Duplicate scan
    await page.getByRole('button', { name: /scan qr/i }).click()
    await page.getByLabel(/qr code/i).fill(qrValue!)
    await page.getByRole('button', { name: /validate/i }).click()
    
    // Should show idempotent message
    await expect(page.getByText(/already scanned/i)).toBeVisible()
  })
})