import { test, expect } from './fixtures/test-setup'
import { testOrders, testSourceContainers, testQRCodes } from './fixtures/test-data'

test.describe('Critical Path - Complete Order Flow', () => {
  test('should complete entire order from assignment to inspection', async ({ 
    loginPage, 
    dashboardPage, 
    workspacePage, 
    page 
  }) => {
    // Step 1: Supervisor logs in and views dashboard
    await loginPage.goto()
    await loginPage.loginAsSupervisor()
    await expect(page).toHaveURL('/')
    
    // Step 2: Select and assign order
    await dashboardPage.waitForOrdersToLoad()
    await dashboardPage.assignOrder(testOrders.complex.orderNumber)
    await expect(page).toHaveURL(/\/workspace\//)
    
    // Step 3: Assign items with different workflows
    await workspacePage.assignItem(0, 'pump_fill', testSourceContainers.standard.id)
    await workspacePage.assignItem(1, 'direct_resell')
    
    // Step 4: Generate and verify PDF labels
    const download = await workspacePage.printLabels()
    expect(download.suggestedFilename()).toContain('.pdf')
    
    // Step 5: Switch to worker view
    await workspacePage.switchToWorkerView()
    expect(await workspacePage.isInWorkerView()).toBeTruthy()
    
    // Step 6: Start inspection process
    await workspacePage.startInspection()
    
    // Step 7: Complete pump & fill item
    await workspacePage.selectTask(0)
    await workspacePage.scanQRCode(testQRCodes.source)
    await workspacePage.scanQRCode(testQRCodes.destination)
    
    // Step 8: Complete direct resell item
    await workspacePage.selectTask(1)
    await workspacePage.scanQRCode(testQRCodes.destination)
    
    // Step 9: Complete inspection
    await workspacePage.completeInspection()
    
    // Step 10: Verify completion
    const progress = await workspacePage.getProgress()
    expect(progress).toBe(100)
    
    // Verify status update
    await expect(page.locator('[data-testid="order-status"]')).toContainText(/completed/i)
  })
  
  test('should handle dilution calculator flow', async ({ 
    loginPage,
    workspacePage,
    page 
  }) => {
    // Login as supervisor
    await loginPage.goto()
    await loginPage.loginAsSupervisor()
    
    // Navigate to workspace with dilution requirement
    const workspaceId = 'test-workspace-dilution'
    await workspacePage.goto(workspaceId)
    
    // Assign item that requires dilution
    await workspacePage.assignItem(0, 'pump_fill', testSourceContainers.concentrated.id)
    
    // Should show dilution calculator
    await expect(page.locator('[data-testid="dilution-calculator"]')).toBeVisible()
    
    // Verify calculations are shown
    await expect(page.locator('[data-testid="source-amount"]')).toBeVisible()
    await expect(page.locator('[data-testid="water-amount"]')).toBeVisible()
    await expect(page.locator('[data-testid="final-volume"]')).toBeVisible()
    
    // Save dilution batch
    await page.click('button:has-text("Save Batch")')
    
    // Should create batch record
    await expect(page.locator('[data-testid="batch-saved"]')).toBeVisible()
  })
  
  test('should maintain audit trail throughout workflow', async ({
    loginPage,
    dashboardPage,
    workspacePage,
    page
  }) => {
    // Complete a simple workflow
    await loginPage.goto()
    await loginPage.loginAsSupervisor()
    
    await dashboardPage.goto()
    await dashboardPage.assignOrder(testOrders.simple.orderNumber)
    
    await workspacePage.assignItem(0, 'direct_resell')
    await workspacePage.printLabels()
    
    // Check activity log
    await page.click('[data-testid="view-activity-log"]')
    
    // Should show all actions
    const activities = await page.locator('[data-testid="activity-item"]').all()
    expect(activities.length).toBeGreaterThan(0)
    
    // Verify key events are logged
    await expect(page.locator('text=/order assigned/i')).toBeVisible()
    await expect(page.locator('text=/labels printed/i')).toBeVisible()
  })
})