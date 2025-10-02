// Re-export from the new production-ready implementation
export {
  KVQueue,
  qrGenerationQueue,
  alertQueue,
  webhookQueue,
  kvQueue,
  withLock,
} from '@/lib/queue/kv-queue';

export type { QueueMessage } from '@/lib/queue/kv-queue';
