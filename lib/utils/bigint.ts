/**
 * Utilities for handling BigInt serialization and conversion
 */

export function asBigInt(v: number | string | bigint): bigint {
  return typeof v === 'bigint' ? v : BigInt(v);
}

export function bigIntReplacer(_key: string, value: any): any {
  return typeof value === 'bigint' ? value.toString() : value;
}

export function jsonStringifyWithBigInt(obj: any): string {
  return JSON.stringify(obj, bigIntReplacer);
}

export function normalizeOrderId(orderId: number | string | bigint): bigint {
  return asBigInt(orderId);
}