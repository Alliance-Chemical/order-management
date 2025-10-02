import { createClient } from '@vercel/kv';
import type { ScoreMember, SetCommandOptions, ZRangeCommandOptions } from '@upstash/redis';

// Create in-memory fallback for testing
interface SortedSetEntry {
  score: number;
  member: string;
}

type KVValue = unknown;
type HashValue = Record<string, KVValue>;

type ScoreBoundaryInput = number | '-inf' | '+inf' | `(${number}` | `[${number}`;
type NormalizedScoreBoundary = number | '-inf' | '+inf' | `(${number}`;

const EPSILON = 1e-9;

function buildSetOptions(options?: { nx?: boolean; ex?: number }): SetCommandOptions | undefined {
  if (!options) return undefined;

  const { nx, ex } = options;

  if (typeof ex === 'number') {
    return nx ? ({ ex, nx: true }) : ({ ex });
  }

  if (nx) {
    return { nx: true };
  }

  return undefined;
}

function normalizeBoundaryForRedis(value: ScoreBoundaryInput): NormalizedScoreBoundary {
  if (typeof value === 'number' || value === '-inf' || value === '+inf') {
    return value;
  }

  if (value.startsWith('(')) {
    const numeric = Number(value.slice(1));
    const safeNumeric = Number.isFinite(numeric) ? numeric : 0;
    return (`(${safeNumeric}` as `(${number}`);
  }

  if (value.startsWith('[')) {
    const numeric = Number(value.slice(1));
    return Number.isFinite(numeric) ? numeric : 0;
  }

  return 0;
}

function isAboveMin(score: number, boundary: ScoreBoundaryInput): boolean {
  if (boundary === '-inf') return true;
  if (boundary === '+inf') return false;
  if (typeof boundary === 'number') return score >= boundary;

  const numeric = Number(boundary.slice(1));
  if (!Number.isFinite(numeric)) return true;

  if (boundary.startsWith('(')) {
    return score > numeric + EPSILON;
  }

  if (boundary.startsWith('[')) {
    return score >= numeric;
  }

  return score >= Number(boundary);
}

function isBelowMax(score: number, boundary: ScoreBoundaryInput): boolean {
  if (boundary === '+inf') return true;
  if (boundary === '-inf') return false;
  if (typeof boundary === 'number') return score <= boundary;

  const numeric = Number(boundary.slice(1));
  if (!Number.isFinite(numeric)) return true;

  if (boundary.startsWith('(')) {
    return score < numeric - EPSILON;
  }

  if (boundary.startsWith('[')) {
    return score <= numeric;
  }

  return score <= Number(boundary);
}

class InMemoryKV {
  private store = new Map<string, KVValue>();
  private expiry = new Map<string, number>();

  async get(key: string) {
    this.cleanExpired();
    return this.store.get(key);
  }

  async set(key: string, value: KVValue, options?: { nx?: boolean; ex?: number }) {
    this.cleanExpired();
    
    if (options?.nx && this.store.has(key)) {
      return null;
    }
    
    this.store.set(key, value);
    
    if (options?.ex) {
      this.expiry.set(key, Date.now() + options.ex * 1000);
    }
    
    return 'OK';
  }

  async del(key: string) {
    this.store.delete(key);
    this.expiry.delete(key);
    return 1;
  }

  async exists(key: string) {
    this.cleanExpired();
    return this.store.has(key) ? 1 : 0;
  }

  async expire(key: string, seconds: number) {
    if (this.store.has(key)) {
      this.expiry.set(key, Date.now() + seconds * 1000);
      return 1;
    }
    return 0;
  }

  async ttl(key: string) {
    const exp = this.expiry.get(key);
    if (!exp) return -1;
    return Math.max(0, Math.floor((exp - Date.now()) / 1000));
  }

  async lpush(key: string, ...values: KVValue[]) {
    const list = (this.store.get(key) as unknown[] | undefined) ?? [];
    list.unshift(...values);
    this.store.set(key, list);
    return list.length;
  }

  async rpop(key: string) {
    const list = (this.store.get(key) as unknown[] | undefined) ?? [];
    const value = list.pop();
    if (list.length === 0) {
      this.store.delete(key);
    } else {
      this.store.set(key, list);
    }
    return value;
  }

  async llen(key: string) {
    const list = (this.store.get(key) as unknown[] | undefined) ?? [];
    return list.length;
  }

  async hset(key: string, values: HashValue) {
    const current = this.store.get(key);
    const next: HashValue = {
      ...(typeof current === 'object' && current !== null ? current as HashValue : {}),
      ...values,
    };
    this.store.set(key, next);
    return Object.keys(values).length;
  }

  async hmset(key: string, values: HashValue) {
    await this.hset(key, values);
    return 'OK';
  }

  async hgetall<T = HashValue>(key: string) {
    const value = this.store.get(key);
    if (!value || typeof value !== 'object') {
      return null;
    }
    return value as T;
  }

  async scan(cursor: number | string, options?: { match?: string; count?: number }) {
    this.cleanExpired();
    const keys = Array.from(this.store.keys()).filter((key) => {
      if (!options?.match) return true;
      if (!GLOB_WILDCARD_REGEX.test(options.match)) {
        return key === options.match;
      }
      return globToRegExp(options.match).test(key);
    });

    const count = options?.count ?? keys.length;
    return ['0', keys.slice(0, count)] as [string, string[]];
  }

  async zadd(key: string, ...items: SortedSetEntry[]) {
    const zset = (this.store.get(key) as SortedSetEntry[] | undefined) ?? [];
    items.forEach((item) => {
      const idx = zset.findIndex((z) => z.member === item.member);
      if (idx >= 0) {
        zset[idx] = item;
      } else {
        zset.push(item);
      }
    });
    zset.sort((a, b) => a.score - b.score);
    this.store.set(key, zset);
    return items.length;
  }

  async zrangebyscore(key: string, min: ScoreBoundaryInput, max: ScoreBoundaryInput, options?: { limit?: [number, number] }) {
    const zset = (this.store.get(key) as SortedSetEntry[] | undefined) ?? [];
    
    let filtered = zset.filter((item) => isAboveMin(item.score, min) && isBelowMax(item.score, max));
    
    if (options?.limit) {
      const [offset, count] = options.limit;
      filtered = filtered.slice(offset, offset + count);
    }
    
    return filtered.map((item) => item.member);
  }

  async zrem(key: string, ...members: string[]) {
    const zset = (this.store.get(key) as SortedSetEntry[] | undefined) ?? [];
    const newZset = zset.filter((item) => !members.includes(item.member));
    
    if (newZset.length === 0) {
      this.store.delete(key);
    } else {
      this.store.set(key, newZset);
    }
    
    return zset.length - newZset.length;
  }

  async zcard(key: string) {
    const zset = (this.store.get(key) as SortedSetEntry[] | undefined) ?? [];
    return zset.length;
  }

  pipeline(): PipelineApi {
    const commands: Array<() => Promise<unknown>> = [];
    const api = {
      lpush: (key: string, value: KVValue) => {
        commands.push(() => this.lpush(key, value));
        return api;
      },
      zrem: (key: string, member: string) => {
        commands.push(() => this.zrem(key, member));
        return api;
      },
      exec: async () => Promise.all(commands.map((cmd) => cmd())),
    };

    return api;
  }

  private cleanExpired() {
    const now = Date.now();
    for (const [key, exp] of this.expiry.entries()) {
      if (exp < now) {
        this.store.delete(key);
        this.expiry.delete(key);
      }
    }
  }
}

// Use in-memory KV for testing when KV credentials are not available
const useInMemory = !process.env.KV_REST_API_URL || !process.env.KV_REST_API_TOKEN || 
                    process.env.KV_REST_API_URL === '' || process.env.KV_REST_API_TOKEN === '';

// Create a proper type for KV operations
interface PipelineApi {
  lpush: (key: string, value: KVValue) => PipelineApi;
  zrem: (key: string, member: string) => PipelineApi;
  exec: () => Promise<unknown[]>;
}

const GLOB_WILDCARD_REGEX = /[?*\[\]]/;

function globToRegExp(pattern: string): RegExp {
  const escaped = pattern
    .replace(/[.+^${}()|\\]/g, '\\$&')
    .replace(/\*/g, '.*')
    .replace(/\?/g, '.');
  return new RegExp(`^${escaped}$`);
}

export type KVClient = {
  get: (key: string) => Promise<KVValue>;
  set: (key: string, value: KVValue, options?: { nx?: boolean; ex?: number }) => Promise<string | null>;
  del: (key: string) => Promise<number>;
  exists: (key: string) => Promise<number>;
  expire: (key: string, seconds: number) => Promise<number>;
  ttl: (key: string) => Promise<number>;
  lpush: (key: string, ...values: KVValue[]) => Promise<number>;
  rpop: (key: string) => Promise<KVValue>;
  llen: (key: string) => Promise<number>;
  zadd: (key: string, ...items: SortedSetEntry[]) => Promise<number>;
  zrangebyscore: (key: string, min: ScoreBoundaryInput, max: ScoreBoundaryInput, options?: { limit?: [number, number] }) => Promise<string[]>;
  zrem: (key: string, ...members: string[]) => Promise<number>;
  zcard: (key: string) => Promise<number>;
  hset: (key: string, values: HashValue) => Promise<number>;
  hmset: (key: string, values: HashValue) => Promise<'OK'>;
  hgetall: <T = HashValue>(key: string) => Promise<T | null>;
  scan: (cursor: number | string, options?: { match?: string; count?: number }) => Promise<[string, string[]]>;
  pipeline: () => PipelineApi;
};

// Create a wrapper for Vercel KV to ensure consistent API
class VercelKVWrapper {
  private client: ReturnType<typeof createClient>;
  
  constructor() {
    this.client = createClient({
      url: process.env.KV_REST_API_URL!,
      token: process.env.KV_REST_API_TOKEN!,
    });
  }
  
  async get(key: string) {
    return this.client.get(key);
  }
  
  async set(key: string, value: KVValue, options?: { nx?: boolean; ex?: number }) {
    const setOptions = buildSetOptions(options);
    return this.client.set(key, value, setOptions);
  }
  
  async del(key: string) {
    return this.client.del(key);
  }
  
  async exists(key: string) {
    return this.client.exists(key);
  }
  
  async expire(key: string, seconds: number) {
    return this.client.expire(key, seconds);
  }
  
  async ttl(key: string) {
    return this.client.ttl(key);
  }
  
  async lpush(key: string, ...values: KVValue[]) {
    return this.client.lpush(key, ...values);
  }
  
  async rpop(key: string) {
    return this.client.rpop(key);
  }
  
  async llen(key: string) {
    return this.client.llen(key);
  }

  async hset(key: string, values: HashValue) {
    const client = this.client as typeof this.client & { hset?: (key: string, values: HashValue) => Promise<number> };
    if (typeof client.hset === 'function') {
      return client.hset(key, values);
    }
    await this.set(key, values);
    return Object.keys(values).length;
  }

  async hmset(key: string, values: HashValue) {
    await this.hset(key, values);
    return 'OK';
  }

  async hgetall<T = HashValue>(key: string) {
    const client = this.client as typeof this.client & { hgetall?: (key: string) => Promise<Record<string, KVValue> | null> };
    if (typeof client.hgetall === 'function') {
      const result = await client.hgetall(key);
      return (result ?? null) as T | null;
    }
    const raw = await this.get(key);
    if (!raw || typeof raw !== 'object') {
      return null;
    }
    return raw as T;
  }

  async scan(cursor: number | string, options?: { match?: string; count?: number }) {
    const client = this.client as typeof this.client & { scan?: (cursor: number | string, options?: { match?: string; count?: number }) => Promise<[string, string[]]> };
    if (typeof client.scan === 'function') {
      return client.scan(cursor, options);
    }
    return ['0', []] as [string, string[]];
  }
  
  async zadd(key: string, ...items: SortedSetEntry[]) {
    if (items.length === 0) {
      return 0;
    }

    const entries = items.map(({ score, member }) => ({ score, member })) as ScoreMember<string>[];
    const [first, ...rest] = entries as [ScoreMember<string>, ...ScoreMember<string>[]];
    return this.client.zadd(key, first, ...rest);
  }

  async zrangebyscore(
    key: string,
    min: ScoreBoundaryInput,
    max: ScoreBoundaryInput,
    options?: { limit?: [number, number] },
  ) {
    const minBoundary = normalizeBoundaryForRedis(min);
    const maxBoundary = normalizeBoundaryForRedis(max);

    const commandOptions: ZRangeCommandOptions & { byScore: true } = options?.limit
      ? { byScore: true, offset: options.limit[0], count: options.limit[1] }
      : { byScore: true };

    return this.client.zrange(key, minBoundary, maxBoundary, commandOptions);
  }
  
  async zrem(key: string, ...members: string[]) {
    return this.client.zrem(key, ...members);
  }
  
  async zcard(key: string) {
    return this.client.zcard(key);
  }
  
  pipeline(): PipelineApi {
    const pipeline = this.client.pipeline();
    const api: PipelineApi = {
      lpush: (key: string, value: KVValue) => {
        pipeline.lpush(key, value);
        return api;
      },
      zrem: (key: string, member: string) => {
        pipeline.zrem(key, member);
        return api;
      },
      exec: () => pipeline.exec(),
    };

    return api;
  }
}

export const kv: KVClient = useInMemory
  ? (new InMemoryKV() as KVClient)
  : (new VercelKVWrapper() as KVClient);

if (useInMemory) {
  console.log('⚠️  Using in-memory KV store (no KV_REST_API_URL/TOKEN configured)');
}
