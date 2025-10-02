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

    // Emulate print media
    if ('emulateMedia' in page) {
      await (page as any).emulateMedia({ media: 'print' });
    }

    await page.setContent(htmlContent, { waitUntil: 'domcontentloaded' as any });

    const pdfBuffer = await page.pdf(options as any);
    await browser.close();

    return pdfBuffer as Buffer;
  },
});
