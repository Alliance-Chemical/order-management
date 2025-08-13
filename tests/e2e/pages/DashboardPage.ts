import { Page } from '@playwright/test'
import { BasePage } from './BasePage'

export class DashboardPage extends BasePage {
  readonly selectors = {
    orderCard: '[data-testid="order-card"]',
    orderNumber: '[data-testid="order-number"]',
    customerName: '[data-testid="customer-name"]',
    orderStatus: '[data-testid="order-status"]',
    assignButton: 'button:has-text("Assign")',
    refreshButton: 'button:has-text("Refresh")',
    searchInput: 'input[placeholder*="Search"]',
    filterDropdown: 'select[data-testid="status-filter"]',
    loadingSpinner: '[data-testid="loading-spinner"]',
    emptyState: '[data-testid="empty-state"]',
    errorMessage: '[data-testid="error-message"]'
  }

  constructor(page: Page) {
    super(page)
  }

  async goto() {
    await this.navigate('/')
    await this.waitForLoadState()
  }

  async waitForOrdersToLoad() {
    await this.page.waitForSelector(this.selectors.orderCard, { 
      state: 'visible',
      timeout: 10000 
    })
  }

  async searchOrder(orderNumber: string) {
    await this.page.fill(this.selectors.searchInput, orderNumber)
    await this.page.waitForTimeout(500) // Debounce delay
  }

  async filterByStatus(status: 'all' | 'pending' | 'in_progress' | 'completed') {
    await this.page.selectOption(this.selectors.filterDropdown, status)
    await this.waitForLoadState('networkidle')
  }

  async clickOrder(orderNumber: string) {
    const orderCard = this.page.locator(this.selectors.orderCard).filter({ 
      hasText: orderNumber 
    })
    await orderCard.click()
  }

  async assignOrder(orderNumber: string) {
    const orderCard = this.page.locator(this.selectors.orderCard).filter({ 
      hasText: orderNumber 
    })
    const assignButton = orderCard.locator(this.selectors.assignButton)
    await assignButton.click()
  }

  async getOrderCount(): Promise<number> {
    const orders = await this.page.locator(this.selectors.orderCard).all()
    return orders.length
  }

  async isOrderVisible(orderNumber: string): Promise<boolean> {
    const orderCard = this.page.locator(this.selectors.orderCard).filter({ 
      hasText: orderNumber 
    })
    return await orderCard.isVisible()
  }

  async refreshOrders() {
    await this.page.click(this.selectors.refreshButton)
    await this.waitForLoadState('networkidle')
  }
}