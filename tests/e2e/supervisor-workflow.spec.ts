import { test, expect } from './fixtures/test-setup'
import { testOrders, testSourceContainers } from './fixtures/test-data'

test.describe('Supervisor Workflow', () => {
  
  test('should view and search orders on dashboard', async ({ dashboardPage }) => {
    await dashboardPage.goto()
    await dashboardPage.waitForOrdersToLoad()
    
    // Check orders are visible
    const orderCount = await dashboardPage.getOrderCount()
    expect(orderCount).toBeGreaterThan(0)
    
    // Search for specific order
    await dashboardPage.searchOrder(testOrders.simple.orderNumber)
    const isVisible = await dashboardPage.isOrderVisible(testOrders.simple.orderNumber)
    expect(isVisible).toBeTruthy()
  })
  
  test('should assign items with different workflows', async ({ dashboardPage, workspacePage, page }) => {
    await dashboardPage.goto()
    await dashboardPage.assignOrder(testOrders.complex.orderNumber)
    
    // Should navigate to workspace
    await expect(page).toHaveURL(/\/workspace\//)
    
    // Assign first item with pump_fill workflow
    await workspacePage.assignItem(0, 'pump_fill', testSourceContainers.standard.id)
    
    // Assign second item with direct_resell workflow
    await workspacePage.assignItem(1, 'direct_resell')
    
    // Verify assignments
    const firstItemStatus = await workspacePage.getItemStatus(0)
    expect(firstItemStatus).toContain('Pump & Fill')
    
    const secondItemStatus = await workspacePage.getItemStatus(1)
    expect(secondItemStatus).toContain('Direct Resell')
  })
  
  test('should generate and download PDF labels', async ({ workspacePage }) => {
    const workspaceId = 'test-workspace-001'
    await workspacePage.goto(workspaceId)
    
    // Assign all items first
    await workspacePage.assignItem(0, 'pump_fill', testSourceContainers.standard.id)
    
    // Print labels
    const download = await workspacePage.printLabels()
    expect(download).toBeTruthy()
    
    // Verify PDF was downloaded
    const fileName = download.suggestedFilename()
    expect(fileName).toContain('.pdf')
  })
  
  test('should handle grade mismatch warnings', async ({ workspacePage, page }) => {
    const workspaceId = 'test-workspace-002'
    await workspacePage.goto(workspaceId)
    
    // Try to assign incompatible grade
    await workspacePage.assignItem(0, 'pump_fill', 'FOOD-GRADE-SOURCE')
    
    // Should show warning
    await expect(page.locator('[data-testid="grade-warning"]')).toBeVisible()
    await expect(page.locator('[data-testid="grade-warning"]')).toContainText(/grade mismatch/i)
  })
  
  test('should switch between supervisor and worker views', async ({ workspacePage }) => {
    const workspaceId = 'test-workspace-003'
    await workspacePage.goto(workspaceId)
    
    // Should start in supervisor view
    expect(await workspacePage.isInSupervisorView()).toBeTruthy()
    
    // Switch to worker view
    await workspacePage.switchToWorkerView()
    expect(await workspacePage.isInWorkerView()).toBeTruthy()
    
    // Worker view should show task list
    await expect(workspacePage.page.locator(workspacePage.selectors.taskList)).toBeVisible()
    
    // Switch back to supervisor view
    await workspacePage.switchToSupervisorView()
    expect(await workspacePage.isInSupervisorView()).toBeTruthy()
  })
})  // End of test.describe
