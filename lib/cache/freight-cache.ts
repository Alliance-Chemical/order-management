import { KVCache } from '@/lib/cache/kv-cache';

// Centralized cache keys and TTLs for freight features
const TTL = {
  quotes: 300,          // 5 minutes
  aiSuggestion: 3600,   // 1 hour
  carrierData: 86400,   // 24 hours
};

const key = {
  aiSuggestion: (contextKey: string) => `freight:ai:suggestion:${contextKey}`,
  quotes: (orderId: string | number) => `freight:quotes:${orderId}`,
  carrierData: (name: string) => `freight:carrier:data:${name}`,
};

export const freightCache = {
  // AI suggestions
  async getAISuggestion(contextKey: string) {
    return KVCache.get<any>(key.aiSuggestion(contextKey));
  },
  async setAISuggestion(contextKey: string, value: any) {
    return KVCache.set(key.aiSuggestion(contextKey), value, TTL.aiSuggestion);
  },

  // Quotes
  async getQuotes(orderId: string | number) {
    return KVCache.get<any>(key.quotes(orderId));
  },
  async setQuotes(orderId: string | number, value: any) {
    return KVCache.set(key.quotes(orderId), value, TTL.quotes);
  },

  // Carrier service/static data
  async getCarrierData(name: string) {
    return KVCache.get<any>(key.carrierData(name));
  },
  async setCarrierData(name: string, value: any) {
    return KVCache.set(key.carrierData(name), value, TTL.carrierData);
  },
};

