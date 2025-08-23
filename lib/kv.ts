import { createClient } from '@vercel/kv';

// Create in-memory fallback for testing
class InMemoryKV {
  private store = new Map<string, any>();
  private expiry = new Map<string, number>();

  async get(key: string) {
    this.cleanExpired();
    return this.store.get(key);
  }

  async set(key: string, value: any, options?: { nx?: boolean; ex?: number }) {
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

  async lpush(key: string, ...values: any[]) {
    let list = this.store.get(key) || [];
    list.unshift(...values);
    this.store.set(key, list);
    return list.length;
  }

  async rpop(key: string) {
    const list = this.store.get(key) || [];
    const value = list.pop();
    if (list.length === 0) {
      this.store.delete(key);
    } else {
      this.store.set(key, list);
    }
    return value;
  }

  async llen(key: string) {
    const list = this.store.get(key) || [];
    return list.length;
  }

  async zadd(key: string, ...items: { score: number; member: string }[]) {
    let zset = this.store.get(key) || [];
    items.forEach(item => {
      const idx = zset.findIndex((z: any) => z.member === item.member);
      if (idx >= 0) {
        zset[idx] = item;
      } else {
        zset.push(item);
      }
    });
    zset.sort((a: any, b: any) => a.score - b.score);
    this.store.set(key, zset);
    return items.length;
  }

  async zrangebyscore(key: string, min: string | number, max: string | number, options?: { limit?: [number, number] }) {
    const zset = this.store.get(key) || [];
    const minScore = min === '-inf' ? -Infinity : Number(min);
    const maxScore = max === '+inf' ? Infinity : Number(max);
    
    let filtered = zset.filter((item: any) => item.score >= minScore && item.score <= maxScore);
    
    if (options?.limit) {
      const [offset, count] = options.limit;
      filtered = filtered.slice(offset, offset + count);
    }
    
    return filtered.map((item: any) => item.member);
  }

  async zrem(key: string, ...members: string[]) {
    const zset = this.store.get(key) || [];
    const newZset = zset.filter((item: any) => !members.includes(item.member));
    
    if (newZset.length === 0) {
      this.store.delete(key);
    } else {
      this.store.set(key, newZset);
    }
    
    return zset.length - newZset.length;
  }

  async zcard(key: string) {
    const zset = this.store.get(key) || [];
    return zset.length;
  }

  pipeline() {
    const commands: Array<() => Promise<any>> = [];
    const self = this;
    
    return {
      lpush(key: string, value: any) {
        commands.push(() => self.lpush(key, value));
        return this;
      },
      zrem(key: string, member: string) {
        commands.push(() => self.zrem(key, member));
        return this;
      },
      async exec() {
        return Promise.all(commands.map(cmd => cmd()));
      }
    };
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
type KVClient = {
  get: (key: string) => Promise<any>;
  set: (key: string, value: any, options?: { nx?: boolean; ex?: number }) => Promise<string | null>;
  del: (key: string) => Promise<number>;
  exists: (key: string) => Promise<number>;
  expire: (key: string, seconds: number) => Promise<number>;
  ttl: (key: string) => Promise<number>;
  lpush: (key: string, ...values: any[]) => Promise<number>;
  rpop: (key: string) => Promise<any>;
  llen: (key: string) => Promise<number>;
  zadd: (key: string, ...items: { score: number; member: string }[]) => Promise<number>;
  zrangebyscore: (key: string, min: string | number, max: string | number, options?: { limit?: [number, number] }) => Promise<string[]>;
  zrem: (key: string, ...members: string[]) => Promise<number>;
  zcard: (key: string) => Promise<number>;
  pipeline: () => any;
};

// Create a wrapper for Vercel KV to ensure consistent API
class VercelKVWrapper {
  private client: any;
  
  constructor() {
    this.client = createClient({
      url: process.env.KV_REST_API_URL!,
      token: process.env.KV_REST_API_TOKEN!,
    });
  }
  
  async get(key: string) {
    return this.client.get(key);
  }
  
  async set(key: string, value: any, options?: { nx?: boolean; ex?: number }) {
    if (options?.nx) {
      return this.client.setnx(key, value, options.ex ? { ex: options.ex } : {});
    }
    return this.client.set(key, value, options?.ex ? { ex: options.ex } : {});
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
  
  async lpush(key: string, ...values: any[]) {
    return this.client.lpush(key, ...values);
  }
  
  async rpop(key: string) {
    return this.client.rpop(key);
  }
  
  async llen(key: string) {
    return this.client.llen(key);
  }
  
  async zadd(key: string, ...items: { score: number; member: string }[]) {
    // Vercel KV zadd expects flat array: [score1, member1, score2, member2, ...]
    const args: any[] = [];
    items.forEach(item => {
      args.push(item.score, item.member);
    });
    return this.client.zadd(key, ...args);
  }
  
  async zrangebyscore(key: string, min: string | number, max: string | number, options?: { limit?: [number, number] }) {
    if (options?.limit) {
      return this.client.zrange(key, min, max, {
        byScore: true,
        limit: { offset: options.limit[0], count: options.limit[1] }
      });
    }
    return this.client.zrange(key, min, max, { byScore: true });
  }
  
  async zrem(key: string, ...members: string[]) {
    return this.client.zrem(key, ...members);
  }
  
  async zcard(key: string) {
    return this.client.zcard(key);
  }
  
  pipeline() {
    return this.client.pipeline();
  }
}

export const kv: KVClient = useInMemory 
  ? new InMemoryKV() as KVClient
  : new VercelKVWrapper() as KVClient;

if (useInMemory) {
  console.log('⚠️  Using in-memory KV store (no KV_REST_API_URL/TOKEN configured)');
}