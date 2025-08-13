import { test as base, Page, BrowserContext } from '@playwright/test'
import { DashboardPage } from '../pages/DashboardPage'
import { WorkspacePage } from '../pages/WorkspacePage'
import { LoginPage } from '../pages/LoginPage'
import { testUsers } from './test-data'

// Define custom fixtures
type TestFixtures = {
  dashboardPage: DashboardPage
  workspacePage: WorkspacePage
  loginPage: LoginPage
  authenticatedPage: Page
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
  },
  
  loginPage: async ({ page }, use) => {
    const loginPage = new LoginPage(page)
    await use(loginPage)
  },
  
  // Authenticated page fixture
  authenticatedPage: async ({ page, context }, use) => {
    // Set up authentication state
    await setupAuth(context, 'supervisor')
    await use(page)
  }
})

// Helper function to set up authentication
async function setupAuth(context: BrowserContext, role: 'worker' | 'supervisor' | 'admin') {
  const user = testUsers[role]
  
  // Set auth cookies/tokens
  // This would normally interact with your auth system
  // For now, we'll set a mock auth state
  await context.addCookies([
    {
      name: 'auth-token',
      value: `test-token-${role}`,
      domain: 'localhost',
      path: '/',
      httpOnly: true,
      secure: false,
      sameSite: 'Lax'
    }
  ])
  
  // Set local storage if needed
  await context.addInitScript(() => {
    localStorage.setItem('user-role', role)
    localStorage.setItem('authenticated', 'true')
  })
}

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