import { Page, BrowserContext } from '@playwright/test'

/**
 * Test isolation helpers to prevent test pollution and ensure clean state
 */

export class TestIsolation {
  /**
   * Clear all browser storage (cookies, localStorage, sessionStorage)
   */
  static async clearBrowserState(page: Page) {
    await page.evaluate(() => {
      localStorage.clear()
      sessionStorage.clear()
      document.cookie.split(";").forEach((c) => {
        document.cookie = c
          .replace(/^ +/, "")
          .replace(/=.*/, "=;expires=" + new Date().toUTCString() + ";path=/")
      })
    })
  }

  /**
   * Reset database to clean state
   * This should be called in beforeEach for tests that modify data
   */
  static async resetDatabase() {
    // Call API endpoint to reset test database
    const response = await fetch('http://localhost:3003/api/test/reset', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Test-Mode': 'true'
      }
    })
    
    if (!response.ok) {
      throw new Error(`Failed to reset database: ${response.statusText}`)
    }
  }

  /**
   * Seed database with test data
   */
  static async seedTestData(scenario: 'minimal' | 'standard' | 'complex') {
    const response = await fetch('http://localhost:3003/api/test/seed', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Test-Mode': 'true'
      },
      body: JSON.stringify({ scenario })
    })
    
    if (!response.ok) {
      throw new Error(`Failed to seed test data: ${response.statusText}`)
    }
    
    return await response.json()
  }

  /**
   * Wait for all network requests to complete
   */
  static async waitForNetworkIdle(page: Page, timeout = 5000) {
    await page.waitForLoadState('networkidle', { timeout })
  }

  /**
   * Take a screenshot with proper naming
   */
  static async screenshot(page: Page, name: string) {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-')
    await page.screenshot({
      path: `test-results/screenshots/${name}-${timestamp}.png`,
      fullPage: true
    })
  }

  /**
   * Check for console errors
   */
  static async checkForConsoleErrors(page: Page): Promise<string[]> {
    const errors: string[] = []
    
    page.on('console', (msg) => {
      if (msg.type() === 'error') {
        errors.push(msg.text())
      }
    })
    
    page.on('pageerror', (error) => {
      errors.push(error.message)
    })
    
    return errors
  }

  /**
   * Mock external API calls
   */
  static async mockExternalAPIs(page: Page) {
    await page.route('**/api/shipstation/**', (route) => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ 
          success: true, 
          data: { mocked: true } 
        })
      })
    })
    
    await page.route('**/api/shopify/**', (route) => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ 
          success: true, 
          products: [] 
        })
      })
    })
  }

  /**
   * Wait for specific API response
   */
  static async waitForAPI(page: Page, endpoint: string) {
    return await page.waitForResponse(
      response => response.url().includes(endpoint) && response.status() === 200
    )
  }

  /**
   * Create isolated test context with fresh state
   */
  static async createIsolatedContext(browser: any): Promise<BrowserContext> {
    const context = await browser.newContext({
      // Disable service workers to avoid caching issues
      serviceWorkers: 'block',
      // Set default timeout
      actionTimeout: 10000,
      // Record videos for debugging
      recordVideo: {
        dir: 'test-results/videos',
        size: { width: 1280, height: 720 }
      }
    })
    
    return context
  }

  /**
   * Clean up after test
   */
  static async cleanup(context: BrowserContext) {
    // Close all pages
    const pages = context.pages()
    for (const page of pages) {
      await page.close()
    }
    
    // Close context
    await context.close()
  }
}