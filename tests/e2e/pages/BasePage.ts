import { Page, Locator, expect } from '@playwright/test'

export class BasePage {
  constructor(public readonly page: Page) {}

  async navigate(path: string) {
    await this.page.goto(path)
  }

  async waitForLoadState(state: 'load' | 'domcontentloaded' | 'networkidle' = 'networkidle') {
    await this.page.waitForLoadState(state)
  }

  async takeScreenshot(name: string) {
    await this.page.screenshot({ path: `test-results/screenshots/${name}.png`, fullPage: true })
  }

  async waitForElement(selector: string, options?: { timeout?: number; state?: 'visible' | 'hidden' | 'attached' | 'detached' }) {
    await this.page.waitForSelector(selector, options)
  }

  async clickAndWait(selector: string, waitFor?: string) {
    await this.page.click(selector)
    if (waitFor) {
      await this.waitForElement(waitFor)
    }
  }

  async fillForm(fields: Record<string, string>) {
    for (const [selector, value] of Object.entries(fields)) {
      await this.page.fill(selector, value)
    }
  }

  async expectText(selector: string, text: string | RegExp) {
    await expect(this.page.locator(selector)).toContainText(text)
  }

  async expectVisible(selector: string) {
    await expect(this.page.locator(selector)).toBeVisible()
  }

  async expectHidden(selector: string) {
    await expect(this.page.locator(selector)).toBeHidden()
  }

  async getInnerText(selector: string): Promise<string> {
    return await this.page.locator(selector).innerText()
  }

  async waitForResponse(urlPattern: string | RegExp) {
    return await this.page.waitForResponse(urlPattern)
  }
}