/**
 * QR validation service - lean composition of focused modules
 * Single responsibility: Orchestrate QR validation workflow
 */

import { detectFormat } from '../../domain/qr/qrFormat';
import { decodeQRData, decodeQRUrl, type QRPayload } from '../../domain/qr/qrCodec';
import { determineQRType, isExpectedType, getTypeErrorMessage, type QRType } from '../../domain/qr/qrType';
import { QRScanGuard } from '../../domain/qr/qrScanGuard';
import type { QRRepository } from '../../data/qr/qrRepository';

export interface QRValidationContext {
  expectedType?: QRType;
  orderId?: string | number;
  containerNumber?: number;
  allowManualEntry?: boolean;
}

export type QRValidationResult = 
  | { valid: true; type: QRType; data: QRPayload; shortCode?: string }
  | { valid: false; error: string; suggestion?: string };

export class QRValidationService {
  constructor(
    private qrRepository: QRRepository,
    private scanGuard: QRScanGuard = new QRScanGuard()
  ) {}

  async validate(input: string, context: QRValidationContext = {}): Promise<QRValidationResult> {
    const code = input.trim().toUpperCase();
    
    if (!code) {
      return {
        valid: false,
        error: 'No code provided',
        suggestion: 'Please scan a QR code or enter the code manually'
      };
    }

    if (this.scanGuard.hasBeenScanned(code)) {
      return {
        valid: false,
        error: 'This QR code has already been scanned',
        suggestion: 'This container has already been processed. Skip to the next item.'
      };
    }

    const format = detectFormat(code);
    if (!format) {
      return {
        valid: false,
        error: 'Invalid code format',
        suggestion: 'Please enter a valid QR code or short code (e.g., 8XOEZD)'
      };
    }

    const result = await this.validateByFormat(code, format, context);
    
    if (result.valid) {
      this.scanGuard.markAsScanned(code);
    }
    
    return result;
  }

  private async validateByFormat(
    code: string, 
    format: 'short' | 'url' | 'payload', 
    context: QRValidationContext
  ): Promise<QRValidationResult> {
    switch (format) {
      case 'short':
        return this.validateShortCode(code, context);
      case 'url':
        return this.validateQRUrl(code, context);
      case 'payload':
        return this.validateEncodedData(code, context);
    }
  }

  private async validateShortCode(shortCode: string, context: QRValidationContext): Promise<QRValidationResult> {
    const qrRecord = await this.qrRepository.findByShortCode(shortCode, context.orderId);
    
    if (!qrRecord) {
      return {
        valid: false,
        error: 'Short code not found',
        suggestion: 'Please check the code and try again'
      };
    }

    const qrType = qrRecord.qrType as QRType;
    
    if (!isExpectedType(qrType, context.expectedType)) {
      return { valid: false, ...getTypeErrorMessage(qrType, context.expectedType!) };
    }

    return {
      valid: true,
      type: qrType,
      data: qrRecord.encodedData,
      shortCode
    };
  }

  private validateQRUrl(url: string, context: QRValidationContext): QRValidationResult {
    const decoded = decodeQRUrl(url);
    
    if (!decoded) {
      return {
        valid: false,
        error: 'Invalid QR URL format',
        suggestion: 'This QR code appears to be damaged. Please try another.'
      };
    }

    return this.validateDecodedData(decoded, context);
  }

  private validateEncodedData(encodedData: string, context: QRValidationContext): QRValidationResult {
    const decoded = decodeQRData(encodedData);
    
    if (!decoded) {
      return {
        valid: false,
        error: 'Failed to decode QR data',
        suggestion: 'This QR code appears to be corrupted'
      };
    }

    return this.validateDecodedData(decoded, context);
  }

  private validateDecodedData(data: QRPayload, context: QRValidationContext): QRValidationResult {
    const qrType = determineQRType(data);
    
    if (!isExpectedType(qrType, context.expectedType)) {
      return { valid: false, ...getTypeErrorMessage(qrType, context.expectedType!) };
    }

    // Validate order ID if provided
    if (context.orderId && data.orderId) {
      if (String(context.orderId) !== String(data.orderId)) {
        return {
          valid: false,
          error: 'QR code belongs to a different order',
          suggestion: `This QR is for order ${data.orderNumber || data.orderId}. Please scan the correct QR for order ${context.orderId}.`
        };
      }
    }

    // Validate container number if provided
    if (context.containerNumber && data.containerNumber) {
      if (context.containerNumber !== data.containerNumber) {
        return {
          valid: false,
          error: 'Wrong container number',
          suggestion: `This QR is for container #${data.containerNumber}. Please scan container #${context.containerNumber}.`
        };
      }
    }

    return {
      valid: true,
      type: qrType,
      data
    };
  }

  clearScannedCodes(): void {
    this.scanGuard.clear();
  }

  hasBeenScanned(code: string): boolean {
    return this.scanGuard.hasBeenScanned(code);
  }
}