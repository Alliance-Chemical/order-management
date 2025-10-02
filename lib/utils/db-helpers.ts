/**
 * Database Helper Utilities
 *
 * Helpers for working with Drizzle ORM and handling null/undefined conversions
 */

/**
 * Strips undefined values from an object, converting them to null or removing them
 * This is useful for Drizzle inserts/updates where the database may return null
 * but TypeScript expects undefined for optional fields
 *
 * @param obj - Object to process
 * @param removeUndefined - If true, removes undefined keys; if false, converts to null
 * @returns Processed object
 */
export function stripUndefined<T extends Record<string, unknown>>(
  obj: T,
  removeUndefined = true
): Partial<T> {
  const result: Partial<T> = {};

  for (const key in obj) {
    const value = obj[key];

    if (value === undefined) {
      if (!removeUndefined) {
        result[key] = null as T[Extract<keyof T, string>];
      }
      // Skip if removeUndefined is true
    } else if (value === null) {
      // Keep null values as-is
      result[key] = value as T[Extract<keyof T, string>];
    } else if (typeof value === 'object' && !Array.isArray(value) && !(value instanceof Date)) {
      // Recursively process nested objects
      result[key] = stripUndefined(value as Record<string, unknown>, removeUndefined) as T[Extract<keyof T, string>];
    } else {
      // Keep all other values
      result[key] = value as T[Extract<keyof T, string>];
    }
  }

  return result;
}

/**
 * Converts null values to undefined in an object
 * Useful for handling database results where null should be treated as undefined
 *
 * @param obj - Object to process
 * @returns Object with null values converted to undefined
 */
export function nullToUndefined<T extends Record<string, unknown>>(obj: T): T {
  const result: Record<string, unknown> = {};

  for (const key in obj) {
    const value = obj[key];

    if (value === null) {
      result[key] = undefined;
    } else if (typeof value === 'object' && !Array.isArray(value) && !(value instanceof Date)) {
      result[key] = nullToUndefined(value as Record<string, unknown>);
    } else {
      result[key] = value;
    }
  }

  return result as T;
}

/**
 * Type guard to check if a value is a non-null object
 */
export function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/**
 * Safely parse a number from a string or number, returning undefined if invalid
 */
export function parseNumber(value: string | number | null | undefined): number | undefined {
  if (value === null || value === undefined) return undefined;
  const num = typeof value === 'number' ? value : parseFloat(value);
  return isNaN(num) ? undefined : num;
}

/**
 * Safely parse a string from a value, returning undefined if null/undefined
 */
export function parseString(value: string | number | null | undefined): string | undefined {
  if (value === null || value === undefined) return undefined;
  return String(value);
}

/**
 * Convert a decimal value to string for Drizzle decimal columns
 */
export function toDecimalString(value: number | string | null | undefined): string | undefined {
  if (value === null || value === undefined) return undefined;
  return String(value);
}
