/**
 * PNG QR code renderer - Node.js environments only
 * Single responsibility: Generate PNG QR code buffers
 */

import QRCode from 'qrcode';

export interface QRPngOptions {
  quietZoneModules?: number;
  width?: number;
  errorCorrectionLevel?: 'L' | 'M' | 'Q' | 'H';
}

export async function renderQRPng(url: string, options: QRPngOptions = {}): Promise<Buffer> {
  const quietZoneModules = options.quietZoneModules ?? 8;
  const width = options.width ?? 300;
  const errorCorrectionLevel = options.errorCorrectionLevel ?? 'Q';
  
  const buffer = await QRCode.toBuffer(url, {
    errorCorrectionLevel,
    margin: quietZoneModules,
    width,
    type: 'png',
  });
  
  if (quietZoneModules < 8) {
    console.warn(`[QR PNG] Warning: QR buffer generated with quiet zone of ${quietZoneModules} modules (recommended minimum: 8)`);
  }
  
  return buffer;
}