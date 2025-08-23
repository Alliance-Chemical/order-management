import { test, expect, createTestWorkspace } from './fixtures'

test.describe('KV queue processing', () => {
  test.use({ storageState: 'tests/e2e/.auth/supervisor.json' })
  
  test('generate_qr job processes and logs activity', async ({ page, mockKV }) => {
    await createTestWorkspace(page, '555025')
    await page.goto('/workspace/555025')
    
    // Trigger QR generation (enqueues job)
    await page.getByRole('button', { name: /generate qr/i }).click()
    
    // Manually trigger queue processor
    const response = await page.request.post('/api/queue/process')
    expect(response.ok()).toBeTruthy()
    
    const body = await response.json()
    expect(body.processed).toBeGreaterThanOrEqual(0)
    
    // Reload and check activity log
    await page.reload()
    await expect(page.getByTestId('activity-list')).toContainText('qr_generation_requested')
    
    // Check QRs were generated
    await page.getByRole('tab', { name: /qr codes/i }).click()
    await expect(page.getByTestId('qr-master')).toBeVisible()
  })
  
  test('dead letter queue handles failures', async ({ page, mockKV }) => {
    await createTestWorkspace(page, '555026')
    
    // Enqueue a job that will fail
    await page.request.post('/api/queue/enqueue', {
      data: {
        type: 'test_fail',
        data: { shouldFail: true },
        workspaceId: '555026'
      }
    })
    
    // Process - should move to DLQ
    await page.request.post('/api/queue/process')
    
    // Check stats
    const statsResponse = await page.request.get('/api/queue/stats')
    const stats = await statsResponse.json()
    
    expect(stats.deadLetter.count).toBeGreaterThan(0)
    
    // Retry from DLQ
    await page.request.post('/api/queue/retry-dlq')
    
    // Check stats again
    const retryStats = await page.request.get('/api/queue/stats')
    const retryData = await retryStats.json()
    
    expect(retryData.deadLetter.count).toBe(0)
  })
  
  test('queue stats endpoint shows metrics', async ({ page }) => {
    const response = await page.request.get('/api/queue/stats')
    expect(response.ok()).toBeTruthy()
    
    const stats = await response.json()
    
    // Verify stats structure
    expect(stats).toHaveProperty('pending')
    expect(stats).toHaveProperty('processing')
    expect(stats).toHaveProperty('deadLetter')
    expect(stats.pending).toHaveProperty('count')
    expect(stats.processing).toHaveProperty('count')
    expect(stats.deadLetter).toHaveProperty('count')
  })
})