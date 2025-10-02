/**
 * Unified PDF Generation Interface
 * Automatically selects the correct renderer based on environment
 */

import type { PDFOptions } from './types';

/**
 * Render HTML to PDF using the appropriate engine for the environment
 * @param htmlContent - HTML string to render
 * @param options - PDF generation options
 * @returns PDF as Buffer
 */
export async function renderPDF(
  htmlContent: string,
  options?: PDFOptions
): Promise<Buffer> {
  const isVercel = process.env.VERCEL === '1';

  if (isVercel) {
    const { createVercelRenderer } = await import('./renderer.vercel');
    const renderer = createVercelRenderer();
    return renderer.renderPDF(htmlContent, options);
  } else {
    const { createLocalRenderer } = await import('./renderer.local');
    const renderer = createLocalRenderer();
    return renderer.renderPDF(htmlContent, options);
  }
}

// Re-export types for convenience
export type { PDFOptions } from './types';
