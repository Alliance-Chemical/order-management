/**
 * Feature Flags Service
 *
 * Enables safe, gradual rollout of new features.
 *
 * FEATURES:
 * - Database-backed (can change without deployment)
 * - Percentage rollout (enable for 1%, 10%, 50%, 100% of requests)
 * - User targeting (enable for specific users)
 * - Caching (don't hit DB on every request)
 *
 * Usage:
 *   if (await featureFlags.isEnabled('batch_polling')) {
 *     return newBatchLogic();
 *   }
 *   return oldLogic();
 */

import { getDb } from '@/src/data/db/client';
import { featureFlags as featureFlagsTable } from '@/lib/db/schema/outbox';
import { eq } from 'drizzle-orm';
import { logger } from '@/lib/logger';

type FeatureFlag = typeof featureFlagsTable.$inferSelect;

class FeatureFlagsService {
  private db = getDb();
  private cache = new Map<string, { flag: FeatureFlag; cachedAt: number }>();
  private cacheTTL = 60000; // Cache for 60 seconds

  /**
   * Check if a feature is enabled
   */
  async isEnabled(
    flagName: string,
    context?: {
      userId?: string;
      tenantId?: string;
      requestId?: string;
    }
  ): Promise<boolean> {
    try {
      // Get flag from cache or database
      const flag = await this.getFlag(flagName);

      if (!flag) {
        // Flag doesn't exist - default to disabled
        logger.warn({ flagName }, 'Feature flag not found - defaulting to disabled');
        return false;
      }

      // Check if globally disabled
      if (!flag.enabled) {
        return false;
      }

      // Check user targeting
      if (context?.userId && flag.enabledForUsers) {
        const enabledUsers = flag.enabledForUsers as string[];
        if (enabledUsers.includes(context.userId)) {
          return true; // Explicitly enabled for this user
        }
      }

      // Check tenant targeting
      if (context?.tenantId && flag.enabledForTenants) {
        const enabledTenants = flag.enabledForTenants as string[];
        if (enabledTenants.includes(context.tenantId)) {
          return true; // Explicitly enabled for this tenant
        }
      }

      // Check percentage rollout
      const rolloutPercentage = (flag.rolloutPercentage as number) || 0;

      if (rolloutPercentage === 0) {
        return false;
      }

      if (rolloutPercentage >= 100) {
        return true; // Fully rolled out
      }

      // Use deterministic hashing for consistent rollout
      // Same user/request always gets same result
      const hash = this.hashString(context?.requestId || context?.userId || Math.random().toString());
      const bucket = hash % 100;

      return bucket < rolloutPercentage;
    } catch (error) {
      logger.error({ error, flagName }, 'Feature flag check failed - defaulting to disabled');
      return false; // Fail safe: disable feature on error
    }
  }

  /**
   * Get flag from cache or database
   */
  private async getFlag(flagName: string): Promise<FeatureFlag | null> {
    // Check cache first
    const cached = this.cache.get(flagName);
    if (cached && Date.now() - cached.cachedAt < this.cacheTTL) {
      return cached.flag;
    }

    // Fetch from database
    const flag = await this.db.query.featureFlags.findFirst({
      where: eq(featureFlagsTable.name, flagName),
    });

    if (flag) {
      // Update cache
      this.cache.set(flagName, {
        flag,
        cachedAt: Date.now(),
      });
    }

    return flag || null;
  }

  /**
   * Enable a feature flag
   */
  async enable(
    flagName: string,
    options?: {
      rolloutPercentage?: number;
      enabledForUsers?: string[];
      enabledForTenants?: string[];
    }
  ): Promise<void> {
    try {
      await this.db
        .update(featureFlagsTable)
        .set({
          enabled: true,
          rolloutPercentage: options?.rolloutPercentage ?? 100,
          enabledForUsers: options?.enabledForUsers ?? [],
          enabledForTenants: options?.enabledForTenants ?? [],
          updatedAt: new Date(),
        })
        .where(eq(featureFlagsTable.name, flagName));

      // Invalidate cache
      this.cache.delete(flagName);

      logger.info({ flagName, options }, 'Feature flag enabled');
    } catch (error) {
      logger.error({ error, flagName }, 'Failed to enable feature flag');
      throw error;
    }
  }

  /**
   * Disable a feature flag
   */
  async disable(flagName: string): Promise<void> {
    try {
      await this.db
        .update(featureFlagsTable)
        .set({
          enabled: false,
          updatedAt: new Date(),
        })
        .where(eq(featureFlagsTable.name, flagName));

      // Invalidate cache
      this.cache.delete(flagName);

      logger.info({ flagName }, 'Feature flag disabled');
    } catch (error) {
      logger.error({ error, flagName }, 'Failed to disable feature flag');
      throw error;
    }
  }

  /**
   * Update rollout percentage
   */
  async setRolloutPercentage(flagName: string, percentage: number): Promise<void> {
    if (percentage < 0 || percentage > 100) {
      throw new Error('Rollout percentage must be between 0 and 100');
    }

    try {
      await this.db
        .update(featureFlagsTable)
        .set({
          rolloutPercentage: percentage,
          updatedAt: new Date(),
        })
        .where(eq(featureFlagsTable.name, flagName));

      // Invalidate cache
      this.cache.delete(flagName);

      logger.info({ flagName, percentage }, 'Feature flag rollout percentage updated');
    } catch (error) {
      logger.error({ error, flagName, percentage }, 'Failed to update rollout percentage');
      throw error;
    }
  }

  /**
   * Get all flags
   */
  async getAllFlags(): Promise<FeatureFlag[]> {
    return await this.db.select().from(featureFlagsTable);
  }

  /**
   * Clear cache (useful after manual DB updates)
   */
  clearCache(): void {
    this.cache.clear();
    logger.info('Feature flags cache cleared');
  }

  /**
   * Simple string hash function (for deterministic rollout)
   */
  private hashString(str: string): number {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = (hash << 5) - hash + char;
      hash = hash & hash; // Convert to 32bit integer
    }
    return Math.abs(hash);
  }
}

// Export singleton
export const featureFlags = new FeatureFlagsService();

/**
 * Helper hook for Next.js components
 */
export async function useFeatureFlag(
  flagName: string,
  context?: { userId?: string; tenantId?: string }
): Promise<boolean> {
  return await featureFlags.isEnabled(flagName, context);
}

/**
 * Convenience function for API routes
 */
export async function checkFeatureFlag(
  flagName: string,
  request?: {
    headers: { get(name: string): string | null };
  }
): Promise<boolean> {
  const requestId = request?.headers.get('x-request-id') || undefined;
  const userId = request?.headers.get('x-user-id') || undefined;

  return await featureFlags.isEnabled(flagName, { requestId, userId });
}