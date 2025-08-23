import { test as base, Page } from '@playwright/test';
import { v4 as uuidv4 } from 'uuid';

// Extend the base test with custom fixtures
export const test = base.extend({
  mockKV: async ({ page }, use) => {
    const mock = {
      enqueue: async () => {},
      process: async () => {},
      stats: async () => ({ ready: 0, scheduled: 0, dead: 0 })
    };
    await use(mock);
  },
  mockShipStation: async ({ page }, use) => {
    const mock = {
      getOrder: async (orderId: string) => ({
        orderId,
        orderNumber: `TEST-${orderId}`,
        orderStatus: 'awaiting_shipment',
        tagIds: []
      }),
      updateOrder: async (orderId: string, data: any) => ({
        success: true,
        orderId,
        ...data
      }),
      addTag: async (orderId: string, tagId: string) => ({
        success: true,
        orderId,
        tagId
      }),
      removeTag: async (orderId: string, tagId: string) => ({
        success: true,
        orderId,
        tagId
      })
    };
    await use(mock);
  }
});

export { expect } from '@playwright/test';

export async function createTestWorkspace(page: Page, orderId: string, options: any = {}) {
  // Add random suffix to make orderId unique for each test run
  const randomSuffix = Math.floor(Math.random() * 10000);
  const uniqueOrderId = `${orderId}${randomSuffix}`;
  
  const workspaceData = {
    orderId: uniqueOrderId,
    orderNumber: options.orderNumber || `TEST-${uniqueOrderId}`,
    customerName: options.customerName || 'Test Customer',
    workflowType: options.workflowType || 'pump_and_fill',
    workflowPhase: options.workflowPhase || 'planning',
    items: options.items || [
      { name: 'Test Item 1', quantity: 2, sku: 'TEST-1' },
      { name: 'Test Item 2', quantity: 1, sku: 'TEST-2' }
    ],
    activeModules: {
      pallets: true,
      lots: true, 
      qr: true,
      inspections: true,
      sync: true,
      presence: true,
      overrides: true
    }
  };

  // Create workspace via API
  const response = await page.request.post('/api/workspaces', {
    data: workspaceData
  });

  if (!response.ok()) {
    throw new Error('Failed to create workspace');
  }

  const workspace = await response.json();

  // Navigate to workspace with unique ID
  await page.goto(`/workspace/${uniqueOrderId}`);
  
  // Wait for page to load
  await page.waitForLoadState('networkidle');
  
  // Return workspace with uniqueOrderId so tests can use it
  return { ...workspace, uniqueOrderId };
}

export async function loginAs(page: Page, role: 'worker' | 'supervisor' | 'admin') {
  // For now, tests run without auth
  // In real scenario, would login here
  return true;
}

export async function mockKV(page: Page) {
  // Mock KV operations if needed
  return {
    enqueue: async () => {},
    process: async () => {},
    stats: async () => ({ ready: 0, scheduled: 0, dead: 0 })
  };
}
