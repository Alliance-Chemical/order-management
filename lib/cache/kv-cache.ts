import { kv } from '@vercel/kv';

// Cache TTL configurations (in seconds)
const CACHE_TTL = {
  SHORT: 60,        // 1 minute for frequently changing data
  MEDIUM: 300,      // 5 minutes for moderate data
  LONG: 3600,       // 1 hour for stable data
  DAY: 86400,       // 24 hours for static data
};

// Cache key prefixes for organization
const CACHE_PREFIX = {
  WORKSPACE: 'ws:',
  ORDER: 'order:',
  QR: 'qr:',
  USER: 'user:',
  STATS: 'stats:',
  QUEUE: 'queue:',
};

export class KVCache {
  /**
   * Get cached data with automatic JSON parsing
   */
  static async get<T>(key: string): Promise<T | null> {
    try {
      const data = await kv.get<T>(key);
      return data;
    } catch (error) {
      console.error(`Cache get error for key ${key}:`, error);
      return null;
    }
  }

  /**
   * Set cache with automatic JSON stringification
   */
  static async set<T>(
    key: string,
    value: T,
    ttl: number = CACHE_TTL.MEDIUM
  ): Promise<void> {
    try {
      await kv.set(key, value, { ex: ttl });
    } catch (error) {
      console.error(`Cache set error for key ${key}:`, error);
      // Don't throw - caching should not break the app
    }
  }

  /**
   * Delete cache entry
   */
  static async delete(key: string): Promise<void> {
    try {
      await kv.del(key);
    } catch (error) {
      console.error(`Cache delete error for key ${key}:`, error);
    }
  }

  /**
   * Delete multiple cache entries by pattern
   */
  static async deletePattern(pattern: string): Promise<void> {
    try {
      const keys = await kv.keys(pattern);
      if (keys.length > 0) {
        await kv.del(...keys);
      }
    } catch (error) {
      console.error(`Cache delete pattern error for ${pattern}:`, error);
    }
  }

  /**
   * Get or set cache with factory function
   */
  static async getOrSet<T>(
    key: string,
    factory: () => Promise<T>,
    ttl: number = CACHE_TTL.MEDIUM
  ): Promise<T> {
    // Try to get from cache first
    const cached = await this.get<T>(key);
    if (cached !== null) {
      return cached;
    }

    // Generate fresh data
    const fresh = await factory();
    
    // Store in cache (don't await to not block response)
    this.set(key, fresh, ttl).catch(console.error);
    
    return fresh;
  }

  /**
   * Invalidate related caches when data changes
   */
  static async invalidateWorkspace(workspaceId: string): Promise<void> {
    const keys = [
      `${CACHE_PREFIX.WORKSPACE}${workspaceId}`,
      `${CACHE_PREFIX.WORKSPACE}${workspaceId}:*`,
      `${CACHE_PREFIX.ORDER}*:${workspaceId}`,
    ];
    
    await Promise.all(keys.map(key => this.deletePattern(key)));
  }

  /**
   * Cache workspace data
   */
  static async cacheWorkspace<T>(workspaceId: string, data: T): Promise<void> {
    const key = `${CACHE_PREFIX.WORKSPACE}${workspaceId}`;
    await this.set(key, data, CACHE_TTL.SHORT);
  }

  /**
   * Get cached workspace
   */
  static async getCachedWorkspace<T>(workspaceId: string): Promise<T | null> {
    const key = `${CACHE_PREFIX.WORKSPACE}${workspaceId}`;
    return this.get<T>(key);
  }

  /**
   * Cache QR code data
   */
  static async cacheQRCode<T>(qrCode: string, data: T): Promise<void> {
    const key = `${CACHE_PREFIX.QR}${qrCode}`;
    await this.set(key, data, CACHE_TTL.LONG);
  }

  /**
   * Get cached QR code
   */
  static async getCachedQRCode<T>(qrCode: string): Promise<T | null> {
    const key = `${CACHE_PREFIX.QR}${qrCode}`;
    return this.get<T>(key);
  }

  /**
   * Cache stats/metrics
   */
  static async cacheStats<T>(statType: string, data: T): Promise<void> {
    const key = `${CACHE_PREFIX.STATS}${statType}`;
    await this.set(key, data, CACHE_TTL.MEDIUM);
  }

  /**
   * Implement stale-while-revalidate pattern
   */
  static async staleWhileRevalidate<T>(
    key: string,
    factory: () => Promise<T>,
    staleTTL: number = CACHE_TTL.SHORT,
    freshTTL: number = CACHE_TTL.LONG
  ): Promise<T> {
    const staleKey = `${key}:stale`;
    const lockKey = `${key}:lock`;
    
    // Get stale data
    const stale = await this.get<T>(key);
    
    // If we have stale data, return it immediately
    if (stale !== null) {
      // Check if someone else is already revalidating
      const isLocked = await kv.get<boolean>(lockKey);
      
      if (!isLocked) {
        // Set lock to prevent multiple revalidations
        await kv.set(lockKey, true, { ex: 30 }); // 30 second lock
        
        // Revalidate in background (don't await)
        factory()
          .then(fresh => {
            this.set(key, fresh, freshTTL);
            this.set(staleKey, fresh, staleTTL);
          })
          .catch(console.error)
          .finally(() => {
            kv.del(lockKey);
          });
      }
      
      return stale;
    }
    
    // No stale data, generate fresh
    const fresh = await factory();
    await this.set(key, fresh, freshTTL);
    await this.set(staleKey, fresh, staleTTL);
    
    return fresh;
  }
}

// Export cache TTL and prefix constants
export { CACHE_TTL, CACHE_PREFIX };
