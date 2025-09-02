/**
 * Pure QR URL construction
 * Single responsibility: Build QR URLs from data and base URL
 */

import { joinUrl } from '../../shared/url';
import type { QRPayload } from './qrCodec';

export function buildQRUrl(baseUrl: string, qrData: QRPayload): string {
  const encoded = btoa(JSON.stringify(qrData))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=/g, '');
    
  const path = `/workspace/${qrData.orderId}?qr=${encoded}`;
  return joinUrl(baseUrl.trim(), path);
}