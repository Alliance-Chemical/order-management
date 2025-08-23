import { test as base, expect } from '@playwright/test'
import { Client } from '@modelcontextprotocol/sdk/client/index.js'
import { SSEClientTransport } from '@modelcontextprotocol/sdk/client/sse.js'

export interface MCPTestContext {
  mcpClient: Client
  mcpTabId: string
  callMCPTool: (name: string, args: any) => Promise<any>
}

export const test = base.extend<MCPTestContext>({
  mcpClient: async ({}, use) => {
    const MCP_URL = process.env.MCP_URL || 'http://localhost:8080/sse'
    const transport = new SSEClientTransport(new URL(MCP_URL))
    
    const client = new Client({
      name: 'playwright-mcp-test',
      version: '1.0.0'
    }, {
      capabilities: {}
    })
    
    await client.connect(transport)
    await use(client)
    await client.close()
  },
  
  mcpTabId: async ({ mcpClient }, use) => {
    const result = await mcpClient.callTool({
      name: 'browser_tab_new',
      arguments: {}
    })
    const tabId = result.content[0].text
    
    await use(tabId)
    
    try {
      await mcpClient.callTool({
        name: 'browser_tab_close',
        arguments: { tabId }
      })
    } catch (e) {
      // Ignore cleanup errors
    }
  },
  
  callMCPTool: async ({ mcpClient }, use) => {
    const callTool = async (name: string, args: any) => {
      const result = await mcpClient.callTool({
        name,
        arguments: args
      })
      return result.content[0]?.text || result
    }
    await use(callTool)
  }
})

export { expect }

export class MCPBrowserHelper {
  constructor(
    private client: Client,
    private tabId: string
  ) {}
  
  async navigate(url: string) {
    return await this.client.callTool({
      name: 'browser_navigate',
      arguments: { tabId: this.tabId, url }
    })
  }
  
  async evaluate(code: string) {
    const result = await this.client.callTool({
      name: 'browser_evaluate',
      arguments: { tabId: this.tabId, function: code }
    })
    return result.content[0]?.text
  }
  
  async click(selector: string) {
    return await this.client.callTool({
      name: 'browser_click',
      arguments: { tabId: this.tabId, selector }
    })
  }
  
  async type(selector: string, text: string) {
    return await this.client.callTool({
      name: 'browser_type',
      arguments: { tabId: this.tabId, selector, text }
    })
  }
  
  async waitFor(selector: string, timeout = 5000) {
    return await this.client.callTool({
      name: 'browser_wait_for',
      arguments: { tabId: this.tabId, selector, timeout }
    })
  }
  
  async screenshot(options: { fullPage?: boolean } = {}) {
    return await this.client.callTool({
      name: 'browser_take_screenshot',
      arguments: { tabId: this.tabId, ...options }
    })
  }
  
  async getState() {
    return await this.client.callTool({
      name: 'browser_get_state',
      arguments: { tabId: this.tabId }
    })
  }
}

export async function createMCPBrowser(client: Client, tabId: string) {
  return new MCPBrowserHelper(client, tabId)
}