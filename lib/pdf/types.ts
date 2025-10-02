/**
 * PDF Generation Types
 */

export interface PDFOptions {
  width?: string;
  height?: string;
  format?: string;
  margin?: {
    top: string | number;
    bottom: string | number;
    left: string | number;
    right: string | number;
  };
  printBackground?: boolean;
  preferCSSPageSize?: boolean;
}

export interface PDFRenderer {
  renderPDF(htmlContent: string, options?: PDFOptions): Promise<Buffer>;
}
