import { test, expect, createTestWorkspace } from './fixtures'

test.describe('Offline queue', () => {
  test.use({ storageState: 'tests/e2e/.auth/agent.json' })
  
  test('inspection enqueues offline and flushes when online', async ({ page }) => {
    await createTestWorkspace(page, '555027')
    await page.goto('/workspace/555027')
    
    // Navigate to inspections
    await page.getByRole('tab', { name: /inspections/i }).click()
    
    // Block network for workspace API
    await page.route('**/api/workspace/**', route => route.abort())
    
    // Start inspection
    await page.getByRole('button', { name: /start.*inspection/i }).first().click()
    
    // Complete inspection while offline
    await page.getByLabel(/check.*item/i).first().check()
    await page.getByRole('button', { name: /submit/i }).click()
    
    // Should show offline indicator
    await expect(page.getByText(/saved offline|queued/i)).toBeVisible()
    
    // Verify localStorage has queued operation
    const queueLength = await page.evaluate(() => {
      const queue = JSON.parse(localStorage.getItem('inspection_queue') || '[]')
      return queue.length
    })
    expect(queueLength).toBeGreaterThan(0)
    
    // Restore network
    await page.unroute('**/api/workspace/**')
    
    // Simulate online event
    await page.evaluate(() => window.dispatchEvent(new Event('online')))
    
    // Wait for queue to drain
    await expect.poll(async () => {
      return await page.evaluate(() => {
        const queue = JSON.parse(localStorage.getItem('inspection_queue') || '[]')
        return queue.length
      })
    }).toBe(0)
    
    // Verify data was synced
    await page.reload()
    await expect(page.getByTestId('activity-list')).toContainText('inspection')
  })
  
  test('multiple offline operations queue correctly', async ({ page }) => {
    await createTestWorkspace(page, '555028')
    await page.goto('/workspace/555028')
    
    // Block network
    await page.route('**/api/workspace/**', route => route.abort())
    
    // Perform multiple operations
    const operations = [
      async () => {
        await page.getByRole('tab', { name: /notes/i }).click()
        await page.getByLabel(/add note/i).fill('Offline note 1')
        await page.getByRole('button', { name: /save/i }).click()
      },
      async () => {
        await page.getByLabel(/add note/i).fill('Offline note 2')
        await page.getByRole('button', { name: /save/i }).click()
      },
      async () => {
        await page.getByLabel(/add note/i).fill('Offline note 3')
        await page.getByRole('button', { name: /save/i }).click()
      }
    ]
    
    for (const op of operations) {
      await op()
      await page.waitForTimeout(100)
    }
    
    // Check queue length
    const queueLength = await page.evaluate(() => {
      const queue = JSON.parse(localStorage.getItem('offline_queue') || '[]')
      return queue.length
    })
    expect(queueLength).toBe(3)
    
    // Restore network and flush
    await page.unroute('**/api/workspace/**')
    await page.evaluate(() => window.dispatchEvent(new Event('online')))
    
    // Wait for all to process
    await expect.poll(async () => {
      return await page.evaluate(() => {
        const queue = JSON.parse(localStorage.getItem('offline_queue') || '[]')
        return queue.length
      })
    }, { timeout: 10000 }).toBe(0)
  })
  
  test('offline indicator shows when network is down', async ({ page }) => {
    await createTestWorkspace(page, '555029')
    await page.goto('/workspace/555029')
    
    // Initially online
    await expect(page.getByTestId('network-status')).toContainText(/online/i)
    
    // Block network
    await page.route('**/api/**', route => route.abort())
    
    // Trigger offline detection
    await page.evaluate(() => window.dispatchEvent(new Event('offline')))
    
    // Should show offline indicator
    await expect(page.getByTestId('network-status')).toContainText(/offline/i)
    
    // Restore
    await page.unroute('**/api/**')
    await page.evaluate(() => window.dispatchEvent(new Event('online')))
    
    await expect(page.getByTestId('network-status')).toContainText(/online/i)
  })
})