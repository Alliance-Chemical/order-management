import { test, expect } from './fixtures'

test.describe('Workspace creation from webhook', () => {
  test('webhook creates workspace and mirrors tags', async ({ page, mockShipStation }) => {
    // Simulate incoming webhook
    const webhookPayload = {
      resource_url: 'https://ssapi.shipstation.com/orders/555001',
      resource_type: 'ORDER_NOTIFY',
      order_id: 555001,
      order_number: 'F-1001',
      tag_ids: [19844] // Freight Orders tag
    }
    
    const response = await page.request.post('/api/shipstation/webhook', {
      data: webhookPayload,
      headers: {
        'X-SS-Webhook-Secret': process.env.SHIPSTATION_WEBHOOK_SECRET || 'test-secret'
      }
    })
    
    expect(response.ok()).toBeTruthy()
    
    // Navigate to the created workspace
    await page.goto('/workspace/555001')
    
    // Verify workspace was created with correct data
    await expect(page.getByTestId('order-number')).toContainText('F-1001')
    await expect(page.getByTestId('workspace-tags')).toContainText('Freight Orders')
    
    // Check activity log
    await expect(page.getByTestId('activity-list')).toContainText('workspace_created')
  })
})