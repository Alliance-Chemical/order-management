import { Page } from '@playwright/test'
import { BasePage } from './BasePage'

export class WorkspacePage extends BasePage {
  readonly selectors = {
    // View mode controls
    viewToggle: '[data-testid="view-toggle"]',
    supervisorView: 'button:has-text("Supervisor")',
    workerView: 'button:has-text("Worker")',
    
    // Order info
    orderHeader: '[data-testid="order-header"]',
    orderNumber: '[data-testid="order-number"]',
    customerInfo: '[data-testid="customer-info"]',
    
    // Items list
    itemCard: '[data-testid="item-card"]',
    itemStatus: '[data-testid="item-status"]',
    itemName: '[data-testid="item-name"]',
    itemQuantity: '[data-testid="item-quantity"]',
    
    // Assignment modal
    assignmentModal: '[data-testid="assignment-modal"]',
    workflowSelect: 'select[data-testid="workflow-select"]',
    sourceContainerSelect: '[data-testid="source-container-select"]',
    saveAssignment: 'button:has-text("Save")',
    cancelAssignment: 'button:has-text("Cancel")',
    
    // Actions
    printLabelsButton: 'button:has-text("Print All Labels")',
    startInspectionButton: 'button:has-text("Start Inspection")',
    completeButton: 'button:has-text("Complete")',
    
    // QR Scanner
    qrScannerModal: '[data-testid="qr-scanner-modal"]',
    qrScannerVideo: '[data-testid="qr-scanner-video"]',
    manualQrInput: 'input[data-testid="manual-qr-input"]',
    
    // Status indicators
    statusBadge: '[data-testid="status-badge"]',
    progressBar: '[data-testid="progress-bar"]',
    
    // Worker view specific
    taskList: '[data-testid="task-list"]',
    taskItem: '[data-testid="task-item"]',
    scanPrompt: '[data-testid="scan-prompt"]'
  }

  constructor(page: Page) {
    super(page)
  }

  async goto(workspaceId: string) {
    await this.navigate(`/workspace/${workspaceId}`)
    await this.waitForLoadState()
  }

  async switchToSupervisorView() {
    await this.page.click(this.selectors.supervisorView)
    await this.page.waitForTimeout(500)
  }

  async switchToWorkerView() {
    await this.page.click(this.selectors.workerView)
    await this.page.waitForTimeout(500)
  }

  async assignItem(itemIndex: number, workflow: 'pump_fill' | 'direct_resell', sourceContainerId?: string) {
    const items = await this.page.locator(this.selectors.itemCard).all()
    if (itemIndex >= items.length) {
      throw new Error(`Item index ${itemIndex} out of range`)
    }
    
    await items[itemIndex].click()
    await this.waitForElement(this.selectors.assignmentModal)
    
    await this.page.selectOption(this.selectors.workflowSelect, workflow)
    
    if (workflow === 'pump_fill' && sourceContainerId) {
      await this.page.fill(this.selectors.sourceContainerSelect, sourceContainerId)
    }
    
    await this.page.click(this.selectors.saveAssignment)
    await this.page.waitForSelector(this.selectors.assignmentModal, { state: 'hidden' })
  }

  async printLabels() {
    await this.page.click(this.selectors.printLabelsButton)
    const download = await this.page.waitForEvent('download')
    return download
  }

  async startInspection() {
    await this.page.click(this.selectors.startInspectionButton)
    await this.waitForElement(this.selectors.taskList)
  }

  async selectTask(taskIndex: number) {
    const tasks = await this.page.locator(this.selectors.taskItem).all()
    if (taskIndex >= tasks.length) {
      throw new Error(`Task index ${taskIndex} out of range`)
    }
    await tasks[taskIndex].click()
  }

  async scanQRCode(qrCode: string) {
    // Simulate QR scan by entering manually
    await this.waitForElement(this.selectors.qrScannerModal)
    await this.page.fill(this.selectors.manualQrInput, qrCode)
    await this.page.keyboard.press('Enter')
  }

  async completeInspection() {
    await this.page.click(this.selectors.completeButton)
    await this.waitForLoadState('networkidle')
  }

  async getItemStatus(itemIndex: number): Promise<string> {
    const items = await this.page.locator(this.selectors.itemCard).all()
    const statusElement = await items[itemIndex].locator(this.selectors.itemStatus)
    return await statusElement.innerText()
  }

  async getProgress(): Promise<number> {
    const progressText = await this.page.locator(this.selectors.progressBar).getAttribute('aria-valuenow')
    return parseInt(progressText || '0')
  }

  async isInSupervisorView(): Promise<boolean> {
    const supervisorButton = await this.page.locator(this.selectors.supervisorView)
    const ariaPressed = await supervisorButton.getAttribute('aria-pressed')
    return ariaPressed === 'true'
  }

  async isInWorkerView(): Promise<boolean> {
    const workerButton = await this.page.locator(this.selectors.workerView)
    const ariaPressed = await workerButton.getAttribute('aria-pressed')
    return ariaPressed === 'true'
  }
}