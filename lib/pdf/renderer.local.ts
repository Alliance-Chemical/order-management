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

    if (typeof page.emulateMedia === 'function') {
      await page.emulateMedia({ media: 'print' });
    } else if (typeof (page as { emulateMediaType?: (type: 'screen' | 'print') => Promise<void> }).emulateMediaType === 'function') {
      await (page as { emulateMediaType: (type: 'screen' | 'print') => Promise<void> }).emulateMediaType('print');
    }

    await page.setContent(htmlContent, { waitUntil: 'networkidle' });

    const pdfOptions: Parameters<typeof page.pdf>[0] = {
      ...(options?.format ? { format: options.format } : {}),
      ...(options?.width ? { width: options.width } : {}),
      ...(options?.height ? { height: options.height } : {}),
      ...(options?.margin ? { margin: options.margin } : {}),
      ...(typeof options?.printBackground !== 'undefined'
        ? { printBackground: options.printBackground }
        : {}),
      ...(typeof options?.preferCSSPageSize !== 'undefined'
        ? { preferCSSPageSize: options.preferCSSPageSize }
        : {}),
    };

    const pdfBuffer = await page.pdf(pdfOptions);
    await browser.close();

    return pdfBuffer as Buffer;
  },
});
