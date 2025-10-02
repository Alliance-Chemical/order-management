/**
 * Utilities for handling BigInt serialization and conversion
 */

export function asBigInt(v: number | string | bigint): bigint {
  return typeof v === 'bigint' ? v : BigInt(v);
}

export function bigIntReplacer(_key: string, value: unknown): unknown {
  return typeof value === 'bigint' ? value.toString() : value;
}

export function jsonStringifyWithBigInt(obj: unknown): string {
  return JSON.stringify(obj, bigIntReplacer);
}

/**
 * Normalize order ID to number (for Drizzle schema with mode: 'number')
 * Use this for database queries with workspaces.orderId
 */
export function normalizeOrderId(orderId: number | string | bigint): number {
  if (typeof orderId === 'number') return orderId;
  if (typeof orderId === 'string') return parseInt(orderId, 10);
  return Number(orderId);
}

/**
 * @deprecated Use normalizeOrderId instead for database queries
 */
export function asOrderIdBigInt(v: number | string | bigint): bigint {
  return asBigInt(v);
}
