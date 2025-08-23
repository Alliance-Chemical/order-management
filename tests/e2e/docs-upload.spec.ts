import { test, expect, createTestWorkspace } from './fixtures'
import path from 'path'

test.describe('Document management', () => {
  test.use({ storageState: 'tests/e2e/.auth/supervisor.json' })
  
  test('upload COA/SDS/BOL documents', async ({ page }) => {
    await createTestWorkspace(page, '555022')
    await page.goto('/workspace/555022')
    
    // Navigate to documents tab
    await page.getByRole('tab', { name: /documents/i }).click()
    
    // Create test files
    const testFiles = [
      { name: 'coa.pdf', type: 'COA', size: '124 KB' },
      { name: 'sds.pdf', type: 'SDS', size: '256 KB' },
      { name: 'bol.pdf', type: 'BOL', size: '89 KB' }
    ]
    
    for (const file of testFiles) {
      // Upload file
      await page.getByRole('button', { name: new RegExp(`upload ${file.type}`, 'i') }).click()
      
      // Set file input (create temp file in real test)
      const fileInput = page.getByLabel(/select file/i)
      await fileInput.setInputFiles({
        name: file.name,
        mimeType: 'application/pdf',
        buffer: Buffer.from('test pdf content')
      })
      
      await page.getByRole('button', { name: /upload/i }).click()
      
      // Verify file appears in list
      await expect(page.getByTestId('document-list')).toContainText(file.name)
      await expect(page.getByTestId('document-list')).toContainText(file.type)
    }
    
    // Verify total size updates
    await expect(page.getByTestId('total-docs-size')).toContainText(/\d+\s*(KB|MB)/i)
    
    // Verify document count
    await expect(page.getByTestId('document-count')).toContainText('3')
  })
  
  test('remove uploaded documents', async ({ page }) => {
    await createTestWorkspace(page, '555023')
    await page.goto('/workspace/555023')
    await page.getByRole('tab', { name: /documents/i }).click()
    
    // Upload a document
    await page.getByRole('button', { name: /upload COA/i }).click()
    const fileInput = page.getByLabel(/select file/i)
    await fileInput.setInputFiles({
      name: 'test-coa.pdf',
      mimeType: 'application/pdf',
      buffer: Buffer.from('test content')
    })
    await page.getByRole('button', { name: /upload/i }).click()
    
    // Verify uploaded
    await expect(page.getByTestId('document-list')).toContainText('test-coa.pdf')
    
    // Remove document
    await page.getByTestId('doc-test-coa').getByRole('button', { name: /remove/i }).click()
    await page.getByRole('button', { name: /confirm/i }).click()
    
    // Verify removed
    await expect(page.getByTestId('document-list')).not.toContainText('test-coa.pdf')
    await expect(page.getByTestId('document-count')).toContainText('0')
  })
  
  test('document size limits enforced', async ({ page }) => {
    await createTestWorkspace(page, '555024')
    await page.goto('/workspace/555024')
    await page.getByRole('tab', { name: /documents/i }).click()
    
    // Try to upload oversized file
    await page.getByRole('button', { name: /upload COA/i }).click()
    const fileInput = page.getByLabel(/select file/i)
    
    // Create large buffer (> 10MB)
    const largeBuffer = Buffer.alloc(11 * 1024 * 1024, 'x')
    
    await fileInput.setInputFiles({
      name: 'huge-file.pdf',
      mimeType: 'application/pdf',
      buffer: largeBuffer
    })
    
    await page.getByRole('button', { name: /upload/i }).click()
    
    // Should show error
    await expect(page.getByText(/file too large|exceeds.*limit/i)).toBeVisible()
  })
})