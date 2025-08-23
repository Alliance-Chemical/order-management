import { test, expect } from './fixtures/test-setup'
import { testQRCodes } from './fixtures/test-data'

test.describe('Worker Workflow', () => {
  
  test('should start inspection by scanning master QR', async ({ workspacePage, page }) => {
    // Navigate directly with QR code
    await page.goto(`/workspace?qr=${testQRCodes.master}`)
    
    // Should automatically be in worker view
    expect(await workspacePage.isInWorkerView()).toBeTruthy()
    
    // Should show task list
    await expect(page.locator(workspacePage.selectors.taskList)).toBeVisible()
  })
  
  test('should complete pump & fill inspection flow', async ({ workspacePage }) => {
    const workspaceId = 'test-workspace-pump'
    await workspacePage.goto(workspaceId)
    await workspacePage.switchToWorkerView()
    
    // Start inspection
    await workspacePage.startInspection()
    
    // Select first task
    await workspacePage.selectTask(0)
    
    // Scan source QR
    await workspacePage.scanQRCode(testQRCodes.source)
    
    // Scan destination QR
    await workspacePage.scanQRCode(testQRCodes.destination)
    
    // Complete inspection
    await workspacePage.completeInspection()
    
    // Check progress
    const progress = await workspacePage.getProgress()
    expect(progress).toBeGreaterThan(0)
  })
  
  test('should skip source scan for direct resell items', async ({ workspacePage, page }) => {
    const workspaceId = 'test-workspace-resell'
    await workspacePage.goto(workspaceId)
    await workspacePage.switchToWorkerView()
    
    // Start inspection
    await workspacePage.startInspection()
    
    // Select direct resell task
    await workspacePage.selectTask(0)
    
    // Should skip directly to destination scan
    await expect(page.locator('text=/scan destination/i')).toBeVisible()
    
    // Should NOT show source scan prompt
    await expect(page.locator('text=/scan source/i')).not.toBeVisible()
    
    // Scan destination QR
    await workspacePage.scanQRCode(testQRCodes.destination)
    
    // Complete inspection
    await workspacePage.completeInspection()
  })
  
  test('should handle invalid QR codes', async ({ workspacePage, page }) => {
    const workspaceId = 'test-workspace-invalid'
    await workspacePage.goto(workspaceId)
    await workspacePage.switchToWorkerView()
    
    // Start inspection
    await workspacePage.startInspection()
    await workspacePage.selectTask(0)
    
    // Try to scan invalid QR
    await workspacePage.scanQRCode(testQRCodes.invalid)
    
    // Should show error
    await expect(page.locator('[data-testid="scan-error"]')).toBeVisible()
    await expect(page.locator('[data-testid="scan-error"]')).toContainText(/invalid|wrong/i)
  })
  
  test('should report issues using AI assistant', async ({ workspacePage, page }) => {
    const workspaceId = 'test-workspace-issue'
    await workspacePage.goto(workspaceId)
    await workspacePage.switchToWorkerView()
    
    // Start inspection
    await workspacePage.startInspection()
    await workspacePage.selectTask(0)
    
    // Click report issue button
    await page.click('[data-testid="report-issue-button"]')
    
    // Should open issue reporter modal
    await expect(page.locator('[data-testid="issue-reporter-modal"]')).toBeVisible()
    
    // Options for voice or photo
    await expect(page.locator('button:has-text("Voice")')).toBeVisible()
    await expect(page.locator('button:has-text("Photo")')).toBeVisible()
  })
  
  test('should show real-time collaboration indicators', async ({ workspacePage, page }) => {
    const workspaceId = 'test-workspace-collab'
    await workspacePage.goto(workspaceId)
    
    // Should show other users working on same order
    await expect(page.locator('[data-testid="collaboration-indicator"]')).toBeVisible()
    
    // Should show user role and activity
    await expect(page.locator('[data-testid="user-activity"]')).toContainText(/viewing|editing|inspecting/i)
  })
})  // End of test.describe
