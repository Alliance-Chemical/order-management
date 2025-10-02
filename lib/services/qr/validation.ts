import { QRGenerator, type QRData } from './generator';

export type QRType = 'source' | 'destination' | 'order_master' | 'batch' | 'unknown';
export type QRValidationResult = 
  | { valid: true; type: QRType; data: QRPayload; shortCode?: string }
  | { valid: false; error: string; suggestion?: string };

type QRPayload = QRData & Record<string, unknown>;

interface QRValidationContext {
  expectedType?: QRType;
  orderId?: string | number;
  containerNumber?: number;
  allowManualEntry?: boolean;
}

/**
 * Service for validating QR codes and manual entry codes
 * Handles type checking, format validation, and provides helpful error messages
 */
export class QRValidationService {
  private qrGenerator: QRGenerator;
  private scannedCodes: Set<string> = new Set();
  
  constructor() {
    this.qrGenerator = new QRGenerator();
  }

  /**
   * Validate a scanned QR code or manually entered code
   */
  async validate(
    input: string, 
    context: QRValidationContext = {}
  ): Promise<QRValidationResult> {
    // Normalize input
    const code = input.trim().toUpperCase();
    
    // Check for empty input
    if (!code) {
      return {
        valid: false,
        error: 'No code provided',
        suggestion: 'Please scan a QR code or enter the code manually'
      };
    }

    // Check for duplicate scan
    if (this.scannedCodes.has(code)) {
      return {
        valid: false,
        error: 'This QR code has already been scanned',
        suggestion: 'This container has already been processed. Skip to the next item.'
      };
    }

    // Handle short codes (like "8XOEZD")
    if (this.isShortCode(code)) {
      return this.validateShortCode(code, context);
    }

    // Handle full QR URLs
    if (this.isQRUrl(code)) {
      return this.validateQRUrl(code, context);
    }

    // Handle raw QR data
    if (this.isEncodedData(code)) {
      return this.validateEncodedData(code, context);
    }

    return {
      valid: false,
      error: 'Invalid code format',
      suggestion: 'Please enter a valid QR code or short code (e.g., 8XOEZD)'
    };
  }

  /**
   * Validate a short code (manual entry)
   */
  private async validateShortCode(
    shortCode: string,
    context: QRValidationContext
  ): Promise<QRValidationResult> {
    try {
      // Query database for QR record with this short code
      const response = await fetch(`/api/qr/validate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ shortCode, orderId: context.orderId })
      });

      if (!response.ok) {
        const errorBody = await response.json() as { code?: string; message?: string };
        const code = errorBody.code;
        // Map standardized codes to friendly messages
        const messageMap: Record<string, { error: string; suggestion?: string }> = {
          INVALID_FORMAT: {
            error: 'Code format is invalid',
            suggestion: 'Enter a valid short code (e.g., 8XOEZD) and try again',
          },
          NOT_FOUND: {
            error: 'Code not recognized',
            suggestion: 'Check the code and try again, or use manual lookup by order number',
          },
          WRONG_ENV: {
            error: 'Code from different environment',
            suggestion: 'Open the correct site (staging vs production) and try again',
          },
          ALREADY_CONSUMED: {
            error: 'This code has already been used',
            suggestion: 'Proceed to the next item or use supervisor override if appropriate',
          },
        };
        let mapped: (typeof messageMap)[keyof typeof messageMap] | undefined;
        if (code && Object.prototype.hasOwnProperty.call(messageMap, code)) {
          mapped = messageMap[code as keyof typeof messageMap];
        }
        return {
          valid: false,
          error: mapped?.error || errorBody.message || 'Validation failed',
          suggestion: mapped?.suggestion || 'Please try again or enter the code manually',
        };
      }

      const qrRecord = await response.json() as { qrType: QRType; encodedData: QRPayload };
      
      // Validate type if expected
      if (context.expectedType && qrRecord.qrType !== context.expectedType) {
        return this.createWrongTypeError(qrRecord.qrType, context.expectedType);
      }

      // Mark as scanned
      this.scannedCodes.add(shortCode);

      return {
        valid: true,
        type: qrRecord.qrType as QRType,
        data: qrRecord.encodedData,
        shortCode
      };
    } catch {
      return {
        valid: false,
        error: 'Failed to validate short code',
        suggestion: 'Please check your network connection and try again'
      };
    }
  }

  /**
   * Validate a full QR URL
   */
  private validateQRUrl(url: string, context: QRValidationContext): QRValidationResult {
    try {
      const urlObj = new URL(url);
      const encodedData = urlObj.searchParams.get('qr');
      
      if (!encodedData) {
        return {
          valid: false,
          error: 'Invalid QR URL format',
          suggestion: 'This QR code appears to be damaged. Please try another.'
        };
      }

      return this.validateEncodedData(encodedData, context);
    } catch {
      return {
        valid: false,
        error: 'Invalid URL format',
        suggestion: 'The scanned code is not a valid QR code URL'
      };
    }
  }

  /**
   * Validate encoded QR data
   */
  private validateEncodedData(
    encodedData: string,
    context: QRValidationContext
  ): QRValidationResult {
    try {
      const decoded = this.qrGenerator.decodeQRUrl(encodedData);
      
      if (!decoded) {
        return {
          valid: false,
          error: 'Failed to decode QR data',
          suggestion: 'This QR code appears to be corrupted'
        };
      }

      // Determine QR type
      const qrData = decoded as QRPayload;
      const qrType = this.determineQRType(qrData);
      
      // Validate type if expected
      if (context.expectedType && qrType !== context.expectedType) {
        return this.createWrongTypeError(qrType, context.expectedType);
      }

      // Validate order ID if provided
      if (context.orderId && qrData.orderId) {
        const normalizedOrderId = String(context.orderId);
        const normalizedQROrderId = String(qrData.orderId);
        
        if (normalizedOrderId !== normalizedQROrderId) {
          return {
            valid: false,
            error: 'QR code belongs to a different order',
            suggestion: `This QR is for order ${qrData.orderNumber || qrData.orderId}. Please scan the correct QR for order ${context.orderId}.`
          };
        }
      }

      // Validate container number if provided
      if (context.containerNumber && qrData.containerNumber) {
        if (context.containerNumber !== qrData.containerNumber) {
          return {
            valid: false,
            error: 'Wrong container number',
            suggestion: `This QR is for container #${qrData.containerNumber}. Please scan container #${context.containerNumber}.`
          };
        }
      }

      // Mark as scanned
      this.scannedCodes.add(encodedData);

      return {
        valid: true,
        type: qrType,
        data: qrData
      };
    } catch {
      return {
        valid: false,
        error: 'Failed to process QR code',
        suggestion: 'Please try scanning again or enter the code manually'
      };
    }
  }

  /**
   * Determine the type of QR code from decoded data
   */
  private determineQRType(data: QRPayload): QRType {
    const record = data as Record<string, unknown>;

    const typeValue = record['type'];
    if (typeof typeValue === 'string') {
      const normalized = typeValue.toLowerCase();
      if (normalized === 'source' || record['isSource'] === true) return 'source';
      if (normalized === 'destination' || normalized === 'container') return 'destination';
      if (normalized === 'order_master' || normalized === 'master') return 'order_master';
      if (normalized === 'batch') return 'batch';
    }
    
    // Infer from data structure
    const sourceContainerId = record['sourceContainerId'];
    if (sourceContainerId) return 'source';

    const containerNumber = record['containerNumber'];
    if (containerNumber && !sourceContainerId) return 'destination';

    if (Array.isArray(record['items'])) return 'order_master';
    
    return 'unknown';
  }

  /**
   * Create error for wrong QR type
   */
  private createWrongTypeError(
    actualType: QRType,
    expectedType: QRType
  ): QRValidationResult {
    const typeLabels: Record<QRType, string> = {
      source: 'Source Container',
      destination: 'Destination Container',
      order_master: 'Master Label',
      batch: 'Batch',
      unknown: 'Unknown'
    };

    return {
      valid: false,
      error: `Wrong QR type: Expected ${typeLabels[expectedType]} QR`,
      suggestion: `You scanned a ${typeLabels[actualType]} QR. Please scan the ${typeLabels[expectedType]} QR code instead.`
    };
  }

  /**
   * Check if input is a short code format
   */
  private isShortCode(input: string): boolean {
    // Short codes are typically 6-8 alphanumeric characters
    return /^[A-Z0-9]{6,8}$/.test(input);
  }

  /**
   * Check if input is a QR URL
   */
  private isQRUrl(input: string): boolean {
    try {
      const url = new URL(input);
      return url.searchParams.has('qr') || url.pathname.includes('/qr/');
    } catch {
      return false;
    }
  }

  /**
   * Check if input is encoded QR data
   */
  private isEncodedData(input: string): boolean {
    // Accept base64 & base64url (no '+' '/', includes '-' '_')
    return /^[A-Za-z0-9+/_-]+=*$/.test(input) && input.length > 20;
  }

  /**
   * Clear scanned codes cache (for new inspection)
   */
  clearScannedCodes(): void {
    this.scannedCodes.clear();
  }

  /**
   * Check if a code has been scanned
   */
  hasBeenScanned(code: string): boolean {
    return this.scannedCodes.has(code.trim().toUpperCase());
  }
}
