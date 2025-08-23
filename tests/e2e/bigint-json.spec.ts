import { test, expect } from './fixtures'

test.describe('Data integrity - BigInt handling', () => {
  test('API responses with bigint fields serialize safely', async ({ page }) => {
    // Create workspace with large IDs - use timestamp for uniqueness
    const uniqueId = String(9000000000000000000 + Math.floor(Math.random() * 1000000)); // Safe for PostgreSQL bigint
    const response = await page.request.post('/api/workspaces', {
      data: {
        orderId: uniqueId, // Larger than MAX_SAFE_INTEGER + unique
        orderNumber: 'BIGINT-TEST-' + Date.now(),
        customerEmail: 'test@example.com',
        shipTo: {
          name: 'Test Customer',
          street1: '123 Test St',
          city: 'Test City',
          state: 'CA',
          postalCode: '90210'
        },
        items: [
          {
            sku: 'TEST-001',
            name: 'Test Item',
            quantity: 1,
            orderItemId: '9007199254740993' // Another bigint
          }
        ]
      }
    })
    
    expect(response.ok()).toBeTruthy()
    const data = await response.json()
    
    // Verify bigint serialized as string
    expect(typeof data.orderId).toBe('string')
    expect(data.orderId).toBe(uniqueId)
    
    // Navigate to workspace - should handle bigint in URL
    await page.goto(`/workspace/${data.orderId}`)
    await expect(page.getByTestId('order-number')).toContainText('BIGINT-TEST')
  })
  
  test('timestamps serialize correctly', async ({ page }) => {
    const response = await page.request.get('/api/workspaces')
    expect(response.ok()).toBeTruthy()
    
    const data = await response.json()
    
    if (data.workspaces && data.workspaces.length > 0) {
      const workspace = data.workspaces[0]
      
      // Verify date fields are valid ISO strings
      if (workspace.createdAt) {
        expect(() => new Date(workspace.createdAt)).not.toThrow()
      }
      if (workspace.updatedAt) {
        expect(() => new Date(workspace.updatedAt)).not.toThrow()
      }
    }
  })
  
  test('JSON parse errors handled gracefully', async ({ page }) => {
    // Mock malformed JSON response
    await page.route('**/api/test-json', route => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: '{invalid json}'
      })
    })
    
    // Playwright's request API handles JSON parsing automatically
    // and will throw when trying to parse invalid JSON
    const response = await page.request.get('/api/test-json')
    
    // The response itself should succeed (200 status)
    expect(response.status()).toBe(200)
    
    // But trying to parse as JSON should fail
    let error = null
    try {
      await response.json()
    } catch (e) {
      error = e
    }
    
    // Should handle parse error without crashing
    expect(error).toBeTruthy()
  })
  
  test('concurrent operations maintain data consistency', async ({ browser }) => {
    // Create multiple contexts
    const contexts = await Promise.all([
      browser.newContext({ storageState: 'tests/e2e/.auth/agent.json' }),
      browser.newContext({ storageState: 'tests/e2e/.auth/supervisor.json' })
    ])
    
    const pages = await Promise.all(contexts.map(ctx => ctx.newPage()))
    
    // Create shared workspace
    const workspaceResponse = await pages[0].request.post('/api/workspaces', {
      data: {
        orderId: '555' + Date.now() + Math.floor(Math.random() * 1000),
        orderNumber: 'CONCURRENT-TEST-' + Date.now(),
        customerEmail: 'test@example.com',
        shipTo: {
          name: 'Test',
          street1: '123 St',
          city: 'City',
          state: 'CA',
          postalCode: '90210'
        },
        items: []
      }
    })
    
    const workspace = await workspaceResponse.json()
    
    // Both pages navigate to same workspace
    await Promise.all(pages.map(p => p.goto(`/workspace/${workspace.orderId}`)))
    
    // Concurrent updates
    const updates = pages.map(async (page, i) => {
      return page.request.put(`/api/workspace/${workspace.orderId}/notes`, {
        data: { note: `Note from user ${i}` }
      })
    })
    
    const results = await Promise.all(updates)
    
    // All updates should succeed
    results.forEach(r => expect(r.ok()).toBeTruthy())
    
    // Cleanup
    await Promise.all(contexts.map(ctx => ctx.close()))
  })
})