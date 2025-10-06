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
    const pageWithMedia = page as unknown as {
      emulateMedia?: (options?: { media?: 'screen' | 'print' }) => Promise<void>;
      emulateMediaType?: (type: 'screen' | 'print') => Promise<void>;
    };

    if (typeof pageWithMedia.emulateMedia === 'function') {
      await pageWithMedia.emulateMedia({ media: 'print' });
    } else if (typeof pageWithMedia.emulateMediaType === 'function') {
      await pageWithMedia.emulateMediaType('print');
    }

    await page.setContent(htmlContent, { waitUntil: 'networkidle' });

    type PlaywrightPdfOptions = NonNullable<Parameters<typeof page.pdf>[0]>;
    const pdfOptions: PlaywrightPdfOptions = {};

    if (options?.format) {
      pdfOptions.format = options.format as PlaywrightPdfOptions['format'];
    }

    if (options?.width) {
      pdfOptions.width = options.width;
    }

    if (options?.height) {
      pdfOptions.height = options.height;
    }

    if (options?.margin) {
      pdfOptions.margin = options.margin;
    }

    if (typeof options?.printBackground !== 'undefined') {
      pdfOptions.printBackground = options.printBackground;
    }

    if (typeof options?.preferCSSPageSize !== 'undefined') {
      pdfOptions.preferCSSPageSize = options.preferCSSPageSize;
    }

    const pdfBuffer = await page.pdf(pdfOptions);
    await browser.close();

    return pdfBuffer as Buffer;
  },
});
