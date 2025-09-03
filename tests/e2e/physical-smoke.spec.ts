import { test, expect } from './fixtures/test-setup'
import { createTestWorkspace } from './fixtures/test-data'

test.describe('Physical Smoke Checklist (assisted)', () => {
  test('Duplicate submit is idempotent', async ({ page }) => {
    const orderId = '777001'
    // Create a workspace via API helper
    const res = await page.request.post('/api/workspaces', {
      data: {
        orderId,
        orderNumber: `TEST-${orderId}`,
        workflowType: 'pump_and_fill',
        workflowPhase: 'pre_ship_inspection',
        items: [{ name: 'Test Drum', quantity: 1, sku: 'SKU-1' }],
      }
    })
    expect(res.ok()).toBeTruthy()

    const idempotencyKey = `test-${Date.now()}`
    // First submit
    const first = await page.request.post(`/api/workspaces/${orderId}/inspection/pre_ship_inspection`, {
      data: { result: 'pass', data: { note: 'OK' }, idempotencyKey, userId: 'tester' }
    })
    expect(first.ok()).toBeTruthy()

    // Rapid duplicate
    const second = await page.request.post(`/api/workspaces/${orderId}/inspection/pre_ship_inspection`, {
      data: { result: 'pass', data: { note: 'OK' }, idempotencyKey, userId: 'tester' }
    })
    expect(second.status()).toBe(409)
  })

  test('Big print request is allowed (mocked)', async ({ page }) => {
    await page.route('/api/qr/print', async route => {
      const req = route.request()
      const body = req.postDataJSON() as any
      expect(Array.isArray(body.qrCodes)).toBeTruthy()
      expect(body.qrCodes.length).toBeGreaterThanOrEqual(200)
      // Return a tiny fake PDF
      const pdfBytes = new Uint8Array([0x25,0x50,0x44,0x46,0x2D,0x31,0x2E,0x33,0x0A,0x25,0xE2,0xE3,0xCF,0xD3,0x0A,0x0A,0x0A])
      await route.fulfill({ status: 200, headers: { 'Content-Type': 'application/pdf' }, body: Buffer.from(pdfBytes) })
    })

    const resp = await page.request.post('/api/qr/print', {
      data: {
        qrCodes: Array.from({ length: 200 }, (_, i) => ({ shortCode: `DUMMY${i}` })),
        labelSize: '4x6'
      }
    })
    expect(resp.ok()).toBeTruthy()
  })
})

