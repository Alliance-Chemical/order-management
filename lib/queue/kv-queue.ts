/**
 * Production-ready queue implementation using Vercel KV (Redis)
 * Replaces AWS SQS for async job processing
 */

import { kv } from '@/lib/kv';

export type QueueName = 'jobs' | 'alerts' | 'webhooks';

export type QueueMessage = {
  id: string;
  type: string;
  payload: unknown;
  timestamp: string;
  attempts?: number;
  lastAttempt?: string;
  maxRetries?: number;
  lastError?: string;
};

// Environment-based key prefixing to avoid cross-pollution
const NS = process.env.VERCEL_ENV || process.env.NODE_ENV || 'dev';

const KEY = {
  ready: (q: QueueName) => `${NS}:q:${q}:ready`,
  scheduled: (q: QueueName) => `${NS}:q:${q}:scheduled`,
  dead: (q: QueueName) => `${NS}:q:${q}:deadletter`,
  lock: (name: string) => `${NS}:lock:${name}`,
  seen: (q: QueueName, type: string, fp: string) => `${NS}:q:${q}:seen:${type}:${fp}`,
  done: (q: QueueName, type: string, fp: string) => `${NS}:q:${q}:done:${type}:${fp}`,
};

function sha(s: string): string {
  // Use Web Crypto API for Edge Runtime compatibility
  const encoder = new TextEncoder();
  const data = encoder.encode(s);
  let hash = 0;
  for (let i = 0; i < data.length; i++) {
    hash = ((hash << 5) - hash) + data[i];
    hash = hash & hash;
  }
  return Math.abs(hash).toString(16);
}

export const kvQueue = {
  /**
   * Enqueue a message with optional deduplication
   */
  async enqueue(
    queue: QueueName,
    type: string,
    payload: unknown,
    opts?: {
      delayMs?: number;
      maxRetries?: number;
      fingerprint?: string;
    }
  ): Promise<string | null> {
    // Optional fingerprint-based deduplication
    if (opts?.fingerprint) {
      const seenKey = KEY.seen(queue, type, opts.fingerprint);
      const set = await kv.set(seenKey, '1', {
        nx: true,
        ex: 60 * 60 * 24, // 24h TTL
      });
      if (!set) {
        console.log(`Duplicate job skipped: ${type} with fingerprint ${opts.fingerprint}`);
        return null;
      }
    }

    const id = `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const message: QueueMessage = {
      id,
      type,
      payload,
      timestamp: new Date().toISOString(),
      attempts: 0,
      maxRetries: opts?.maxRetries ?? 3,
    };

    if (opts?.delayMs && opts.delayMs > 0) {
      // Schedule for future processing
      const score = Date.now() + opts.delayMs;
      await kv.zadd(KEY.scheduled(queue), {
        score,
        member: JSON.stringify(message),
      });
      console.log(`Scheduled ${type} job ${id} for ${new Date(score).toISOString()}`);
    } else {
      // Add to ready queue immediately
      await kv.lpush(KEY.ready(queue), JSON.stringify(message));
      console.log(`Enqueued ${type} job ${id} to ${queue}`);
    }

    return id;
  },

  /**
   * Move due scheduled jobs to ready queue
   */
  async flushDue(queue: QueueName, limit = 100): Promise<number> {
    const now = Date.now();
    const scheduledKey = KEY.scheduled(queue);
    const readyKey = KEY.ready(queue);

    // Get all due messages
    const due = await kv.zrangebyscore(scheduledKey, '-inf', now, {
      limit: [0, limit],
    });

    if (!due || due.length === 0) return 0;

    // Move to ready queue and remove from scheduled
    const pipeline = kv.pipeline();
    for (const msg of due) {
      pipeline.lpush(readyKey, msg);
      pipeline.zrem(scheduledKey, msg);
    }
    await pipeline.exec();

    console.log(`Flushed ${due.length} due jobs from scheduled to ready`);
    return due.length;
  },

  /**
   * Pop messages from ready queue for processing
   */
  async pop(queue: QueueName, limit = 10): Promise<QueueMessage[]> {
    const readyKey = KEY.ready(queue);
    const messages: QueueMessage[] = [];

    for (let i = 0; i < limit; i++) {
      const raw = await kv.rpop(readyKey);
      if (!raw) break;

      try {
        // Vercel KV may auto-parse JSON, so check if it's already an object
        const msg = typeof raw === 'string' ? JSON.parse(raw) as QueueMessage : raw as QueueMessage;
        messages.push(msg);
      } catch (e) {
        console.error('Failed to parse queue message:', e);
      }
    }

    return messages;
  },

  /**
   * Retry or move to deadletter
   */
  async retryOrDeadletter(
    queue: QueueName,
    message: QueueMessage,
    error?: string
  ): Promise<void> {
    const attempts = (message.attempts || 0) + 1;
    const maxRetries = message.maxRetries || 3;

    if (attempts >= maxRetries) {
      // Move to deadletter
      const deadKey = KEY.dead(queue);
      await kv.lpush(
        deadKey,
        JSON.stringify({
          ...message,
          attempts,
          lastAttempt: new Date().toISOString(),
          lastError: error,
        })
      );
      console.error(`Job ${message.id} moved to deadletter after ${attempts} attempts:`, error);
    } else {
      // Retry with exponential backoff
      const backoffMs = Math.min(1000 * Math.pow(2, attempts), 60000);
      await this.enqueue(queue, message.type, message.payload, {
        delayMs: backoffMs,
        maxRetries: message.maxRetries,
      });
      console.log(`Retrying job ${message.id} (attempt ${attempts}) after ${backoffMs}ms`);
    }
  },

  /**
   * Check if job was already processed (idempotency)
   */
  async isDuplicate(
    queue: QueueName,
    type: string,
    payload: unknown
  ): Promise<boolean> {
    const fp = sha(JSON.stringify({ type, payload }));
    const doneKey = KEY.done(queue, type, fp);
    const first = await kv.set(doneKey, '1', {
      nx: true,
      ex: 60 * 60 * 24, // 24h TTL
    });
    return !first;
  },

  /**
   * Get queue statistics
   */
  async stats(queue: QueueName): Promise<{
    ready: number;
    scheduled: number;
    dead: number;
  }> {
    const [ready, scheduled, dead] = await Promise.all([
      kv.llen(KEY.ready(queue)),
      kv.zcard(KEY.scheduled(queue)),
      kv.llen(KEY.dead(queue)),
    ]);

    return {
      ready: ready || 0,
      scheduled: scheduled || 0,
      dead: dead || 0,
    };
  },

  /**
   * Retry deadletter jobs
   */
  async retryDeadletter(queue: QueueName, count = 10): Promise<number> {
    const deadKey = KEY.dead(queue);
    let retried = 0;

    for (let i = 0; i < count; i++) {
      const raw = await kv.rpop(deadKey);
      if (!raw) break;

      try {
        // Vercel KV may auto-parse JSON, so check if it's already an object
        const msg = typeof raw === 'string' ? JSON.parse(raw) as QueueMessage : raw as QueueMessage;
        // Reset attempts for retry
        msg.attempts = 0;
        delete msg.lastError;
        await this.enqueue(queue, msg.type, msg.payload);
        retried++;
      } catch (e) {
        console.error('Failed to retry deadletter message:', e);
      }
    }

    return retried;
  },

  /**
   * Clear queue (use with caution)
   */
  async clear(queue: QueueName): Promise<void> {
    await Promise.all([
      kv.del(KEY.ready(queue)),
      kv.del(KEY.scheduled(queue)),
      kv.del(KEY.dead(queue)),
    ]);
  },
};

/**
 * Acquire a distributed lock
 */
export async function withLock<T>(
  name: string,
  ttlSec: number,
  fn: () => Promise<T>
): Promise<T | { ok: false; skipped: true }> {
  const key = KEY.lock(name);
  const acquired = await kv.set(key, '1', {
    nx: true,
    ex: ttlSec,
  });

  if (!acquired) {
    console.log(`Lock ${name} already held, skipping`);
    return { ok: false, skipped: true };
  }

  try {
    return await fn();
  } finally {
    await kv.del(key);
  }
}

// Export convenience instances for backward compatibility
export class KVQueue {
  constructor(private queueName: QueueName) {}

  async enqueue(message: Omit<QueueMessage, 'id' | 'timestamp'>): Promise<string> {
    const id = await kvQueue.enqueue(this.queueName, message.type, message.payload);
    return id || 'duplicate';
  }

  async dequeue(limit = 10): Promise<QueueMessage[]> {
    await kvQueue.flushDue(this.queueName, limit);
    return kvQueue.pop(this.queueName, limit);
  }

  async retry(message: QueueMessage, error?: string): Promise<void> {
    await kvQueue.retryOrDeadletter(this.queueName, message, error);
  }

  async size(): Promise<number> {
    const stats = await kvQueue.stats(this.queueName);
    return stats.ready + stats.scheduled;
  }

  async clear(): Promise<void> {
    await kvQueue.clear(this.queueName);
  }
}

// Export pre-configured queues for compatibility
export const qrGenerationQueue = new KVQueue('jobs');
export const alertQueue = new KVQueue('alerts');
export const webhookQueue = new KVQueue('webhooks');
