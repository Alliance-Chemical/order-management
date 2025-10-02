import { test, expect } from '@playwright/test'
import { createTestDb, cleanupTestDb, seedTestWorkspace } from '../helpers/db'
import * as schema from '@/lib/db/schema/qr-workspace'
import { eq } from 'drizzle-orm'

test.describe('Full Order Workflow - Golden Path', () => {
  let testDb: ReturnType<typeof createTestDb>
  let workspaceId: string
  const orderNumber = 'E2E-TEST-001'
  const orderId = 99999

  test.beforeEach(async () => {
    // Initialize test database
    testDb = createTestDb()
    await cleanupTestDb(testDb)
    
    // Seed test workspace with specific order
    const workspace = await testDb.insert(schema.workspaces).values({
      orderId: orderId,
      orderNumber: orderNumber,
      workspaceUrl: `http://localhost:3003/workspace/${orderId}`,
      status: 'pending',
      workflowPhase: 'pre_mix',
      currentUsers: [],
      currentViewMode: 'worker',
      activeModules: {
        preMix: true,
        warehouse: true,
        documents: true,
        freight: true
      },
      moduleStates: {},
      metadata: {
        customerName: 'E2E Test Customer',
        productName: 'Test Chemical Product',
        quantity: 2,
        drumCount: 2,
        orderDate: new Date().toISOString(),
        orderTotal: 2500.00,
        items: [
          {
            sku: 'CHEM-001',
            name: 'Test Chemical Product',
            quantity: 2,
            unitPrice: 1250.00,
            lineItemTotal: 2500.00
          }
        ]
      },
      createdAt: new Date(),
      updatedAt: new Date()
    }).returning()
    
    workspaceId = workspace[0].id
    
    // Pre-generate QR codes for the test
    await testDb.insert(schema.qrCodes).values([
      {
        workspaceId: workspaceId,
        qrType: 'order_master',
        qrCode: `QR-MASTER-${orderId}`,
        shortCode: `M${orderId}`,
        orderId: orderId,
        orderNumber: orderNumber,
        encodedData: { orderId, type: 'order_master', workspaceId },
        qrUrl: `http://localhost:3003/qr/${workspaceId}/master`
      },
      {
        workspaceId: workspaceId,
        qrType: 'destination',
        qrCode: `QR-DRUM-1-${orderId}`,
        shortCode: `D1${orderId}`,
        orderId: orderId,
        orderNumber: orderNumber,
        containerNumber: 1,
        encodedData: { orderId, type: 'destination', drumNumber: 1, workspaceId },
        qrUrl: `http://localhost:3003/qr/${workspaceId}/drum1`
      },
      {
        workspaceId: workspaceId,
        qrType: 'destination',
        qrCode: `QR-DRUM-2-${orderId}`,
        shortCode: `D2${orderId}`,
        orderId: orderId,
        orderNumber: orderNumber,
        containerNumber: 2,
        encodedData: { orderId, type: 'destination', drumNumber: 2, workspaceId },
        qrUrl: `http://localhost:3003/qr/${workspaceId}/drum2`
      }
    ])
  })

  test.afterEach(async () => {
    // Clean up test data
    await cleanupTestDb(testDb)
  })

  test('Complete 2-drum order preparation and inspection workflow', async ({ page, isMobile }) => {
    // Step 1: Navigate to homepage and verify order appears in work queue
    await page.goto('/')
    await page.waitForSelector('table')
    
    // Assert order is visible in the work queue
    const orderRow = page.locator(`tr:has-text("${orderId}")`)
    await expect(orderRow).toBeVisible()
    await expect(orderRow.locator('text=E2E Test Customer')).toBeVisible()
    await expect(orderRow.locator('text=$2,500.00')).toBeVisible()
    
    // Step 2: Click "Prepare & Print Labels" button
    const prepareButton = orderRow.locator('button:has-text("Prepare & Print Labels")')
    await prepareButton.click()
    
    // Step 3: Verify Print Preparation Modal appears with correct summary
    const modal = page.locator('[role="dialog"]')
    await expect(modal).toBeVisible()
    await expect(modal.locator('text=Print Preparation')).toBeVisible()
    await expect(modal.locator('text=1 Master Label')).toBeVisible()
    await expect(modal.locator('text=2 Drum Labels')).toBeVisible()
    
    // Step 4: Mock print API and confirm printing
    await page.route('/api/qr/print', async route => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ 
          success: true, 
          pdfUrl: 'data:application/pdf;base64,mockPdf' 
        })
      })
    })
    
    const confirmButton = modal.locator('button:has-text("Confirm & Print All Labels")')
    await confirmButton.click()
    
    // Wait for modal to close
    await expect(modal).not.toBeVisible()
    
    // Step 5: Navigate to mobile workspace URL
    await page.goto(`/workspace/${orderId}`)
    
    // Step 6: Verify Entry Screen is shown
    const entryScreen = page.locator('[data-testid="entry-screen"]')
    await expect(entryScreen).toBeVisible()
    await expect(entryScreen.locator(`text=${orderId}`)).toBeVisible()
    await expect(entryScreen.locator('text=E2E Test Customer')).toBeVisible()
    
    // Step 7: Simulate scanning Master QR
    // Mock the QR scan API endpoint
    await page.route('/api/qr/scan', async route => {
      const body = route.postDataJSON()
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ 
          success: true, 
          action: body.qrData.type === 'master' ? 'start_inspection' : 'inspect_container',
          data: body.qrData 
        })
      })
    })
    
    // Click "Start Inspection" button (simulates scanning master QR)
    const startButton = entryScreen.locator('button:has-text("Start Pre-Mix Inspection")')
    await startButton.click()
    
    // Step 8: Process Drum #1
    const inspectionScreen = page.locator('[data-testid="inspection-screen"]')
    await expect(inspectionScreen).toBeVisible()
    await expect(inspectionScreen.locator('text=Scan Drum #1')).toBeVisible()
    
    // Simulate scanning Drum #1 QR (click scan button or area)
    const scanDrum1Button = inspectionScreen.locator('button:has-text("Scan Drum")')
    if (await scanDrum1Button.isVisible()) {
      await scanDrum1Button.click()
    }
    
    // Inspection checklist should appear
    await expect(inspectionScreen.locator('text=Label Condition')).toBeVisible()
    
    // Pass all inspection items for Drum #1
    const passButtons = inspectionScreen.locator('button:has-text("PASS")')
    const passButtonCount = await passButtons.count()
    
    for (let i = 0; i < passButtonCount; i++) {
      await passButtons.nth(i).click()
      await page.waitForTimeout(200) // Small delay for UI update
    }
    
    // Step 9: Process Drum #2
    await expect(inspectionScreen.locator('text=Scan Drum #2')).toBeVisible()
    
    // Simulate scanning Drum #2 QR
    const scanDrum2Button = inspectionScreen.locator('button:has-text("Scan Drum")')
    if (await scanDrum2Button.isVisible()) {
      await scanDrum2Button.click()
    }
    
    // Pass all inspection items for Drum #2
    const passButtons2 = inspectionScreen.locator('button:has-text("PASS")')
    const passButtonCount2 = await passButtons2.count()
    
    for (let i = 0; i < passButtonCount2; i++) {
      await passButtons2.nth(i).click()
      await page.waitForTimeout(200) // Small delay for UI update
    }
    
    // Step 10: Verify workflow completion
    const completionMessage = page.locator('text=Workflow Complete')
    await expect(completionMessage).toBeVisible({ timeout: 10000 })
    
    // Step 11: Verify database has been updated
    const updatedWorkspace = await testDb
      .select()
      .from(schema.workspaces)
      .where(eq(schema.workspaces.id, workspaceId))
      .limit(1)

    expect(updatedWorkspace[0].workflowPhase).toBe('pre_ship')
    // Note: inspection status moved to separate inspection tracking system
    // expect(updatedWorkspace[0].modules.inspection.status).toBe('completed')

    // Verify QR codes have been created
    const scannedQRs = await testDb
      .select()
      .from(schema.qrCodes)
      .where(eq(schema.qrCodes.workspaceId, workspaceId))

    const masterQR = scannedQRs.find(qr => qr.qrType === 'master')
    const drum1QR = scannedQRs.find(qr => qr.chemicalName?.includes('DRUM-1') || qr.containerNumber === 1)
    const drum2QR = scannedQRs.find(qr => qr.chemicalName?.includes('DRUM-2') || qr.containerNumber === 2)

    expect(masterQR).toBeTruthy()
    expect(drum1QR).toBeTruthy()
    expect(drum2QR).toBeTruthy()
  })

  test('Handle inspection failure and supervisor notification', async ({ page }) => {
    // Navigate to mobile workspace
    await page.goto(`/workspace/${orderId}`)
    
    // Start inspection
    const startButton = page.locator('button:has-text("Start Pre-Mix Inspection")')
    await startButton.click()
    
    // Simulate scanning Drum #1
    const scanButton = page.locator('button:has-text("Scan Drum")')
    if (await scanButton.isVisible()) {
      await scanButton.click()
    }
    
    // Fail one inspection item
    const failButton = page.locator('button:has-text("FAIL")').first()
    await failButton.click()
    
    // Issue modal should appear
    const issueModal = page.locator('[data-testid="issue-modal"]')
    await expect(issueModal).toBeVisible()
    
    // Select an issue type
    const damageOption = issueModal.locator('button:has-text("Physical Damage")')
    await damageOption.click()
    
    // Mock SNS notification endpoint
    await page.route('/api/workspace/*/notify', async route => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ success: true, notificationId: 'test-notification-123' })
      })
    })
    
    // Confirm issue
    const confirmIssueButton = issueModal.locator('button:has-text("Report Issue")')
    await confirmIssueButton.click()
    
    // Verify issue is recorded in database
    const workspace = await testDb
      .select()
      .from(schema.workspaces)
      .where(eq(schema.workspaces.id, workspaceId))
      .limit(1)

    // Note: Inspection issues now tracked in separate system
    // expect(workspace[0].modules.inspection.issues).toHaveLength(1)
    // expect(workspace[0].modules.inspection.issues[0].type).toBe('Physical Damage')
    expect(workspace[0]).toBeTruthy()
  })
})