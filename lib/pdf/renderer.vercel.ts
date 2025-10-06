/**
 * PDF Renderer for Vercel (Serverless)
 * Uses puppeteer-core with @sparticuz/chromium
 */

import type { PDFRenderer, PDFOptions } from './types';
import type { Viewport } from 'puppeteer-core';

export const createVercelRenderer = (): PDFRenderer => ({
  async renderPDF(htmlContent: string, options?: PDFOptions): Promise<Buffer> {
    // Dynamic imports only evaluated on Vercel
    const puppeteer = await import('puppeteer-core');
    const chromiumModule = await import('@sparticuz/chromium');

    type ChromiumLike = {
      args: string[];
      executablePath: (input?: string) => Promise<string>;
      headless?: boolean | 'new';
      defaultViewport?: Viewport | null;
    };

    const chromium = (chromiumModule.default ?? chromiumModule) as ChromiumLike;

    const browser = await puppeteer.default.launch({
      args: chromium.args,
      defaultViewport: chromium.defaultViewport ?? { width: 1280, height: 720 },
      executablePath: await chromium.executablePath(),
      headless: typeof chromium.headless === 'boolean' ? chromium.headless : true,
    });

    const page = await browser.newPage();
    const pageWithMedia = page as typeof page & {
      emulateMedia?: (options?: { media?: 'screen' | 'print' }) => Promise<void>;
      emulateMediaType?: (type: 'screen' | 'print') => Promise<void>;
    };

    if (typeof pageWithMedia.emulateMediaType === 'function') {
      await pageWithMedia.emulateMediaType('print');
    } else if (typeof pageWithMedia.emulateMedia === 'function') {
      await pageWithMedia.emulateMedia({ media: 'print' });
    }

    await page.setContent(htmlContent, { waitUntil: 'domcontentloaded' });

    type PuppeteerPdfOptions = NonNullable<Parameters<typeof page.pdf>[0]>;
    const pdfOptions: PuppeteerPdfOptions = {};

    if (options?.format) {
      pdfOptions.format = options.format as PuppeteerPdfOptions['format'];
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
