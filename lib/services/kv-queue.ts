// Re-export from the new production-ready implementation
export {
  KVQueue,
  QueueMessage,
  qrGenerationQueue,
  alertQueue,
  webhookQueue,
  kvQueue,
  withLock,
} from '@/lib/queue/kv-queue';