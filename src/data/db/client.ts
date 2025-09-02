/**
 * Unified database client with runtime detection
 * Single responsibility: Provide optimal DB connection for any runtime
 */

import { neon } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-http';
import * as qrSchema from '../../../lib/db/schema/qr-workspace';
import * as freightSchema from '../../../lib/db/schema/freight';

const connectionString = process.env.DATABASE_URL || process.env.NEON_DATABASE_URL;

// Lazy-initialized connection
let _db: ReturnType<typeof drizzle> | null = null;
let _sql: ReturnType<typeof neon> | null = null;

function detectRuntime(): 'edge' | 'serverless' | 'node' {
  if (typeof EdgeRuntime !== 'undefined') return 'edge';
  if (typeof process !== 'undefined' && process.env.VERCEL) return 'serverless';
  return 'node';
}

function initializeDb() {
  if (!connectionString) {
    throw new Error('DATABASE_URL or NEON_DATABASE_URL environment variable required');
  }

  if (!_sql) {
    const runtime = detectRuntime();
    const isEdge = runtime === 'edge';
    
    _sql = neon(connectionString, {
      fetchConnectionCache: true,
      fullResults: !isEdge, // Smaller payloads for Edge
    });
    
    const schema = { ...qrSchema, ...freightSchema };
    _db = drizzle(_sql, { schema });
  }
  
  return { db: _db!, sql: _sql! };
}

export function getDb() {
  const { db } = initializeDb();
  return db;
}

export type Database = ReturnType<typeof getDb>;

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
    if (!connectionString) return false;
    
    const { sql } = initializeDb();
    
    const healthCheck = sql`SELECT 1 as health`;
    const timeout = new Promise<never>((_, reject) => 
      setTimeout(() => reject(new Error('Health check timeout')), timeoutMs)
    );
    
    const result = await Promise.race([healthCheck, timeout]) as any[];
    return result?.[0]?.health === 1;
  } catch {
    return false;
  }
}