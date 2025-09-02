/**
 * QR data creation utilities
 * Single responsibility: Create and validate QR data structures
 */

import type { QRPayload } from './qrCodec';

export function createQRData(
  orderId: number, 
  orderNumber: string, 
  type: 'order_master' | 'destination' | 'source' | 'batch', 
  containerNumber?: number, 
  chemicalName?: string
): QRPayload {
  return {
    orderId,
    orderNumber,
    type,
    containerNumber,
    chemicalName,
    timestamp: new Date().toISOString(),
  };
}