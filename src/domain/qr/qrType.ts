/**
 * Pure QR type determination and validation
 * Single responsibility: Classify QR data types
 */

import type { QRPayload } from './qrCodec';

export type QRType = 'source' | 'destination' | 'order_master' | 'batch' | 'unknown';

export function determineQRType(data: QRPayload): QRType {
  if (data.type) {
    const t = String(data.type).toLowerCase();
    if (t === 'source' || 'isSource' in data) return 'source';
    if (t === 'destination' || t === 'container') return 'destination';
    if (t === 'order_master' || t === 'master') return 'order_master';
    if (t === 'batch') return 'batch';
  }
  
  // Infer from data structure
  if ('sourceContainerId' in data) return 'source';
  if (data.containerNumber && !('sourceContainerId' in data)) return 'destination';
  const items = (data as { items?: unknown[] }).items;
  if (Array.isArray(items)) return 'order_master';
  
  return 'unknown';
}

export function isExpectedType(actualType: QRType, expectedType?: QRType): boolean {
  return !expectedType || actualType === expectedType;
}

export function getTypeErrorMessage(actualType: QRType, expectedType: QRType): {error: string; suggestion: string} {
  const typeLabels: Record<QRType, string> = {
    source: 'Source Container',
    destination: 'Destination Container',
    order_master: 'Master Label',
    batch: 'Batch',
    unknown: 'Unknown'
  };

  return {
    error: `Wrong QR type: Expected ${typeLabels[expectedType]} QR`,
    suggestion: `You scanned a ${typeLabels[actualType]} QR. Please scan the ${typeLabels[expectedType]} QR code instead.`
  };
}
