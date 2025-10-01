/**
 * Order ID validation utilities
 * Ensures orderIds are valid numeric identifiers
 */

export interface OrderIdValidationResult {
  valid: boolean;
  normalized: number | null;
  error?: string;
}

/**
 * Validate and normalize an order ID
 * Returns validation result with normalized numeric value
 *
 * @example
 * const result = validateOrderId('12345');
 * if (result.valid) {
 *   console.log(result.normalized); // 12345
 * }
 */
export function validateOrderId(orderId: string | number): OrderIdValidationResult {
  // Handle null/undefined
  if (orderId === null || orderId === undefined || orderId === '') {
    return {
      valid: false,
      normalized: null,
      error: 'Order ID is required'
    };
  }

  // If already a number, validate it
  if (typeof orderId === 'number') {
    if (!Number.isFinite(orderId)) {
      return {
        valid: false,
        normalized: null,
        error: 'Order ID must be a finite number'
      };
    }

    if (orderId <= 0) {
      return {
        valid: false,
        normalized: null,
        error: 'Order ID must be positive'
      };
    }

    if (!Number.isInteger(orderId)) {
      return {
        valid: false,
        normalized: null,
        error: 'Order ID must be an integer'
      };
    }

    return {
      valid: true,
      normalized: orderId
    };
  }

  // Convert string to number
  const str = String(orderId).trim();

  // Check if empty after trim
  if (str === '') {
    return {
      valid: false,
      normalized: null,
      error: 'Order ID cannot be empty'
    };
  }

  // Check if contains only digits
  if (!/^\d+$/.test(str)) {
    return {
      valid: false,
      normalized: null,
      error: 'Order ID must contain only digits'
    };
  }

  const parsed = parseInt(str, 10);

  // Check if parsing was successful
  if (!Number.isFinite(parsed)) {
    return {
      valid: false,
      normalized: null,
      error: 'Invalid order ID format'
    };
  }

  // Check if positive
  if (parsed <= 0) {
    return {
      valid: false,
      normalized: null,
      error: 'Order ID must be positive'
    };
  }

  // Check if too large (JavaScript number limit)
  if (parsed > Number.MAX_SAFE_INTEGER) {
    return {
      valid: false,
      normalized: null,
      error: 'Order ID is too large'
    };
  }

  return {
    valid: true,
    normalized: parsed
  };
}

/**
 * Quick check if an order ID is valid
 * Returns boolean only
 */
export function isValidOrderId(orderId: string | number): boolean {
  return validateOrderId(orderId).valid;
}

/**
 * Normalize an order ID to a number
 * Returns null if invalid
 */
export function normalizeOrderId(orderId: string | number): number | null {
  const result = validateOrderId(orderId);
  return result.normalized;
}

/**
 * Format an order ID for display
 */
export function formatOrderId(orderId: string | number): string {
  const normalized = normalizeOrderId(orderId);
  if (normalized === null) {
    return String(orderId);
  }
  return normalized.toString();
}
