import QRCode from 'qrcode';
import { makeShortCode } from './shortcode';

export interface QRData {
  orderId: number;
  orderNumber: string;
  type: 'order_master' | 'source' | 'destination' | 'batch' | 'container';
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

  createQRData(orderId: number, orderNumber: string, type: QRData['type'], containerNumber?: number, chemicalName?: string): QRData {
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

  createShortCodeUrl(shortCode: string): string {
    return `${this.baseUrl}/qr/s/${shortCode}`;
  }

  async generateQRCode(qrData: QRData, options?: { quietZoneModules?: number }): Promise<string> {
    const url = this.createQRUrl(qrData);
    const quietZoneModules = options?.quietZoneModules ?? 8; // Default 8 modules for quiet zone
    
    // Generate SVG for better control and quality
    let svgString = await QRCode.toString(url, {
      type: 'svg',
      errorCorrectionLevel: 'Q', // Q level for thermal printer robustness
      margin: quietZoneModules, // Enforce quiet zone at generation time
      width: 300,
      color: {
        dark: '#000000',
        light: '#FFFFFF'
      }
    });
    
    // Add shape-rendering for crisp edges and ensure white background
    svgString = svgString.replace(
      '<svg',
      '<svg shape-rendering="crispEdges"'
    );
    
    // Insert white background rect as first child of SVG
    svgString = svgString.replace(
      /(viewBox="[^"]+">)/,
      '$1<rect width="100%" height="100%" fill="#fff"/>'
    );
    
    // Log validation check
    console.log(`[QR Generator] Quiet zone: ${quietZoneModules} modules | Mode: inline SVG | Error correction: Q`);
    if (quietZoneModules < 8) {
      console.warn(`[QR Generator] Warning: Quiet zone ${quietZoneModules} modules is below recommended 8 for thermal printing`);
    }
    
    return svgString; // Return raw SVG, not data URL
  }

  async generateQRBuffer(qrData: QRData, options?: { quietZoneModules?: number }): Promise<Buffer> {
    const url = this.createQRUrl(qrData);
    const quietZoneModules = options?.quietZoneModules ?? 8; // Default 8 modules for quiet zone
    
    // Generate buffer with enforced quiet zone
    const buffer = await QRCode.toBuffer(url, {
      errorCorrectionLevel: 'Q', // Q for thermal printer robustness
      margin: quietZoneModules, // Enforce quiet zone at generation time
      width: 300,
      type: 'png',
    });
    
    // Log validation check
    if (quietZoneModules < 8) {
      console.warn(`[QR Generator] Warning: QR buffer generated with quiet zone of ${quietZoneModules} modules (recommended minimum: 8)`);
    }
    
    return buffer;
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
