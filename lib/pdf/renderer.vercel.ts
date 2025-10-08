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

    if (typeof (page as any).emulateMediaType === 'function') {
      await page.emulateMediaType('print');
    }

    await page.setContent(htmlContent, { waitUntil: 'domcontentloaded' });

    const pdfOptions: any = {
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
