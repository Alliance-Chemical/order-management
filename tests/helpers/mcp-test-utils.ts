import { Client } from '@modelcontextprotocol/sdk/client/index.js'

export interface MCPToolResult {
  success: boolean
  data?: any
  error?: string
}

export class MCPTestUtils {
  static async waitForCondition(
    client: Client,
    tabId: string,
    condition: string,
    timeout = 10000,
    interval = 500
  ): Promise<boolean> {
    const startTime = Date.now()
    
    while (Date.now() - startTime < timeout) {
      try {
        const result = await client.callTool({
          name: 'browser_evaluate',
          arguments: { tabId, function: condition }
        })
        
        if (result.content[0]?.text === 'true') {
          return true
        }
      } catch (e) {
        // Continue checking
      }
      
      await new Promise(resolve => setTimeout(resolve, interval))
    }
    
    return false
  }
  
  static async retryMCPCall<T>(
    fn: () => Promise<T>,
    maxRetries = 3,
    delay = 1000
  ): Promise<T> {
    let lastError: any
    
    for (let i = 0; i < maxRetries; i++) {
      try {
        return await fn()
      } catch (error) {
        lastError = error
        if (i < maxRetries - 1) {
          await new Promise(resolve => setTimeout(resolve, delay))
        }
      }
    }
    
    throw lastError
  }
  
  static async getAllTabIds(client: Client): Promise<string[]> {
    const result = await client.callTool({
      name: 'browser_list_tabs',
      arguments: {}
    })
    
    const content = result.content[0]?.text || ''
    const tabIds = content.match(/Tab ID: (\S+)/g)?.map(
      (match: string) => match.replace('Tab ID: ', '')
    ) || []
    
    return tabIds
  }
  
  static async closeAllTabs(client: Client): Promise<void> {
    const tabIds = await this.getAllTabIds(client)
    
    for (const tabId of tabIds) {
      try {
        await client.callTool({
          name: 'browser_tab_close',
          arguments: { tabId }
        })
      } catch (e) {
        // Ignore errors closing tabs
      }
    }
  }
  
  static parseToolResponse(response: any): MCPToolResult {
    try {
      const text = response.content[0]?.text || ''
      
      if (text.includes('Error:')) {
        return {
          success: false,
          error: text
        }
      }
      
      return {
        success: true,
        data: text
      }
    } catch (e) {
      return {
        success: false,
        error: 'Failed to parse response'
      }
    }
  }
  
  static async captureConsoleErrors(
    client: Client,
    tabId: string
  ): Promise<string[]> {
    const result = await client.callTool({
      name: 'browser_evaluate',
      arguments: {
        tabId,
        function: `() => {
          const errors = window.__capturedErrors || [];
          if (!window.__errorCaptureSetup) {
            window.__capturedErrors = [];
            window.__errorCaptureSetup = true;
            window.addEventListener('error', (e) => {
              window.__capturedErrors.push(e.message);
            });
            console.error = new Proxy(console.error, {
              apply(target, thisArg, args) {
                window.__capturedErrors.push(args.join(' '));
                return target.apply(thisArg, args);
              }
            });
          }
          return errors;
        }`
      }
    })
    
    try {
      return JSON.parse(result.content[0]?.text || '[]')
    } catch {
      return []
    }
  }
  
  static async measurePerformance(
    client: Client,
    tabId: string
  ): Promise<{
    loadTime: number
    domContentLoaded: number
    firstContentfulPaint: number
  }> {
    const result = await client.callTool({
      name: 'browser_evaluate',
      arguments: {
        tabId,
        function: `() => {
          const perf = performance.getEntriesByType('navigation')[0];
          const paint = performance.getEntriesByType('paint').find(
            p => p.name === 'first-contentful-paint'
          );
          return {
            loadTime: perf?.loadEventEnd - perf?.fetchStart || 0,
            domContentLoaded: perf?.domContentLoadedEventEnd - perf?.fetchStart || 0,
            firstContentfulPaint: paint?.startTime || 0
          };
        }`
      }
    })
    
    return JSON.parse(result.content[0]?.text || '{}')
  }
}

export class MCPAssertions {
  constructor(
    private client: Client,
    private tabId: string
  ) {}
  
  async assertElementExists(selector: string, timeout = 5000) {
    const exists = await MCPTestUtils.waitForCondition(
      this.client,
      this.tabId,
      `() => !!document.querySelector('${selector}')`,
      timeout
    )
    
    if (!exists) {
      throw new Error(`Element ${selector} not found within ${timeout}ms`)
    }
  }
  
  async assertTextContent(selector: string, expectedText: string) {
    const result = await this.client.callTool({
      name: 'browser_evaluate',
      arguments: {
        tabId: this.tabId,
        function: `() => document.querySelector('${selector}')?.textContent`
      }
    })
    
    const actualText = result.content[0]?.text || ''
    if (!actualText.includes(expectedText)) {
      throw new Error(
        `Expected text "${expectedText}" not found. Got: "${actualText}"`
      )
    }
  }
  
  async assertUrlContains(expectedUrl: string) {
    const result = await this.client.callTool({
      name: 'browser_evaluate',
      arguments: {
        tabId: this.tabId,
        function: '() => window.location.href'
      }
    })
    
    const actualUrl = result.content[0]?.text || ''
    if (!actualUrl.includes(expectedUrl)) {
      throw new Error(
        `Expected URL to contain "${expectedUrl}". Got: "${actualUrl}"`
      )
    }
  }
  
  async assertNoConsoleErrors() {
    const errors = await MCPTestUtils.captureConsoleErrors(
      this.client,
      this.tabId
    )
    
    if (errors.length > 0) {
      throw new Error(
        `Console errors found:\n${errors.join('\n')}`
      )
    }
  }
}