/**
 * QR services entry point - maintains backward compatibility
 */

import { QRValidationService } from './qrValidation';
import { APIQRRepository } from '../../data/qr/qrRepository';
import { QRScanGuard } from '../../domain/qr/qrScanGuard';

// Factory function to create configured validation service
export function createQRValidationService(): QRValidationService {
  const repository = new APIQRRepository();
  const scanGuard = new QRScanGuard();
  return new QRValidationService(repository, scanGuard);
}

// Re-export types for backward compatibility
export type { 
  QRValidationResult, 
  QRValidationContext 
} from './qrValidation';

export type { QRType } from '../../domain/qr/qrType';

// Backward compatibility - singleton instance
let _defaultService: QRValidationService | null = null;

export function getQRValidationService(): QRValidationService {
  if (!_defaultService) {
    _defaultService = createQRValidationService();
  }
  return _defaultService;
}