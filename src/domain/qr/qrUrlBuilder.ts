/**
 * Pure QR URL construction
 * Single responsibility: Build QR URLs from data and base URL
 */

import { joinUrl } from '../../shared/url';
import type { QRPayload } from './qrCodec';
import { encodeQRData } from './qrCodec';

export function buildQRUrl(baseUrl: string, qrData: QRPayload): string {
  // Use a Node- and Edge-safe encoder that returns base64url
  const encoded = encodeQRData(qrData);

  const path = `/workspace/${qrData.orderId}?qr=${encoded}`;
  return joinUrl(baseUrl.trim(), path);
}

export function buildShortCodeUrl(baseUrl: string, shortCode: string): string {
  const path = `/qr/s/${shortCode}`;
  return joinUrl(baseUrl.trim(), path);
}
