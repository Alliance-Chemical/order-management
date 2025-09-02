/**
 * QR scan deduplication guard
 * Single responsibility: Track and prevent duplicate scans
 */

export class QRScanGuard {
  private scannedCodes: Set<string> = new Set();

  hasBeenScanned(code: string): boolean {
    return this.scannedCodes.has(code.trim().toUpperCase());
  }

  markAsScanned(code: string): void {
    this.scannedCodes.add(code.trim().toUpperCase());
  }

  clear(): void {
    this.scannedCodes.clear();
  }

  getScannedCount(): number {
    return this.scannedCodes.size;
  }
}