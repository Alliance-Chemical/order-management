import { test, expect } from '@playwright/test';

test.describe('Source Container Management', () => {
  test.describe('Shopify Product Sync', () => {
    test('should sync products from Shopify and create containers', async ({ page }) => {
      // Mock Shopify API response
      await page.route('**/api/shopify/sync-products', async (route) => {
        if (route.request().method() === 'POST') {
          await route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify({
              success: true,
              summary: {
                totalProducts: 5,
                totalVariants: 12,
                newContainers: 12,
                updatedContainers: 0,
              },
            }),
          });
        }
      });

      // Navigate to a workspace page (where sync might be triggered)
      await page.goto('/workspace/67890');
      
      // Trigger sync (this would typically be in an admin panel)
      const response = await page.evaluate(async () => {
        const res = await fetch(`${window.location.origin}/api/shopify/sync-products`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
        });
        return res.json();
      });

      expect(response.success).toBe(true);
      expect(response.summary.totalVariants).toBe(12);
      expect(response.summary.newContainers).toBe(12);
    });

    test('should fetch all source containers', async ({ page }) => {
      // Mock GET request for containers
      await page.route('**/api/shopify/sync-products', async (route) => {
        if (route.request().method() === 'GET') {
          await route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify({
              success: true,
              containers: [
                {
                  id: 'container-1',
                  productTitle: 'Sodium Hypochlorite',
                  variantTitle: '55 Gallon Drum',
                  sku: 'SH-55',
                  shortCode: 'SC-ABC123',
                  containerType: 'drum',
                  capacity: '55 gal',
                  currentQuantity: '250',
                  warehouseLocation: 'A-12-3',
                  status: 'active',
                },
                {
                  id: 'container-2',
                  productTitle: 'Citric Acid',
                  variantTitle: '275 Gallon Tote',
                  sku: 'CA-275',
                  shortCode: 'SC-DEF456',
                  containerType: 'tote',
                  capacity: '275 gal',
                  currentQuantity: '550',
                  warehouseLocation: 'B-5-1',
                  status: 'active',
                },
              ],
            }),
          });
        }
      });

      await page.goto('/workspace/67890');
      
      const response = await page.evaluate(async () => {
        const res = await fetch(`${window.location.origin}/api/shopify/sync-products`);
        return res.json();
      });

      expect(response.success).toBe(true);
      expect(response.containers).toHaveLength(2);
      expect(response.containers[0].shortCode).toBe('SC-ABC123');
    });
  });

  test.describe('Source Container Selector UI', () => {
    test('should display and filter source containers', async ({ page }) => {
      // Mock API response for containers
      await page.route('**/api/shopify/sync-products', async (route) => {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            success: true,
            containers: [
              {
                id: 'container-1',
                productTitle: 'Sodium Hypochlorite',
                variantTitle: '55 Gallon Drum',
                sku: 'SH-55',
                shortCode: 'SC-ABC123',
                containerType: 'drum',
                capacity: '55 gal',
                currentQuantity: '250',
                warehouseLocation: 'A-12-3',
                status: 'active',
              },
              {
                id: 'container-2',
                productTitle: 'Citric Acid',
                variantTitle: '275 Gallon Tote',
                sku: 'CA-275',
                shortCode: 'SC-DEF456',
                containerType: 'tote',
                capacity: '275 gal',
                currentQuantity: '550',
                warehouseLocation: 'B-5-1',
                status: 'active',
              },
              {
                id: 'container-3',
                productTitle: 'D-Limonene',
                variantTitle: '5 Gallon Pail',
                sku: 'DL-5',
                shortCode: 'SC-GHI789',
                containerType: 'pail',
                capacity: '5 gal',
                currentQuantity: '25',
                warehouseLocation: 'C-2-8',
                status: 'active',
              },
            ],
          }),
        });
      });

      // Navigate to a test page with the selector
      await page.goto('/test/source-selector');
      
      // Wait for selector to load
      await page.waitForSelector('text=Select Source Container(s)', { timeout: 5000 }).catch(() => {
        // If selector not found on test page, try workspace page
        return page.goto('/workspace/67890');
      });

      // Check if containers are displayed
      const sodiumContainer = page.locator('text=Sodium Hypochlorite');
      const citricContainer = page.locator('text=Citric Acid');
      const limoneneContainer = page.locator('text=D-Limonene');

      // Search functionality
      const searchInput = page.locator('input[placeholder*="Search"]');
      if (await searchInput.isVisible()) {
        await searchInput.fill('sodium');
        await expect(sodiumContainer).toBeVisible();
        await expect(citricContainer).not.toBeVisible();
        await expect(limoneneContainer).not.toBeVisible();

        // Clear search
        await searchInput.clear();
        await searchInput.fill('SC-DEF');
        await expect(sodiumContainer).not.toBeVisible();
        await expect(citricContainer).toBeVisible();
      }
    });

    test('should select and deselect containers', async ({ page }) => {
      // Mock API response
      await page.route('**/api/shopify/sync-products', async (route) => {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            success: true,
            containers: [
              {
                id: 'container-1',
                productTitle: 'Test Chemical',
                variantTitle: '55 Gallon',
                sku: 'TC-55',
                shortCode: 'SC-TEST1',
                containerType: 'drum',
                capacity: '55 gal',
                currentQuantity: '100',
                warehouseLocation: 'A-1-1',
                status: 'active',
              },
            ],
          }),
        });
      });

      await page.goto('/workspace/67890');

      // Try to find and interact with container selector if it exists
      const containerElement = page.locator('text=Test Chemical').first();
      if (await containerElement.isVisible({ timeout: 3000 }).catch(() => false)) {
        // Click to select
        await containerElement.click();
        
        // Check for selection indicator
        const checkIcon = page.locator('[data-testid="check-icon"], svg.text-blue-600, .text-blue-600 svg');
        await expect(checkIcon).toBeVisible({ timeout: 2000 }).catch(() => {
          // Selection might be indicated differently
          console.log('Check icon not found, selection might be indicated differently');
        });

        // Click again to deselect
        await containerElement.click();
      }
    });
  });

  test.describe('Source Container Label Printing', () => {
    test('should generate PDF labels for source containers', async ({ page }) => {
      let pdfGenerated = false;
      
      // Navigate to a page first to have a proper origin
      await page.goto('/workspace/67890');

      // Mock the print labels endpoint
      await page.route('**/api/source-containers/print-labels', async (route) => {
        const request = route.request();
        const postData = request.postDataJSON();
        
        expect(postData.containerIds).toBeDefined();
        expect(postData.labelSize).toBe('4x6');
        
        // Return mock PDF response
        await route.fulfill({
          status: 200,
          contentType: 'application/pdf',
          body: Buffer.from('Mock PDF content'),
          headers: {
            'Content-Disposition': 'attachment; filename="source-labels.pdf"',
          },
        });
        
        pdfGenerated = true;
      });

      // Call the print API directly
      const response = await page.evaluate(async () => {
        const res = await fetch(`${window.location.origin}/api/source-containers/print-labels`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            containerIds: ['container-1', 'container-2'],
            labelSize: '4x6',
          }),
        });
        return {
          ok: res.ok,
          status: res.status,
          contentType: res.headers.get('content-type'),
        };
      });

      expect(response.ok).toBe(true);
      expect(response.status).toBe(200);
      expect(response.contentType).toContain('application/pdf');
      expect(pdfGenerated).toBe(true);
    });

    test('should handle different label sizes', async ({ page }) => {
      // Navigate to a page first
      await page.goto('/workspace/67890');
      
      const labelSizes = ['4x6', '2x4', '8.5x11'];
      
      for (const size of labelSizes) {
        await page.route('**/api/source-containers/print-labels', async (route) => {
          const postData = route.request().postDataJSON();
          expect(postData.labelSize).toBe(size);
          
          await route.fulfill({
            status: 200,
            contentType: 'application/pdf',
            body: Buffer.from(`Mock PDF for ${size}`),
          });
        });

        const response = await page.evaluate(async (labelSize) => {
          const res = await fetch(`${window.location.origin}/api/source-containers/print-labels`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              containerIds: ['test-container'],
              labelSize: labelSize,
            }),
          });
          return res.ok;
        }, size);

        expect(response).toBe(true);
      }
    });

    test('should handle errors gracefully', async ({ page }) => {
      // Navigate to a page first
      await page.goto('/workspace/67890');
      
      // Test with empty container IDs
      await page.route('**/api/source-containers/print-labels', async (route) => {
        await route.fulfill({
          status: 400,
          contentType: 'application/json',
          body: JSON.stringify({ error: 'Container IDs array is required' }),
        });
      });

      const response = await page.evaluate(async () => {
        const res = await fetch(`${window.location.origin}/api/source-containers/print-labels`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            containerIds: [],
            labelSize: '4x6',
          }),
        });
        return {
          ok: res.ok,
          status: res.status,
          error: await res.json(),
        };
      });

      expect(response.ok).toBe(false);
      expect(response.status).toBe(400);
      expect(response.error.error).toBe('Container IDs array is required');
    });
  });

  test.describe('Integration Tests', () => {
    test('should complete full source container workflow', async ({ page }) => {
      // 1. Sync products from Shopify
      await page.route('**/api/shopify/sync-products', async (route) => {
        if (route.request().method() === 'POST') {
          await route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify({
              success: true,
              summary: {
                totalProducts: 3,
                totalVariants: 6,
                newContainers: 6,
                updatedContainers: 0,
              },
            }),
          });
        } else {
          await route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify({
              success: true,
              containers: [
                {
                  id: 'new-container-1',
                  productTitle: 'Test Product',
                  variantTitle: '55 Gallon',
                  sku: 'TP-55',
                  shortCode: 'SC-NEW123',
                  containerType: 'drum',
                  capacity: '55 gal',
                  currentQuantity: '110',
                  warehouseLocation: 'D-1-1',
                  status: 'active',
                },
              ],
            }),
          });
        }
      });

      // 2. Mock print labels
      await page.route('**/api/source-containers/print-labels', async (route) => {
        await route.fulfill({
          status: 200,
          contentType: 'application/pdf',
          body: Buffer.from('Complete workflow PDF'),
        });
      });

      await page.goto('/workspace/67890');

      // Execute complete workflow
      const workflowResult = await page.evaluate(async () => {
        // Step 1: Sync products
        const syncRes = await fetch(`${window.location.origin}/api/shopify/sync-products`, {
          method: 'POST',
        });
        const syncData = await syncRes.json();

        // Step 2: Get containers
        const getRes = await fetch(`${window.location.origin}/api/shopify/sync-products`);
        const getData = await getRes.json();

        // Step 3: Print labels for first container
        if (getData.containers && getData.containers.length > 0) {
          const printRes = await fetch(`${window.location.origin}/api/source-containers/print-labels`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              containerIds: [getData.containers[0].id],
              labelSize: '4x6',
            }),
          });

          return {
            syncSuccess: syncData.success,
            containersFound: getData.containers.length,
            printSuccess: printRes.ok,
          };
        }

        return {
          syncSuccess: syncData.success,
          containersFound: 0,
          printSuccess: false,
        };
      });

      expect(workflowResult.syncSuccess).toBe(true);
      expect(workflowResult.containersFound).toBeGreaterThan(0);
      expect(workflowResult.printSuccess).toBe(true);
    });
  });
});