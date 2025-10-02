/**
 * Unified database client with runtime detection
 * Single responsibility: Provide optimal DB connection for any runtime
 */

import { neon } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-http';
import type { NeonHttpDatabase } from 'drizzle-orm/neon-http';
import * as qrSchema from './schema/qr-workspace';
import * as freightSchema from './schema/freight';
import * as ragSchema from './schema/rag-embeddings';
import * as iso9001Schema from './schema/iso9001';
import * as outboxSchema from './schema/outbox';

// Lazy-initialized connection
const schema = {
  ...qrSchema,
  ...freightSchema,
  ...ragSchema,
  ...iso9001Schema,
  ...outboxSchema,
} as const;

type AppSchema = typeof schema;

let _db: NeonHttpDatabase<AppSchema> | null = null;
let _sql: ReturnType<typeof neon> | null = null;

function detectRuntime(): 'edge' | 'serverless' | 'node' {
  if (typeof globalThis !== 'undefined' && (globalThis as Record<string, unknown>).EdgeRuntime !== undefined) {
    return 'edge';
  }
  if (typeof process !== 'undefined' && process.env.VERCEL) return 'serverless';
  return 'node';
}

function initializeDb() {
  const connectionString = process.env.DATABASE_URL || process.env.NEON_DATABASE_URL;
  if (!connectionString) {
    throw new Error('DATABASE_URL or NEON_DATABASE_URL environment variable required');
  }

  if (!_sql) {
    const runtime = detectRuntime();
    const isEdge = runtime === 'edge';

    _sql = neon(connectionString, {
      fullResults: !isEdge,
    });

    _db = drizzle(_sql, { schema });
  }

  return { db: _db!, sql: _sql! };
}

export function getDb() {
  const { db } = initializeDb();
  return db;
}

export type Database = NeonHttpDatabase<AppSchema>;
export { schema as appSchema };

export async function withRetry<T>(
  fn: () => Promise<T>,
  options: { maxRetries?: number; timeoutMs?: number; isEdge?: boolean } = {}
): Promise<T> {
  const runtime = detectRuntime();
  const isEdge = options.isEdge ?? runtime === 'edge';

  const maxRetries = options.maxRetries ?? (isEdge ? 2 : 3);
  const timeoutMs = options.timeoutMs ?? (isEdge ? 5000 : 10000);
  const retryDelayMs = isEdge ? 50 : 1000;

  const timeout = timeoutMs > 0 ? new Promise<never>((_, reject) => {
    setTimeout(() => reject(new Error('Database operation timeout')), timeoutMs);
  }) : null;

  for (let i = 0; i < maxRetries; i++) {
    try {
      const operation = timeout ? Promise.race([fn(), timeout]) : fn();
      return await operation;
    } catch (error) {
      // Don't retry certain errors
      if (error instanceof Error) {
        const nonRetryableErrors = [
          'unique constraint',
          'foreign key',
          'not found',
          'timeout'
        ];

        if (nonRetryableErrors.some(err => error.message.includes(err))) {
          throw error;
        }
      }

      if (i === maxRetries - 1) {
        throw error;
      }

      // Wait before retry with backoff (Edge uses fixed delay)
      const delay = isEdge ? retryDelayMs : retryDelayMs * Math.pow(2, i);
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }

  throw new Error('Retry loop failed');
}

export async function checkDbHealth(timeoutMs: number = 1000): Promise<boolean> {
  try {
    const connectionString = process.env.DATABASE_URL || process.env.NEON_DATABASE_URL;
    if (!connectionString) return false;

    const { sql } = initializeDb();

    const healthCheck = sql`SELECT 1 as health`;
    const timeout = new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error('Health check timeout')), timeoutMs)
    );

    const result = await Promise.race([healthCheck, timeout]);
    if (Array.isArray(result)) {
      return (result[0] as { health?: number } | undefined)?.health === 1;
    }
    if (result && typeof result === 'object' && 'rows' in result) {
      const rows = (result as { rows?: Array<{ health?: number }> }).rows ?? [];
      return rows[0]?.health === 1;
    }
    return false;
  } catch {
    return false;
  }
}

/**
 * Helper to extract rows from Neon HTTP query results
 * Neon serverless returns either an array or an object with rows property
 */
export function extractRows<T>(result: T[] | { rows: T[] }): T[] {
  if (Array.isArray(result)) {
    return result;
  }
  return result.rows || [];
}

// Export a singleton db instance for backward compatibility
export const db: NeonHttpDatabase<AppSchema> = getDb();
