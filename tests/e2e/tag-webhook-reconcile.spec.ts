import { test, expect, createTestWorkspace } from './fixtures'

test.describe('Tag webhook reconciliation', () => {
  test('manual ShipStation tag change updates UI phase', async ({ page, mockShipStation }) => {
    // Create workspace
    await createTestWorkspace(page, '555005')
    await page.goto('/workspace/555005')
    
    // Verify initial phase
    await expect(page.getByTestId('phase-pill')).toContainText(/pending|planning/i)
    
    // Simulate manual tag addition in ShipStation via webhook
    const webhookPayload = {
      resource_url: 'https://ssapi.shipstation.com/orders/555005',
      resource_type: 'ORDER_NOTIFY',
      order_id: 555005,
      order_number: 'F-555005',
      tag_ids: [19844, 44777] // Freight Orders + Need Labels (staged)
    }
    
    await page.request.post('/api/shipstation/webhook', {
      data: webhookPayload,
      headers: {
        'X-SS-Webhook-Secret': process.env.SHIPSTATION_WEBHOOK_SECRET || 'test-secret'
      }
    })
    
    // Reload and verify phase updated
    await page.reload()
    await expect(page.getByTestId('phase-pill')).toContainText(/pre[\s_-]?mix/i)
    
    // Send another webhook with ready tag
    await page.request.post('/api/shipstation/webhook', {
      data: {
        ...webhookPayload,
        tag_ids: [19844, 44777, 44123] // + Freight Order Ready
      },
      headers: {
        'X-SS-Webhook-Secret': process.env.SHIPSTATION_WEBHOOK_SECRET || 'test-secret'
      }
    })
    
    await page.reload()
    await expect(page.getByTestId('phase-pill')).toContainText(/ready.*ship/i)
  })
})