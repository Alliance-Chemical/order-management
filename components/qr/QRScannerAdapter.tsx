'use client';

import React from 'react';
import { ValidatedQRScanner } from '@/components/qr/ValidatedQRScanner';
import { warehouseFeedback } from '@/lib/warehouse-ui-utils';

// Back-compat adapter: matches the old QRScanner signature but
// delegates to ValidatedQRScanner under the hood.
// It emits a QR URL string on onScan (as before) so existing
// handlers that POST { qrCode: <url> } keep working.

interface QRScannerProps {
  onScan: (data: string) => void;
  onClose: () => void;
}

function toBase64Url(str: string) {
  if (typeof window !== 'undefined' && 'btoa' in window) {
    return (window as any).btoa(str).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  }
  // SSR-safe fallback
  return Buffer.from(str).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

export function QRScanner({ onScan, onClose }: QRScannerProps) {
  const handleValidScan = (data: any) => {
    try {
      // Compose a QR URL string expected by legacy handlers
      const origin = typeof window !== 'undefined' ? window.location.origin : 'http://localhost:3000';
      const encoded = toBase64Url(JSON.stringify(data));
      const orderId = data?.orderId ?? 'unknown';
      const url = `${origin}/workspace/${orderId}?qr=${encoded}`;
      try { warehouseFeedback.success(); } catch {}
      onScan(url);
    } catch (e) {
      // Fallback: emit JSON string if URL cannot be constructed
      onScan(JSON.stringify({ shortCode: data?.shortCode, data }));
    }
  };

  return (
    <ValidatedQRScanner
      onValidScan={handleValidScan}
      onClose={onClose}
      allowManualEntry={true}
      supervisorMode={false}
    />
  );
}

export default QRScanner;

