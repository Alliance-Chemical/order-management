import QRCode from 'qrcode';
import { v4 as uuidv4 } from 'uuid';
import { makeShortCode } from './shortcode';

export interface QRData {
  orderId: number;
  orderNumber: string;
  type: 'order_master' | 'source' | 'destination' | 'batch';
  containerNumber?: number;
  chemicalName?: string;
  timestamp: string;
}

export class QRGenerator {
  private baseUrl: string;

  constructor(baseUrl: string = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000') {
    // Remove any trailing whitespace or newlines from the base URL
    this.baseUrl = baseUrl.trim();
  }

  generateShortCode(orderId: number | bigint, containerNumber?: number): string {
    const base = `${orderId}${containerNumber ?? ''}${Date.now()}`;
    // Crockford 7 chars; collision-safe per order
    return makeShortCode(base, 7);
  }

  createQRData(orderId: number, orderNumber: string, type: 'order_master' | 'destination' | 'source' | 'batch', containerNumber?: number, chemicalName?: string): QRData {
    return {
      orderId,
      orderNumber,
      type,
      containerNumber,
      chemicalName,
      timestamp: new Date().toISOString(),
    };
  }

  createQRUrl(qrData: QRData): string {
    const encoded = Buffer.from(JSON.stringify(qrData)).toString('base64url');
    return `${this.baseUrl}/workspace/${qrData.orderId}?qr=${encoded}`;
  }

  async generateQRCode(qrData: QRData): Promise<string> {
    const url = this.createQRUrl(qrData);
    return await QRCode.toDataURL(url, {
      errorCorrectionLevel: 'H',
      margin: 2,
      width: 300,
    });
  }

  async generateQRBuffer(qrData: QRData): Promise<Buffer> {
    const url = this.createQRUrl(qrData);
    return await QRCode.toBuffer(url, {
      errorCorrectionLevel: 'H',
      margin: 2,
      width: 300,
      type: 'png',
    });
  }

  decodeQRUrl(encodedData: string): QRData | null {
    try {
      const fixed = encodedData.replace(/-/g, '+').replace(/_/g, '/'); // url → std
      const pad = fixed.length % 4 === 0 ? '' : '='.repeat(4 - (fixed.length % 4));
      const decoded = Buffer.from(fixed + pad, 'base64').toString();
      return JSON.parse(decoded);
    } catch {
      return null;
    }
  }
}