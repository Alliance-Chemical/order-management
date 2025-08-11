import QRCode from 'qrcode';
import { v4 as uuidv4 } from 'uuid';

export interface QRData {
  orderId: number;
  orderNumber: string;
  type: 'master' | 'container' | 'batch';
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

  generateShortCode(orderId: number, containerNumber?: number): string {
    const base = `${orderId}`;
    const suffix = containerNumber ? `-${containerNumber}` : '-M';
    return `QR${base}${suffix}`;
  }

  createQRData(orderId: number, orderNumber: string, type: 'master' | 'container', containerNumber?: number, chemicalName?: string): QRData {
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
      const decoded = Buffer.from(encodedData, 'base64url').toString();
      return JSON.parse(decoded);
    } catch {
      return null;
    }
  }
}