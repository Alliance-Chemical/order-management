import { KVCache } from '@/lib/cache/kv-cache';
import type { FreightDecision } from '@/lib/freight-booking/rag/freight-decision-engine-v2';

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
    return KVCache.get<FreightDecision>(key.aiSuggestion(contextKey));
  },
  async setAISuggestion(contextKey: string, value: FreightDecision) {
    return KVCache.set(key.aiSuggestion(contextKey), value, TTL.aiSuggestion);
  },

  // Quotes
  async getQuotes<T>(orderId: string | number) {
    return KVCache.get<T>(key.quotes(orderId));
  },
  async setQuotes<T>(orderId: string | number, value: T) {
    return KVCache.set(key.quotes(orderId), value, TTL.quotes);
  },

  // Carrier service/static data
  async getCarrierData<T>(name: string) {
    return KVCache.get<T>(key.carrierData(name));
  },
  async setCarrierData<T>(name: string, value: T) {
    return KVCache.set(key.carrierData(name), value, TTL.carrierData);
  },
};
