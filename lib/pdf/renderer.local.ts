/**
 * PDF Renderer for Local Development
 * Uses Playwright
 */

import type { PDFRenderer, PDFOptions } from './types';

export const createLocalRenderer = (): PDFRenderer => ({
  async renderPDF(htmlContent: string, options?: PDFOptions): Promise<Buffer> {
    // Dynamic import only evaluated locally
    const { chromium } = await import('playwright');

    const browser = await chromium.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox'],
    });

    const page = await browser.newPage();

    // Emulate print media
    if ('emulateMedia' in page) {
      await (page as any).emulateMedia({ media: 'print' });
    } else if ('emulateMediaType' in page) {
      await (page as any).emulateMediaType('print');
    }

    await page.setContent(htmlContent, { waitUntil: 'networkidle' as any });

    const pdfBuffer = await page.pdf(options as any);
    await browser.close();

    return pdfBuffer as Buffer;
  },
});
