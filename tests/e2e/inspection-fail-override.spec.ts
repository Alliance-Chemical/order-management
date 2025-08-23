import { test, expect, createTestWorkspace } from './fixtures'

test.describe('Inspection fail with override', () => {
  test('failed inspection -> request override -> approve -> use -> advance', async ({ browser, mockShipStation, mockKV }) => {
    // Agent context
    const agentContext = await browser.newContext({
      storageState: 'tests/e2e/.auth/agent.json'
    })
    const agentPage = await agentContext.newPage()
    
    // Supervisor context
    const supervisorContext = await browser.newContext({
      storageState: 'tests/e2e/.auth/supervisor.json'
    })
    const supervisorPage = await supervisorContext.newPage()
    
    // Create workspace
    await createTestWorkspace(agentPage, '555015')
    
    // Agent: Navigate and start inspection
    await agentPage.goto('/workspace/555015')
    await agentPage.request.post('/api/workspace/555015/planning/lock')
    await agentPage.reload()
    
    await agentPage.getByRole('tab', { name: /inspections/i }).click()
    await agentPage.getByRole('button', { name: /start pre-mix/i }).click()
    
    // Agent: Fail inspection
    await agentPage.getByLabel(/check containers/i).check()
    // Leave other items unchecked
    await agentPage.getByLabel(/issue notes/i).fill('Missing safety equipment')
    await agentPage.getByRole('button', { name: /fail inspection/i }).click()
    
    // Agent: Request override
    await agentPage.getByRole('button', { name: /request override/i }).click()
    await agentPage.getByLabel(/reason/i).fill('Equipment on order, proceeding with caution')
    await agentPage.getByRole('button', { name: /submit request/i }).click()
    
    await expect(agentPage.getByText(/override requested/i)).toBeVisible()
    
    // Supervisor: View and approve override
    await supervisorPage.goto('/workspace/555015')
    await supervisorPage.getByRole('tab', { name: /overrides/i }).click()
    
    await expect(supervisorPage.getByText(/pending override/i)).toBeVisible()
    await supervisorPage.getByRole('button', { name: /approve override/i }).click()
    await supervisorPage.getByLabel(/approval notes/i).fill('Approved - proceed with caution')
    await supervisorPage.getByRole('button', { name: /confirm approval/i }).click()
    
    await expect(supervisorPage.getByText(/override approved/i)).toBeVisible()
    
    // Agent: Use approved override
    await agentPage.reload()
    await expect(agentPage.getByText(/override available/i)).toBeVisible()
    await agentPage.getByRole('button', { name: /use override/i }).click()
    
    // Verify phase advanced despite failed inspection
    await expect(agentPage.getByTestId('phase-pill')).toContainText(/mixing/i)
    
    // Verify activity log shows override usage
    await expect(agentPage.getByTestId('activity-list')).toContainText('override_used')
    
    // Cleanup
    await agentContext.close()
    await supervisorContext.close()
  })
})