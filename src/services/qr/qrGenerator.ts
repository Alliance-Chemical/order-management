/**
 * QR generator facade - composes focused modules
 * Single responsibility: Orchestrate QR generation workflow
 */

import { buildQRUrl } from '../../domain/qr/qrUrlBuilder';
import { createQRData } from '../../domain/qr/qrDataFactory';
import { renderQRSvg } from './qrSvgRenderer';
import { renderQRPng } from './qrPngRenderer';
import { makeShortCode } from '../../../lib/services/qr/shortcode';
import type { QRPayload } from '../../domain/qr/qrCodec';

export interface QRGenerationOptions {
  quietZoneModules?: number;
  width?: number;
  errorCorrectionLevel?: 'L' | 'M' | 'Q' | 'H';
}

export class QRGenerator {
  constructor(private baseUrl: string = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000') {}

  generateShortCode(orderId: number | bigint, containerNumber?: number): string {
    const base = `${orderId}${containerNumber ?? ''}${Date.now()}`;
    return makeShortCode(base, 7);
  }

  createQRData(
    orderId: number, 
    orderNumber: string, 
    type: 'order_master' | 'destination' | 'source' | 'batch', 
    containerNumber?: number, 
    chemicalName?: string
  ): QRPayload {
    return createQRData(orderId, orderNumber, type, containerNumber, chemicalName);
  }

  createQRUrl(qrData: QRPayload): string {
    return buildQRUrl(this.baseUrl, qrData);
  }

  async generateQRCode(qrData: QRPayload, options?: QRGenerationOptions): Promise<string> {
    const url = this.createQRUrl(qrData);
    return renderQRSvg(url, options);
  }

  async generateQRBuffer(qrData: QRPayload, options?: QRGenerationOptions): Promise<Buffer> {
    const url = this.createQRUrl(qrData);
    return renderQRPng(url, options);
  }

  decodeQRUrl(encodedData: string): QRPayload | null {
    try {
      const fixed = encodedData.replace(/-/g, '+').replace(/_/g, '/');
      const pad = fixed.length % 4 === 0 ? '' : '='.repeat(4 - (fixed.length % 4));
      const decoded = atob ? atob(fixed + pad) : Buffer.from(fixed + pad, 'base64').toString();
      return JSON.parse(decoded);
    } catch {
      return null;
    }
  }
}