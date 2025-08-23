import { test, expect } from './fixtures'

test.describe('Webhook unknown order handling', () => {
  test('unknown order in webhook ignored gracefully', async ({ page }) => {
    // Send webhook for non-existent order
    const response = await page.request.post('/api/shipstation/webhook', {
      data: {
        resource_url: 'https://ssapi.shipstation.com/orders/999999',
        resource_type: 'ORDER_NOTIFY',
        order_id: 999999,
        order_number: 'UNKNOWN-ORDER',
        tag_ids: [19844]
      },
      headers: {
        'X-SS-Webhook-Secret': process.env.SHIPSTATION_WEBHOOK_SECRET || 'test-secret'
      }
    })
    
    // Should return OK (idempotent)
    expect(response.ok()).toBeTruthy()
    
    // Navigate to non-existent workspace
    const navResponse = await page.goto('/workspace/999999', { waitUntil: 'networkidle' })
    
    // Should show not found or empty state
    expect(navResponse?.status()).toBeLessThan(500) // Not a server error
    await expect(page).toHaveURL(/workspace\/999999|not-found|404/)
  })
  
  test('malformed webhook payload handled', async ({ page }) => {
    const response = await page.request.post('/api/shipstation/webhook', {
      data: {
        // Missing required fields
        resource_type: 'ORDER_NOTIFY'
      },
      headers: {
        'X-SS-Webhook-Secret': process.env.SHIPSTATION_WEBHOOK_SECRET || 'test-secret'
      }
    })
    
    // Should handle gracefully
    expect([200, 400].includes(response.status())).toBeTruthy()
  })
  
  test('invalid webhook secret rejected', async ({ page }) => {
    const response = await page.request.post('/api/shipstation/webhook', {
      data: {
        resource_url: 'https://ssapi.shipstation.com/orders/123',
        resource_type: 'ORDER_NOTIFY',
        order_id: 123
      },
      headers: {
        'X-SS-Webhook-Secret': 'wrong-secret'
      }
    })
    
    expect(response.status()).toBe(401)
  })
})