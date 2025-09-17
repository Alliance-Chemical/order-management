/**
 * Debug utility for conditional logging
 * Only logs in development environment
 */

const isDevelopment = process.env.NODE_ENV === 'development';

export interface DebugOptions {
  module?: string;
  level?: 'log' | 'warn' | 'error' | 'info';
  force?: boolean; // Force logging even in production
}

/**
 * Debug logger that only outputs in development mode
 */
export function debug(message: string, data?: unknown, options: DebugOptions = {}) {
  const { module = 'APP', level = 'log', force = false } = options;
  
  if (!isDevelopment && !force) return;
  
  const timestamp = new Date().toISOString();
  const prefix = `[${timestamp}] [${module}]`;
  
  switch (level) {
    case 'warn':
      console.warn(prefix, message, data ?? '');
      break;
    case 'error':
      console.error(prefix, message, data ?? '');
      break;
    case 'info':
      console.info(prefix, message, data ?? '');
      break;
    default:
      console.log(prefix, message, data ?? '');
  }
}

/**
 * Debug logger specifically for QR code operations
 */
export function debugQR(message: string, data?: unknown) {
  debug(message, data, { module: 'QR' });
}

/**
 * Debug logger for API operations
 */
export function debugAPI(message: string, data?: unknown) {
  debug(message, data, { module: 'API' });
}

/**
 * Debug logger for database operations
 */
export function debugDB(message: string, data?: unknown) {
  debug(message, data, { module: 'DB' });
}

/**
 * Performance timer utility
 */
export class DebugTimer {
  private startTime: number;
  private module: string;
  
  constructor(module: string) {
    this.module = module;
    this.startTime = performance.now();
  }
  
  end(operation: string) {
    if (!isDevelopment) return;
    
    const duration = performance.now() - this.startTime;
    debug(`${operation} completed in ${duration.toFixed(2)}ms`, null, { 
      module: this.module,
      level: duration > 1000 ? 'warn' : 'info'
    });
  }
}

/**
 * Assert utility for development checks
 */
export function debugAssert(condition: boolean, message: string) {
  if (!isDevelopment) return;
  
  if (!condition) {
    console.error(`[ASSERT FAILED] ${message}`);
    console.trace();
  }
}

/**
 * Normalize inconsistent data structures (for debugging data issues)
 */
export function debugDataStructure(data: unknown, context: string) {
  if (!isDevelopment) return;
  const isObject = typeof data === 'object' && data !== null;
  const arrayData: unknown[] | undefined = Array.isArray(data) ? data : undefined;
  const keys = isObject ? Object.keys(data as Record<string, unknown>) : null;
  const sample = arrayData && arrayData.length > 0 ? arrayData[0] : data;

  debug(`Data structure for ${context}:`, {
    type: typeof data,
    isArray: Boolean(arrayData),
    keys,
    sample
  }, { module: 'DATA' });
}
