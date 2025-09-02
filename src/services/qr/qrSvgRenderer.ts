/**
 * SVG QR code renderer - Edge Runtime compatible
 * Single responsibility: Generate SVG QR codes
 */

import QRCode from 'qrcode';

export interface QRRenderOptions {
  quietZoneModules?: number;
  width?: number;
  errorCorrectionLevel?: 'L' | 'M' | 'Q' | 'H';
}

export async function renderQRSvg(url: string, options: QRRenderOptions = {}): Promise<string> {
  const quietZoneModules = options.quietZoneModules ?? 8;
  const width = options.width ?? 300;
  const errorCorrectionLevel = options.errorCorrectionLevel ?? 'Q';
  
  let svgString = await QRCode.toString(url, {
    type: 'svg',
    errorCorrectionLevel,
    margin: quietZoneModules,
    width,
    color: {
      dark: '#000000',
      light: '#FFFFFF'
    }
  });
  
  // Optimize SVG for crisp rendering and ensure white background
  svgString = svgString
    .replace('<svg', '<svg shape-rendering="crispEdges"')
    .replace(/(viewBox="[^"]+">)/, '$1<rect width="100%" height="100%" fill="#fff"/>');
  
  // Log performance warnings
  if (quietZoneModules < 8) {
    console.warn(`[QR SVG] Warning: Quiet zone ${quietZoneModules} modules below recommended 8 for thermal printing`);
  }
  
  return svgString;
}