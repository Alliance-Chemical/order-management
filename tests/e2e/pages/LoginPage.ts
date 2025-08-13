import { Page } from '@playwright/test'
import { BasePage } from './BasePage'

export class LoginPage extends BasePage {
  readonly selectors = {
    emailInput: 'input[type="email"], input[name="email"]',
    passwordInput: 'input[type="password"], input[name="password"]',
    submitButton: 'button[type="submit"]',
    errorMessage: '[data-testid="error-message"], .error-message',
    successMessage: '[data-testid="success-message"], .success-message',
    forgotPasswordLink: 'a:has-text("Forgot password")',
    signUpLink: 'a:has-text("Sign up")',
    loadingSpinner: '[data-testid="loading-spinner"]'
  }

  constructor(page: Page) {
    super(page)
  }

  async goto() {
    await this.navigate('/login')
    await this.waitForLoadState()
  }

  async login(email: string, password: string) {
    await this.page.fill(this.selectors.emailInput, email)
    await this.page.fill(this.selectors.passwordInput, password)
    await this.page.click(this.selectors.submitButton)
    
    // Wait for either success (redirect) or error
    await Promise.race([
      this.page.waitForURL('/', { timeout: 5000 }).catch(() => {}),
      this.waitForElement(this.selectors.errorMessage, { timeout: 5000 }).catch(() => {})
    ])
  }

  async loginAsWorker() {
    await this.login('worker@test.com', 'password123')
  }

  async loginAsSupervisor() {
    await this.login('supervisor@test.com', 'password123')
  }

  async loginAsAdmin() {
    await this.login('admin@test.com', 'password123')
  }

  async isLoggedIn(): Promise<boolean> {
    // Check if redirected to dashboard
    return this.page.url().includes('/') && !this.page.url().includes('/login')
  }

  async getErrorMessage(): Promise<string | null> {
    try {
      const error = await this.page.locator(this.selectors.errorMessage)
      if (await error.isVisible()) {
        return await error.innerText()
      }
    } catch {
      // No error message
    }
    return null
  }

  async logout() {
    // Assuming logout is done via API or button
    await this.page.evaluate(() => {
      localStorage.clear()
      sessionStorage.clear()
    })
    await this.page.goto('/login')
  }
}