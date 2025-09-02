/**
 * Pure QR code encoding/decoding functions
 * Single responsibility: Transform between raw data and encoded formats
 */

export interface QRPayload {
  orderId: number;
  orderNumber: string;
  type: 'order_master' | 'source' | 'destination' | 'batch';
  containerNumber?: number;
  chemicalName?: string;
  timestamp: string;
}

export function encodeQRData(data: QRPayload): string {
  return Buffer.from(JSON.stringify(data)).toString('base64url');
}

export function decodeQRData(encodedData: string): QRPayload | null {
  try {
    const fixed = encodedData.replace(/-/g, '+').replace(/_/g, '/');
    const pad = fixed.length % 4 === 0 ? '' : '='.repeat(4 - (fixed.length % 4));
    const decoded = Buffer.from(fixed + pad, 'base64').toString();
    return JSON.parse(decoded);
  } catch {
    return null;
  }
}

export function decodeQRUrl(url: string): QRPayload | null {
  try {
    const urlObj = new URL(url);
    const encodedData = urlObj.searchParams.get('qr');
    return encodedData ? decodeQRData(encodedData) : null;
  } catch {
    return null;
  }
}