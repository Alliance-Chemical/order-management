/**
 * QR data access layer
 * Single responsibility: Handle QR database operations
 */

export interface QRRecord {
  qrType: string;
  encodedData: Record<string, unknown>;
  shortCode?: string;
}

export interface QRRepository {
  findByShortCode(shortCode: string, orderId?: string | number): Promise<QRRecord | null>;
}

export class APIQRRepository implements QRRepository {
  async findByShortCode(shortCode: string, orderId?: string | number): Promise<QRRecord | null> {
    try {
      const response = await fetch(`/api/qr/validate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ shortCode, orderId })
      });

      if (!response.ok) {
        return null;
      }

      return await response.json();
    } catch {
      return null;
    }
  }
}
