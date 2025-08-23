import { test as base, Page, BrowserContext } from '@playwright/test'
import { DashboardPage } from '../pages/DashboardPage'
import { WorkspacePage } from '../pages/WorkspacePage'

// Define custom fixtures
type TestFixtures = {
  dashboardPage: DashboardPage
  workspacePage: WorkspacePage
}

// Extend base test with custom fixtures
export const test = base.extend<TestFixtures>({
  // Page object fixtures
  dashboardPage: async ({ page }, use) => {
    const dashboardPage = new DashboardPage(page)
    await use(dashboardPage)
  },
  
  workspacePage: async ({ page }, use) => {
    const workspacePage = new WorkspacePage(page)
    await use(workspacePage)
  }
})

// Export expect from Playwright
export { expect } from '@playwright/test'

// Test hooks for common setup/teardown
export const hooks = {
  beforeEach: async ({ page }: { page: Page }) => {
    // Clear any previous state
    await page.evaluate(() => {
      localStorage.clear()
      sessionStorage.clear()
    })
  },
  
  afterEach: async ({ page }: { page: Page }, testInfo: any) => {
    // Take screenshot on failure
    if (testInfo.status !== 'passed') {
      await page.screenshot({
        path: `test-results/screenshots/${testInfo.title}-failure.png`,
        fullPage: true
      })
    }
  }
}